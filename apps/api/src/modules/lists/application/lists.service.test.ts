import { describe, expect, it, vi } from "vitest";

import type { BookListModel } from "../../../generated/prisma/models.js";
import type { ListsRepository } from "../infrastructure/lists.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { ListsService } from "./lists.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LIST_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_LIST_ID = "33333333-3333-4333-8333-333333333333";
const FOREIGN_LIST_ID = "44444444-4444-4444-8444-444444444444";

function buildService(): {
  repository: {
    countOwned: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findByNormalized: ReturnType<typeof vi.fn>;
    findOwnedByIds: ReturnType<typeof vi.fn>;
    searchOwned: ReturnType<typeof vi.fn>;
  };
  service: ListsService;
} {
  const repository = {
    countOwned: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    findByNormalized: vi.fn().mockResolvedValue(null),
    findOwnedByIds: vi.fn().mockResolvedValue([]),
    searchOwned: vi.fn().mockResolvedValue([]),
  };

  const service = new ListsService(repository as unknown as ListsRepository);

  return { repository, service };
}

function list(overrides: Partial<BookListModel> = {}): BookListModel {
  return {
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    description: null,
    id: LIST_ID,
    name: "Autumn reads",
    normalizedName: "autumn reads",
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  };
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "test",
    code: "P2002",
  });
}

describe("ListsService.resolveListsForBook", () => {
  it("returns an empty array when no lists are requested", async () => {
    const { repository, service } = buildService();

    const ids = await service.resolveListsForBook(USER_ID, {});

    expect(ids).toEqual([]);
    expect(repository.findOwnedByIds).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("keeps the requested ids that belong to the user", async () => {
    const { repository, service } = buildService();
    repository.findOwnedByIds.mockResolvedValue([
      list({ id: LIST_ID }),
      list({ id: OTHER_LIST_ID, name: "Gifts", normalizedName: "gifts" }),
    ]);

    const ids = await service.resolveListsForBook(USER_ID, {
      listIds: [LIST_ID, OTHER_LIST_ID],
    });

    expect(ids).toEqual([LIST_ID, OTHER_LIST_ID]);
  });

  it("throws NotFoundError when a requested id is not owned by the user", async () => {
    const { repository, service } = buildService();
    repository.findOwnedByIds.mockResolvedValue([list({ id: LIST_ID })]);

    await expect(
      service.resolveListsForBook(USER_ID, { listIds: [LIST_ID, FOREIGN_LIST_ID] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reuses an existing list for a new list with a matching normalized name", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(list({ id: LIST_ID }));

    const ids = await service.resolveListsForBook(USER_ID, {
      newLists: [{ name: "  Autumn   Reads " }],
    });

    expect(ids).toEqual([LIST_ID]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("creates a new list with its description when no match exists", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.create.mockResolvedValue(list({ description: "cozy", id: LIST_ID }));

    const ids = await service.resolveListsForBook(USER_ID, {
      newLists: [{ description: "cozy", name: "Autumn reads" }],
    });

    expect(ids).toEqual([LIST_ID]);
    expect(repository.create).toHaveBeenCalledWith(USER_ID, {
      description: "cozy",
      name: "Autumn reads",
      normalizedName: "autumn reads",
    });
  });

  it("dedups existing and new lists that resolve to the same id", async () => {
    const { repository, service } = buildService();
    repository.findOwnedByIds.mockResolvedValue([list({ id: LIST_ID })]);
    repository.findByNormalized.mockResolvedValue(list({ id: LIST_ID }));

    const ids = await service.resolveListsForBook(USER_ID, {
      listIds: [LIST_ID],
      newLists: [{ name: "Autumn reads" }],
    });

    expect(ids).toEqual([LIST_ID]);
  });

  it("rereads the winning row when create hits a unique violation", async () => {
    const { repository, service } = buildService();
    const winner = list({ id: OTHER_LIST_ID });
    repository.findByNormalized.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    repository.create.mockRejectedValue(uniqueConstraintError());

    const ids = await service.resolveListsForBook(USER_ID, {
      newLists: [{ name: "Autumn reads" }],
    });

    expect(ids).toEqual([OTHER_LIST_ID]);
    expect(repository.findByNormalized).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-unique errors from create", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.create.mockRejectedValue(new Error("connection lost"));

    await expect(
      service.resolveListsForBook(USER_ID, { newLists: [{ name: "Autumn reads" }] }),
    ).rejects.toThrow("connection lost");
  });
});

describe("ListsService.search", () => {
  it("maps the page to a Paginator of BookListView with the search term and coordinates", async () => {
    const { repository, service } = buildService();
    repository.searchOwned.mockResolvedValue([
      list({ description: "cozy", id: LIST_ID, name: "Autumn reads" }),
    ]);
    repository.countOwned.mockResolvedValue(1);

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: "autumn",
    });

    expect(page).toEqual({
      items: [{ description: "cozy", id: LIST_ID, name: "Autumn reads" }],
      page: 1,
      pagesCount: 1,
      pageSize: 10,
      totalCount: 1,
    });
    expect(repository.searchOwned).toHaveBeenCalledWith({
      query: "autumn",
      skip: 0,
      take: 10,
      userId: USER_ID,
    });
    expect(repository.countOwned).toHaveBeenCalledWith(USER_ID, "autumn");
  });
});
