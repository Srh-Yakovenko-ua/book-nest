import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { ListsService } from "../../lists/index.js";
import type { ListMembership } from "../infrastructure/list-membership.repository.js";
import type { ListMembershipRepository } from "../infrastructure/list-membership.repository.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma as PrismaNamespace } from "../../../generated/prisma/client.js";
import { fakeOf } from "../../../test/fake.js";
import { LIST_LIMITS } from "../infrastructure/list-membership.repository.js";
import { ListMembershipService } from "./list-membership.service.js";

const TX = fakeOf<Prisma.TransactionClient>();

function foreignKeyError(): PrismaNamespace.PrismaClientKnownRequestError {
  return new PrismaNamespace.PrismaClientKnownRequestError("Foreign key constraint failed", {
    clientVersion: "test",
    code: "P2003",
  });
}

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LIST_ID = "22222222-2222-4222-8222-222222222222";
const FIRST_BOOK_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_BOOK_ID = "44444444-4444-4444-8444-444444444444";
const THIRD_BOOK_ID = "55555555-5555-4555-8555-555555555555";
const UNRELATED_BOOK_ID = "66666666-6666-4666-8666-666666666666";

type MembershipRepositoryMock = {
  acquireListLock: ReturnType<typeof vi.fn>;
  applyPositions: ReturnType<typeof vi.fn>;
  findActiveMemberships: ReturnType<typeof vi.fn>;
  findMembership: ReturnType<typeof vi.fn>;
  findNeighbor: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  touchList: ReturnType<typeof vi.fn>;
};

function buildService(): {
  listsService: { assertOwned: ReturnType<typeof vi.fn> };
  repository: MembershipRepositoryMock;
  service: ListMembershipService;
} {
  const repository: MembershipRepositoryMock = {
    acquireListLock: vi.fn().mockResolvedValue(undefined),
    applyPositions: vi.fn().mockResolvedValue(undefined),
    findActiveMemberships: vi.fn().mockResolvedValue([]),
    findMembership: vi.fn().mockResolvedValue(null),
    findNeighbor: vi.fn().mockResolvedValue(null),
    setPosition: vi.fn().mockResolvedValue(undefined),
    touchList: vi.fn().mockResolvedValue(undefined),
  };

  const listsService = { assertOwned: vi.fn().mockResolvedValue(undefined) };

  const transactionRunner = {
    run: vi.fn(<T>(handler: (tx: Prisma.TransactionClient) => Promise<T>) => handler(TX)),
  };

  const service = new ListMembershipService(
    listsService as unknown as ListsService,
    repository as unknown as ListMembershipRepository,
    transactionRunner as unknown as TransactionRunner,
  );

  return { listsService, repository, service };
}

function memberships(...positions: Array<[string, number]>): ListMembership[] {
  return positions.map(([bookId, position]) => ({ bookId, position }));
}

