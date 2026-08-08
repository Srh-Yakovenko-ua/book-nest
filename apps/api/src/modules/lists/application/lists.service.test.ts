import type { MediaView, Nullable } from "@app/shared";

import { LIST_NAME_MAX } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { BookListModel, MediaAssetModel } from "../../../generated/prisma/models.js";
import type { MediaService } from "../../media/index.js";
import type { BookListCard } from "../infrastructure/lists.repository.js";
import type { ListsRepository } from "../infrastructure/lists.repository.js";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { fakeOf } from "../../../test/fake.js";
import { ListsService } from "./lists.service.js";

const TX = fakeOf<Prisma.TransactionClient>();

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LIST_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_LIST_ID = "33333333-3333-4333-8333-333333333333";
const FOREIGN_LIST_ID = "44444444-4444-4444-8444-444444444444";
const COVER_ID = "55555555-5555-4555-8555-555555555555";

function buildService(): {
  mediaService: { buildViewOrNull: ReturnType<typeof vi.fn> };
  repository: {
    acquireCreateLock: ReturnType<typeof vi.fn>;
    copyItems: ReturnType<typeof vi.fn>;
    countOwned: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createByNormalized: ReturnType<typeof vi.fn>;
    findByNormalized: ReturnType<typeof vi.fn>;
    findOwnedById: ReturnType<typeof vi.fn>;
    findOwnedByIds: ReturnType<typeof vi.fn>;
    findOwnedCardById: ReturnType<typeof vi.fn>;
    searchOwnedCards: ReturnType<typeof vi.fn>;
    updateOwned: ReturnType<typeof vi.fn>;
  };
  service: ListsService;
  transactionRunner: { run: ReturnType<typeof vi.fn> };
} {
  const repository = {
    acquireCreateLock: vi.fn().mockResolvedValue(undefined),
    copyItems: vi.fn().mockResolvedValue(0),
    countOwned: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    createByNormalized: vi.fn(),
    findByNormalized: vi.fn().mockResolvedValue(null),
    findOwnedById: vi.fn().mockResolvedValue(null),
    findOwnedByIds: vi.fn().mockResolvedValue([]),
    findOwnedCardById: vi.fn().mockResolvedValue(null),
    searchOwnedCards: vi.fn().mockResolvedValue([]),
    updateOwned: vi.fn(),
  };

  const mediaService = {
    buildViewOrNull: vi.fn((asset: Nullable<MediaAssetModel>) =>
      asset === null ? null : mediaView(),
    ),
  };

  const transactionRunner = {
    run: vi.fn(<T>(handler: (tx: unknown) => Promise<T>) => handler(repository)),
  };

  const service = new ListsService(
    repository as unknown as ListsRepository,
    mediaService as unknown as MediaService,
    transactionRunner as unknown as TransactionRunner,
  );

  return { mediaService, repository, service, transactionRunner };
}

function card(overrides: Partial<BookListCard> = {}): BookListCard {
  return {
    _count: { items: 0 },
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    deletedAt: null,
    description: null,
    id: LIST_ID,
    items: [],
    name: "Autumn reads",
    normalizedName: "autumn reads",
    purgeAt: null,
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  };
}

function cardItem(coverMedia: Nullable<MediaAssetModel>): BookListCard["items"][number] {
  return {
    addedAt: new Date("2026-02-01T10:00:00.000Z"),
    book: { coverMedia },
    bookId: "66666666-6666-4666-8666-666666666666",
    listId: LIST_ID,
    position: 0,
  };
}

function coverAsset(): MediaAssetModel {
  return {
    contentType: "image/webp",
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    height: 900,
    id: COVER_ID,
    kind: "book_cover",
    originalName: null,
    sizeBytes: 1000,
    storageKey: "media/book_cover/cover/image.webp",
    thumbGeneratedAt: new Date("2026-02-01T10:00:00.000Z"),
    userId: USER_ID,
    width: 600,
  };
}

function list(overrides: Partial<BookListModel> = {}): BookListModel {
  return {
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    deletedAt: null,
    description: null,
    id: LIST_ID,
    name: "Autumn reads",
    normalizedName: "autumn reads",
    purgeAt: null,
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  };
}

