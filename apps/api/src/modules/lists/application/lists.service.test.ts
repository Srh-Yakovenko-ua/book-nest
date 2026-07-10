import type { MediaView, Nullable } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { BookListModel, MediaAssetModel } from "../../../generated/prisma/models.js";
import type { MediaService } from "../../media/index.js";
import type { BookListCard } from "../infrastructure/lists.repository.js";
import type { ListsRepository } from "../infrastructure/lists.repository.js";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { ListsService } from "./lists.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LIST_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_LIST_ID = "33333333-3333-4333-8333-333333333333";
const FOREIGN_LIST_ID = "44444444-4444-4444-8444-444444444444";
const COVER_ID = "55555555-5555-4555-8555-555555555555";

function buildService(): {
  mediaService: { buildView: ReturnType<typeof vi.fn> };
  repository: {
    countOwned: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    deleteOwned: ReturnType<typeof vi.fn>;
    findByNormalized: ReturnType<typeof vi.fn>;
    findOwnedById: ReturnType<typeof vi.fn>;
    findOwnedByIds: ReturnType<typeof vi.fn>;
    searchOwnedCards: ReturnType<typeof vi.fn>;
    updateOwned: ReturnType<typeof vi.fn>;
    upsertByNormalized: ReturnType<typeof vi.fn>;
  };
  service: ListsService;
} {
  const repository = {
    countOwned: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    deleteOwned: vi.fn().mockResolvedValue(1),
    findByNormalized: vi.fn().mockResolvedValue(null),
    findOwnedById: vi.fn().mockResolvedValue(null),
    findOwnedByIds: vi.fn().mockResolvedValue([]),
    searchOwnedCards: vi.fn().mockResolvedValue([]),
    updateOwned: vi.fn(),
    upsertByNormalized: vi.fn(),
  };

  const mediaService = { buildView: vi.fn().mockReturnValue(mediaView()) };

  const service = new ListsService(
    repository as unknown as ListsRepository,
    mediaService as unknown as MediaService,
  );

  return { mediaService, repository, service };
}

function card(overrides: Partial<BookListCard> = {}): BookListCard {
  return {
    _count: { items: 0 },
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    description: null,
    id: LIST_ID,
    items: [],
    name: "Autumn reads",
    normalizedName: "autumn reads",
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
    description: null,
    id: LIST_ID,
    name: "Autumn reads",
    normalizedName: "autumn reads",
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

    const ids = await service.resolveListsForBook({ input: {}, userId: USER_ID });

    expect(ids).toEqual([]);
    expect(repository.findOwnedByIds).not.toHaveBeenCalled();
    expect(repository.upsertByNormalized).not.toHaveBeenCalled();
  });

  it("keeps the requested ids that belong to the user", async () => {
    const { repository, service } = buildService();
    repository.findOwnedByIds.mockResolvedValue([
      list({ id: LIST_ID }),
      list({ id: OTHER_LIST_ID, name: "Gifts", normalizedName: "gifts" }),
    ]);

    const ids = await service.resolveListsForBook({
      input: { listIds: [LIST_ID, OTHER_LIST_ID] },
      userId: USER_ID,
    });

    expect(ids).toEqual([LIST_ID, OTHER_LIST_ID]);
  });

  it("throws NotFoundError when a requested id is not owned by the user", async () => {
    const { repository, service } = buildService();
    repository.findOwnedByIds.mockResolvedValue([list({ id: LIST_ID })]);

    await expect(
      service.resolveListsForBook({
        input: { listIds: [LIST_ID, FOREIGN_LIST_ID] },
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reuses an existing list for a new list with a matching normalized name", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(list({ id: LIST_ID }));

    const ids = await service.resolveListsForBook({
      input: { newLists: [{ name: "  Autumn   Reads " }] },
      userId: USER_ID,
    });

    expect(ids).toEqual([LIST_ID]);
    expect(repository.upsertByNormalized).not.toHaveBeenCalled();
  });

  it("upserts a new list with its description when no match exists", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.upsertByNormalized.mockResolvedValue(list({ description: "cozy", id: LIST_ID }));

    const ids = await service.resolveListsForBook({
      input: { newLists: [{ description: "cozy", name: "Autumn reads" }] },
      userId: USER_ID,
    });

    expect(ids).toEqual([LIST_ID]);
    expect(repository.upsertByNormalized).toHaveBeenCalledWith(
      {
        data: {
          description: "cozy",
          name: "Autumn reads",
          normalizedName: "autumn reads",
        },
        userId: USER_ID,
      },
      undefined,
    );
  });

  it("dedups existing and new lists that resolve to the same id", async () => {
    const { repository, service } = buildService();
    repository.findOwnedByIds.mockResolvedValue([list({ id: LIST_ID })]);
    repository.findByNormalized.mockResolvedValue(list({ id: LIST_ID }));

    const ids = await service.resolveListsForBook({
      input: { listIds: [LIST_ID], newLists: [{ name: "Autumn reads" }] },
      userId: USER_ID,
    });

    expect(ids).toEqual([LIST_ID]);
  });

  it("returns the row the upsert resolves when no prior match exists", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.upsertByNormalized.mockResolvedValue(list({ id: OTHER_LIST_ID }));

    const ids = await service.resolveListsForBook({
      input: { newLists: [{ name: "Autumn reads" }] },
      userId: USER_ID,
    });

    expect(ids).toEqual([OTHER_LIST_ID]);
  });

  it("propagates errors raised by the upsert", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.upsertByNormalized.mockRejectedValue(new Error("connection lost"));

    await expect(
      service.resolveListsForBook({
        input: { newLists: [{ name: "Autumn reads" }] },
        userId: USER_ID,
      }),
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

describe("ListsService.delete", () => {
  it("throws NotFoundError when nothing was deleted", async () => {
    const { repository, service } = buildService();
    repository.deleteOwned.mockResolvedValue(0);

    await expect(service.delete({ listId: LIST_ID, userId: USER_ID })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("resolves when a list was deleted", async () => {
    const { repository, service } = buildService();
    repository.deleteOwned.mockResolvedValue(1);

    await expect(service.delete({ listId: LIST_ID, userId: USER_ID })).resolves.toBeUndefined();
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
      query: { pageNumber: 1, pageSize: 10, search: "autumn", sort: "updated_desc" },
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
    expect(mediaService.buildView).toHaveBeenCalledTimes(1);
    expect(repository.searchOwnedCards).toHaveBeenCalledWith({
      query: "autumn",
      skip: 0,
      sort: "updated_desc",
      take: 10,
      userId: USER_ID,
    });
    expect(repository.countOwned).toHaveBeenCalledWith({ query: "autumn", userId: USER_ID });
  });
});