describe("ListMembershipService.moveBook to an explicit index", () => {
  it("moves the first book to the last index and leaves a dense ordering", async () => {
    const { repository, service } = buildService();
    repository.findActiveMemberships.mockResolvedValue(
      memberships([FIRST_BOOK_ID, 1], [SECOND_BOOK_ID, 4], [THIRD_BOOK_ID, 7]),
    );

    await service.moveBook({
      bookId: FIRST_BOOK_ID,
      input: { kind: "index", position: 3 },
      listId: LIST_ID,
      userId: USER_ID,
    });

    expect(repository.applyPositions).toHaveBeenCalledWith(TX, {
      listId: LIST_ID,
      positions: [
        { bookId: SECOND_BOOK_ID, position: 1 },
        { bookId: THIRD_BOOK_ID, position: 2 },
        { bookId: FIRST_BOOK_ID, position: 3 },
      ],
    });
  });

  it("clips a target position beyond the list length to the last slot instead of rejecting it", async () => {
    const { repository, service } = buildService();
    repository.findActiveMemberships.mockResolvedValue(
      memberships([FIRST_BOOK_ID, 1], [SECOND_BOOK_ID, 2], [THIRD_BOOK_ID, 3]),
    );

    await service.moveBook({
      bookId: FIRST_BOOK_ID,
      input: { kind: "index", position: 999 },
      listId: LIST_ID,
      userId: USER_ID,
    });

    expect(repository.applyPositions).toHaveBeenCalledWith(TX, {
      listId: LIST_ID,
      positions: [
        { bookId: SECOND_BOOK_ID, position: 1 },
        { bookId: THIRD_BOOK_ID, position: 2 },
        { bookId: FIRST_BOOK_ID, position: 3 },
      ],
    });
  });

  it("shifts the books between the old and the new slot when a book moves up", async () => {
    const { repository, service } = buildService();
    repository.findActiveMemberships.mockResolvedValue(
      memberships([FIRST_BOOK_ID, 1], [SECOND_BOOK_ID, 2], [THIRD_BOOK_ID, 3]),
    );

    await service.moveBook({
      bookId: THIRD_BOOK_ID,
      input: { kind: "index", position: 1 },
      listId: LIST_ID,
      userId: USER_ID,
    });

    expect(repository.applyPositions).toHaveBeenCalledWith(TX, {
      listId: LIST_ID,
      positions: [
        { bookId: THIRD_BOOK_ID, position: 1 },
        { bookId: FIRST_BOOK_ID, position: 2 },
        { bookId: SECOND_BOOK_ID, position: 3 },
      ],
    });
  });

  it("rejects a list larger than the reorder cap before writing anything", async () => {
    const { repository, service } = buildService();
    repository.findActiveMemberships.mockResolvedValue(
      Array.from({ length: LIST_LIMITS.reorderMax + 1 }, (_unused, index) => ({
        bookId: `book-${index}`,
        position: index + 1,
      })),
    );

    await expect(
      service.moveBook({
        bookId: FIRST_BOOK_ID,
        input: { kind: "index", position: 1 },
        listId: LIST_ID,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.applyPositions).not.toHaveBeenCalled();
    expect(repository.setPosition).not.toHaveBeenCalled();
    expect(repository.touchList).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the book is not in the list", async () => {
    const { repository, service } = buildService();
    repository.findActiveMemberships.mockResolvedValue(
      memberships([FIRST_BOOK_ID, 1], [SECOND_BOOK_ID, 2]),
    );

    await expect(
      service.moveBook({
        bookId: UNRELATED_BOOK_ID,
        input: { kind: "index", position: 1 },
        listId: LIST_ID,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.applyPositions).not.toHaveBeenCalled();
  });

  it("advances the list updatedAt after a successful move", async () => {
    const { repository, service } = buildService();
    repository.findActiveMemberships.mockResolvedValue(
      memberships([FIRST_BOOK_ID, 1], [SECOND_BOOK_ID, 2]),
    );

    await service.moveBook({
      bookId: FIRST_BOOK_ID,
      input: { kind: "index", position: 2 },
      listId: LIST_ID,
      userId: USER_ID,
    });

    expect(repository.touchList).toHaveBeenCalledWith(TX, {
      listId: LIST_ID,
      now: expect.any(Date),
      userId: USER_ID,
    });
  });

  it("refuses to move a book in a list the user does not own", async () => {
    const { listsService, repository, service } = buildService();
    listsService.assertOwned.mockRejectedValue(new NotFoundError("List not found"));

    await expect(
      service.moveBook({
        bookId: FIRST_BOOK_ID,
        input: { kind: "index", position: 1 },
        listId: LIST_ID,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.findActiveMemberships).not.toHaveBeenCalled();
  });
});

describe("ListMembershipService.moveBook one step", () => {
  it("swaps the positions of the book and its neighbour above", async () => {
    const { repository, service } = buildService();
    repository.findMembership.mockResolvedValue({ bookId: SECOND_BOOK_ID, position: 4 });
    repository.findNeighbor.mockResolvedValue({ bookId: FIRST_BOOK_ID, position: 1 });

    await service.moveBook({
      bookId: SECOND_BOOK_ID,
      input: { direction: "up", kind: "step" },
      listId: LIST_ID,
      userId: USER_ID,
    });

    expect(repository.setPosition).toHaveBeenNthCalledWith(1, TX, {
      bookId: SECOND_BOOK_ID,
      listId: LIST_ID,
      position: 1,
    });
    expect(repository.setPosition).toHaveBeenNthCalledWith(2, TX, {
      bookId: FIRST_BOOK_ID,
      listId: LIST_ID,
      position: 4,
    });
  });

  it("swaps the positions of the book and its neighbour below", async () => {
    const { repository, service } = buildService();
    repository.findMembership.mockResolvedValue({ bookId: FIRST_BOOK_ID, position: 1 });
    repository.findNeighbor.mockResolvedValue({ bookId: SECOND_BOOK_ID, position: 4 });

    await service.moveBook({
      bookId: FIRST_BOOK_ID,
      input: { direction: "down", kind: "step" },
      listId: LIST_ID,
      userId: USER_ID,
    });

    expect(repository.setPosition).toHaveBeenNthCalledWith(1, TX, {
      bookId: FIRST_BOOK_ID,
      listId: LIST_ID,
      position: 4,
    });
    expect(repository.setPosition).toHaveBeenNthCalledWith(2, TX, {
      bookId: SECOND_BOOK_ID,
      listId: LIST_ID,
      position: 1,
    });
  });

  it("throws BadRequestError when the book is already at the top", async () => {
    const { repository, service } = buildService();
    repository.findMembership.mockResolvedValue({ bookId: FIRST_BOOK_ID, position: 1 });
    repository.findNeighbor.mockResolvedValue(null);

    await expect(
      service.moveBook({
        bookId: FIRST_BOOK_ID,
        input: { direction: "up", kind: "step" },
        listId: LIST_ID,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.setPosition).not.toHaveBeenCalled();
  });

  it("throws BadRequestError when the book is already at the bottom", async () => {
    const { repository, service } = buildService();
    repository.findMembership.mockResolvedValue({ bookId: THIRD_BOOK_ID, position: 7 });
    repository.findNeighbor.mockResolvedValue(null);

    await expect(
      service.moveBook({
        bookId: THIRD_BOOK_ID,
        input: { direction: "down", kind: "step" },
        listId: LIST_ID,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.setPosition).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the book is not in the list", async () => {
    const { repository, service } = buildService();
    repository.findMembership.mockResolvedValue(null);

    await expect(
      service.moveBook({
        bookId: UNRELATED_BOOK_ID,
        input: { direction: "up", kind: "step" },
        listId: LIST_ID,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.findNeighbor).not.toHaveBeenCalled();
  });

  it("does not read the whole list to swap with a neighbour", async () => {
    const { repository, service } = buildService();
    repository.findMembership.mockResolvedValue({ bookId: SECOND_BOOK_ID, position: 2 });
    repository.findNeighbor.mockResolvedValue({ bookId: FIRST_BOOK_ID, position: 1 });

    await service.moveBook({
      bookId: SECOND_BOOK_ID,
      input: { direction: "up", kind: "step" },
      listId: LIST_ID,
      userId: USER_ID,
    });

    expect(repository.findActiveMemberships).not.toHaveBeenCalled();
    expect(repository.applyPositions).not.toHaveBeenCalled();
  });
});

describe("ListMembershipService.addBooks TOCTOU guard", () => {
  it("maps a foreign-key violation from a concurrently-deleted list to NotFoundError", async () => {
    const listsService = {
      assertOwned: vi.fn().mockResolvedValue(undefined),
    } as unknown as ListsService;
    const touchList = vi.fn().mockResolvedValue(undefined);
    const membershipRepository = {
      acquireListLock: vi.fn().mockResolvedValue(undefined),
      append: vi.fn().mockRejectedValue(foreignKeyError()),
      countItems: vi.fn().mockResolvedValue(0),
      findOwnedBookIds: vi.fn().mockResolvedValue([FIRST_BOOK_ID]),
      touchList,
    } as unknown as ListMembershipRepository;
    const transactionRunner = {
      run: vi.fn((fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(TX)),
    } as unknown as TransactionRunner;

    const service = new ListMembershipService(
      listsService,
      membershipRepository,
      transactionRunner,
    );

    await expect(
      service.addBooks({ input: { bookIds: [FIRST_BOOK_ID] }, listId: LIST_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(touchList).not.toHaveBeenCalled();
  });
});