function mediaView(): MediaView {
  return {
    contentType: "image/webp",
    createdAt: "2026-02-01T10:00:00.000Z",
    height: 900,
    id: COVER_ID,
    kind: "book_cover",
    name: null,
    sizeBytes: 1000,
    urls: { card: "card", full: "full", thumb: "thumb" },
    width: 600,
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

    const ids = await service.resolveListsForBook({ input: {}, userId: USER_ID }, TX);

    expect(ids).toEqual([]);
    expect(repository.findOwnedByIds).not.toHaveBeenCalled();
    expect(repository.createByNormalized).not.toHaveBeenCalled();
  });

  it("keeps the requested ids that belong to the user", async () => {
    const { repository, service } = buildService();
    repository.findOwnedByIds.mockResolvedValue([
      list({ id: LIST_ID }),
      list({ id: OTHER_LIST_ID, name: "Gifts", normalizedName: "gifts" }),
    ]);

    const ids = await service.resolveListsForBook(
      {
        input: { listIds: [LIST_ID, OTHER_LIST_ID] },
        userId: USER_ID,
      },
      TX,
    );

    expect(ids).toEqual([LIST_ID, OTHER_LIST_ID]);
  });

  it("throws NotFoundError when a requested id is not owned by the user", async () => {
    const { repository, service } = buildService();
    repository.findOwnedByIds.mockResolvedValue([list({ id: LIST_ID })]);

    await expect(
      service.resolveListsForBook(
        {
          input: { listIds: [LIST_ID, FOREIGN_LIST_ID] },
          userId: USER_ID,
        },
        TX,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reuses an existing list for a new list with a matching normalized name", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(list({ id: LIST_ID }));

    const ids = await service.resolveListsForBook(
      {
        input: { newLists: [{ name: "  Autumn   Reads " }] },
        userId: USER_ID,
      },
      TX,
    );

    expect(ids).toEqual([LIST_ID]);
    expect(repository.createByNormalized).not.toHaveBeenCalled();
  });

  it("creates a new list with its description when no match exists", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.createByNormalized.mockResolvedValue(list({ description: "cozy", id: LIST_ID }));

    const ids = await service.resolveListsForBook(
      {
        input: { newLists: [{ description: "cozy", name: "Autumn reads" }] },
        userId: USER_ID,
      },
      TX,
    );

    expect(ids).toEqual([LIST_ID]);
    expect(repository.createByNormalized).toHaveBeenCalledWith(
      {
        data: {
          description: "cozy",
          name: "Autumn reads",
          normalizedName: "autumn reads",
        },
        userId: USER_ID,
      },
      TX,
    );
  });

  it("dedups existing and new lists that resolve to the same id", async () => {
    const { repository, service } = buildService();
    repository.findOwnedByIds.mockResolvedValue([list({ id: LIST_ID })]);
    repository.findByNormalized.mockResolvedValue(list({ id: LIST_ID }));

    const ids = await service.resolveListsForBook(
      {
        input: { listIds: [LIST_ID], newLists: [{ name: "Autumn reads" }] },
        userId: USER_ID,
      },
      TX,
    );

    expect(ids).toEqual([LIST_ID]);
  });

  it("returns the row the create resolves when no prior match exists", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.createByNormalized.mockResolvedValue(list({ id: OTHER_LIST_ID }));

    const ids = await service.resolveListsForBook(
      {
        input: { newLists: [{ name: "Autumn reads" }] },
        userId: USER_ID,
      },
      TX,
    );

    expect(ids).toEqual([OTHER_LIST_ID]);
  });

  it("propagates errors raised by the create", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.createByNormalized.mockRejectedValue(new Error("connection lost"));

    await expect(
      service.resolveListsForBook(
        {
          input: { newLists: [{ name: "Autumn reads" }] },
          userId: USER_ID,
        },
        TX,
      ),
    ).rejects.toThrow("connection lost");
  });
});

describe("ListsService.create", () => {
  it("maps a freshly created list to a card with an empty preview and zero count", async () => {
    const { repository, service } = buildService();
    repository.create.mockResolvedValue(card({ description: "cozy" }));

    const result = await service.create({
      input: { description: "cozy", name: "Autumn reads" },
      userId: USER_ID,
    });

    expect(result).toEqual({
      bookCount: 0,
      createdAt: "2026-02-01T10:00:00.000Z",
      description: "cozy",
      id: LIST_ID,
      name: "Autumn reads",
      previewCovers: [],
      updatedAt: "2026-02-02T11:00:00.000Z",
    });
  });

  it("throws ConflictError when a list with the same normalized name exists", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(list());

    await expect(
      service.create({ input: { name: "Autumn reads" }, userId: USER_ID }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("maps a unique violation on create to a ConflictError", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.create.mockRejectedValue(uniqueConstraintError());

    await expect(
      service.create({ input: { name: "Autumn reads" }, userId: USER_ID }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("ListsService.update", () => {
  it("throws NotFoundError when the list is missing or foreign", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(null);

    await expect(
      service.update({ input: { name: "Autumn reads" }, listId: LIST_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not error when the name is unchanged on the same list", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(list());
    repository.findByNormalized.mockResolvedValue(list());
    repository.updateOwned.mockResolvedValue(card({ name: "Autumn reads" }));

    await expect(
      service.update({ input: { name: "Autumn reads" }, listId: LIST_ID, userId: USER_ID }),
    ).resolves.toMatchObject({ id: LIST_ID, name: "Autumn reads" });
  });

  it("throws ConflictError when the new name collides with a different list", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(list());
    repository.findByNormalized.mockResolvedValue(list({ id: OTHER_LIST_ID }));

    await expect(
      service.update({ input: { name: "Gifts" }, listId: LIST_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repository.updateOwned).not.toHaveBeenCalled();
  });
});

describe("ListsService.duplicate", () => {
  it("names the first copy with a bare copy suffix", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(list({ name: "Autumn reads" }));
    repository.create.mockResolvedValue(card({ id: OTHER_LIST_ID }));
    repository.findOwnedCardById.mockResolvedValue(card({ id: OTHER_LIST_ID }));

    await service.duplicate({ listId: LIST_ID, userId: USER_ID });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Autumn reads (копія)" }),
      }),
      expect.anything(),
    );
  });

  it("names the copy with a numbered suffix when the bare copy name is taken", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(list({ name: "Autumn reads" }));
    repository.findByNormalized.mockImplementation(
      ({ normalizedName }: { normalizedName: string }) =>
        Promise.resolve(normalizedName === "autumn reads (копія)" ? list() : null),
    );
    repository.create.mockResolvedValue(card({ id: OTHER_LIST_ID }));
    repository.findOwnedCardById.mockResolvedValue(card({ id: OTHER_LIST_ID }));

    await service.duplicate({ listId: LIST_ID, userId: USER_ID });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Autumn reads (копія 2)" }),
      }),
      expect.anything(),
    );
  });

  it("walks the numbered suffix past every taken copy name", async () => {
    const { repository, service } = buildService();
    const taken = new Set(["autumn reads (копія 2)", "autumn reads (копія)"]);
    repository.findOwnedById.mockResolvedValue(list({ name: "Autumn reads" }));
    repository.findByNormalized.mockImplementation(
      ({ normalizedName }: { normalizedName: string }) =>
        Promise.resolve(taken.has(normalizedName) ? list() : null),
    );
    repository.create.mockResolvedValue(card({ id: OTHER_LIST_ID }));
    repository.findOwnedCardById.mockResolvedValue(card({ id: OTHER_LIST_ID }));

    await service.duplicate({ listId: LIST_ID, userId: USER_ID });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Autumn reads (копія 3)" }),
      }),
      expect.anything(),
    );
  });

  it("throws ConflictError instead of looping forever when 50 copy names are taken", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(list({ name: "Autumn reads" }));
    repository.findByNormalized.mockResolvedValue(list());

    await expect(service.duplicate({ listId: LIST_ID, userId: USER_ID })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(repository.findByNormalized).toHaveBeenCalledTimes(50);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("carries the description of the source list into the copy", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(list({ description: "cozy autumn picks" }));
    repository.create.mockResolvedValue(
      card({ description: "cozy autumn picks", id: OTHER_LIST_ID }),
    );
    repository.findOwnedCardById.mockResolvedValue(
      card({ description: "cozy autumn picks", id: OTHER_LIST_ID }),
    );

    const result = await service.duplicate({ listId: LIST_ID, userId: USER_ID });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: "cozy autumn picks" }),
      }),
      expect.anything(),
    );
    expect(result.description).toBe("cozy autumn picks");
  });

  it("copies the memberships of the source list into the created copy", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(list());
    repository.create.mockResolvedValue(card({ id: OTHER_LIST_ID }));
    repository.findOwnedCardById.mockResolvedValue(card({ id: OTHER_LIST_ID }));

    await service.duplicate({ listId: LIST_ID, userId: USER_ID });

    expect(repository.copyItems).toHaveBeenCalledWith(
      { sourceListId: LIST_ID, targetListId: OTHER_LIST_ID },
      expect.anything(),
    );
  });

  it("throws NotFoundError when the source list is missing or foreign", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(null);

    await expect(
      service.duplicate({ listId: FOREIGN_LIST_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("keeps the copy name within the length the rename form accepts", async () => {
    const { repository, service } = buildService();
    const longName = "a".repeat(LIST_NAME_MAX);
    repository.findOwnedById.mockResolvedValue(list({ name: longName }));
    repository.create.mockResolvedValue(card({ id: OTHER_LIST_ID }));
    repository.findOwnedCardById.mockResolvedValue(card({ id: OTHER_LIST_ID }));

    await service.duplicate({ listId: LIST_ID, userId: USER_ID });

    const copySuffix = " (копія)";
    const expectedName = `${"a".repeat(LIST_NAME_MAX - copySuffix.length)}${copySuffix}`;
    expect(expectedName).toHaveLength(LIST_NAME_MAX);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: expectedName }) }),
      expect.anything(),
    );
  });

  it("reports a conflict instead of a server error when the copy name is taken mid-flight", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(list());
    repository.create.mockRejectedValue(uniqueConstraintError());

    await expect(service.duplicate({ listId: LIST_ID, userId: USER_ID })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe("ListsService.search", () => {
  it("maps the page to a Paginator of CustomListCard with covers and counts", async () => {
    const { mediaService, repository, service } = buildService();
    repository.searchOwnedCards.mockResolvedValue([
      card({
        _count: { items: 3 },
        description: "cozy",
        items: [cardItem(coverAsset()), cardItem(null)],
      }),
    ]);
    repository.countOwned.mockResolvedValue(1);

    const page = await service.search({
      query: {
        description: ["with_description"],
        fill: ["with_books"],
        pageNumber: 1,
        pageSize: 10,
        search: "autumn",
        size: ["small"],
        sort: "updated_desc",
      },
      userId: USER_ID,
    });

    expect(page).toEqual({
      items: [
        {
          bookCount: 3,
          createdAt: "2026-02-01T10:00:00.000Z",
          description: "cozy",
          id: LIST_ID,
          name: "Autumn reads",
          previewCovers: [mediaView()],
          updatedAt: "2026-02-02T11:00:00.000Z",
        },
      ],
      page: 1,
      pagesCount: 1,
      pageSize: 10,
      totalCount: 1,
    });
    expect(mediaService.buildViewOrNull).toHaveBeenCalledTimes(2);
    expect(repository.searchOwnedCards).toHaveBeenCalledWith({
      attention: undefined,
      description: ["with_description"],
      fill: ["with_books"],
      now: expect.any(Date),
      query: "autumn",
      size: ["small"],
      skip: 0,
      sort: "updated_desc",
      take: 10,
      userId: USER_ID,
    });
    expect(repository.countOwned).toHaveBeenCalledWith({
      attention: undefined,
      description: ["with_description"],
      fill: ["with_books"],
      now: expect.any(Date),
      query: "autumn",
      size: ["small"],
      userId: USER_ID,
    });
  });
});
