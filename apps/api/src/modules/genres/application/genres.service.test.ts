import { describe, expect, it, vi } from "vitest";

import type { GenreModel } from "../../../generated/prisma/models.js";
import type { MediaService } from "../../media/index.js";
import type { GenresRepository } from "../infrastructure/genres.repository.js";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { GenresService } from "./genres.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const GENRE_ID = "22222222-2222-4222-8222-222222222222";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function buildService(): {
  mediaService: { buildView: ReturnType<typeof vi.fn> };
  repository: {
    aggregateGenreStats: ReturnType<typeof vi.fn>;
    createCustom: ReturnType<typeof vi.fn>;
    deleteOwnedWithBookCleanup: ReturnType<typeof vi.fn>;
    existsSelectableName: ReturnType<typeof vi.fn>;
    findNamesByKeys: ReturnType<typeof vi.fn>;
    findSelectableKeys: ReturnType<typeof vi.fn>;
    findVisibleByKeys: ReturnType<typeof vi.fn>;
    listAvailable: ReturnType<typeof vi.fn>;
    listGenreCovers: ReturnType<typeof vi.fn>;
    recentGenreKeys: ReturnType<typeof vi.fn>;
  };
  service: GenresService;
} {
  const repository = {
    aggregateGenreStats: vi.fn().mockResolvedValue([]),
    createCustom: vi.fn(),
    deleteOwnedWithBookCleanup: vi.fn(),
    existsSelectableName: vi.fn().mockResolvedValue(false),
    findNamesByKeys: vi.fn().mockResolvedValue([]),
    findSelectableKeys: vi.fn().mockResolvedValue([]),
    findVisibleByKeys: vi.fn().mockResolvedValue([]),
    listAvailable: vi.fn().mockResolvedValue([]),
    listGenreCovers: vi.fn().mockResolvedValue([]),
    recentGenreKeys: vi.fn().mockResolvedValue([]),
  };
  const mediaService = {
    buildView: vi.fn((asset: { id: string }) => ({ urls: { thumb: `https://cdn/${asset.id}` } })),
  };
  const service = new GenresService(
    repository as unknown as GenresRepository,
    mediaService as unknown as MediaService,
  );
  return { mediaService, repository, service };
}

function genre(overrides: Partial<GenreModel> = {}): GenreModel {
  return {
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    groupKey: "fiction",
    groupName: "Fiction",
    id: GENRE_ID,
    isDefault: true,
    key: "fantasy",
    name: "Fantasy",
    normalizedName: "fantasy",
    sortOrder: 0,
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: null,
    ...overrides,
  };
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "7.0.0",
    code: "P2002",
  });
}

describe("GenresService.list", () => {
  it("requests the genres available to the given user", async () => {
    const { repository, service } = buildService();

    await service.list(USER_ID);

    expect(repository.listAvailable).toHaveBeenCalledWith(USER_ID);
  });

  it("maps each model row to the GenreView shape, dropping internal fields", async () => {
    const { repository, service } = buildService();
    repository.listAvailable.mockResolvedValue([genre()]);

    const result = await service.list(USER_ID);

    expect(result).toEqual([
      {
        groupKey: "fiction",
        groupName: "Fiction",
        id: GENRE_ID,
        isDefault: true,
        key: "fantasy",
        name: "Fantasy",
      },
    ]);
  });

  it("preserves the order returned by the repository", async () => {
    const { repository, service } = buildService();
    repository.listAvailable.mockResolvedValue([
      genre({ id: GENRE_ID, key: "sci-fi", name: "Science Fiction" }),
      genre({ id: "33333333-3333-4333-8333-333333333333", key: "fantasy", name: "Fantasy" }),
    ]);

    const result = await service.list(USER_ID);

    expect(result.map((view) => view.key)).toEqual(["sci-fi", "fantasy"]);
  });
});

describe("GenresService.create", () => {
  it("creates a custom genre in the user's custom group and returns the GenreView", async () => {
    const { repository, service } = buildService();
    repository.createCustom.mockResolvedValue(
      genre({
        groupKey: "custom",
        groupName: "Мої жанри",
        isDefault: false,
        key: "44444444-4444-4444-8444-444444444444",
        name: "Мій жанр",
        normalizedName: "мій жанр",
        userId: USER_ID,
      }),
    );

    const result = await service.create(USER_ID, { name: "Мій жанр" });

    expect(repository.existsSelectableName).toHaveBeenCalledWith(USER_ID, "мій жанр");
    expect(repository.createCustom).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        groupKey: "custom",
        groupName: "Мої жанри",
        key: expect.stringMatching(UUID),
        name: "Мій жанр",
        normalizedName: "мій жанр",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ groupKey: "custom", isDefault: false, name: "Мій жанр" }),
    );
  });

  it("throws ConflictError and does not create when a selectable genre with the same name exists", async () => {
    const { repository, service } = buildService();
    repository.existsSelectableName.mockResolvedValue(true);

    await expect(service.create(USER_ID, { name: "Фентезі" })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(repository.createCustom).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint race on insert to ConflictError", async () => {
    const { repository, service } = buildService();
    repository.createCustom.mockRejectedValue(uniqueConstraintError());

    await expect(service.create(USER_ID, { name: "Мій жанр" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("rethrows a non-unique repository error", async () => {
    const { repository, service } = buildService();
    repository.createCustom.mockRejectedValue(new Error("connection lost"));

    await expect(service.create(USER_ID, { name: "Мій жанр" })).rejects.toThrow("connection lost");
  });
});

describe("GenresService.delete", () => {
  it("resolves when the repository removes the owned genre", async () => {
    const { repository, service } = buildService();
    repository.deleteOwnedWithBookCleanup.mockResolvedValue(1);

    await expect(service.delete(USER_ID, GENRE_ID)).resolves.toBeUndefined();
    expect(repository.deleteOwnedWithBookCleanup).toHaveBeenCalledWith(USER_ID, GENRE_ID);
  });

  it("throws NotFoundError when no owned genre was removed", async () => {
    const { repository, service } = buildService();
    repository.deleteOwnedWithBookCleanup.mockResolvedValue(0);

    await expect(service.delete(USER_ID, GENRE_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("GenresService.recent", () => {
  it("returns an empty array without loading catalog rows when no keys are recent", async () => {
    const { repository, service } = buildService();
    repository.recentGenreKeys.mockResolvedValue([]);

    const result = await service.recent({ limit: 8, userId: USER_ID });

    expect(result).toEqual([]);
    expect(repository.findVisibleByKeys).not.toHaveBeenCalled();
  });

  it("preserves the recency order of the keys regardless of the catalog row order", async () => {
    const { repository, service } = buildService();
    repository.recentGenreKeys.mockResolvedValue(["fantasy", "sci-fi", "history"]);
    repository.findVisibleByKeys.mockResolvedValue([
      genre({ id: GENRE_ID, key: "history", name: "History" }),
      genre({ id: "33333333-3333-4333-8333-333333333333", key: "fantasy", name: "Fantasy" }),
      genre({ id: "44444444-4444-4444-8444-444444444444", key: "sci-fi", name: "Science Fiction" }),
    ]);

    const result = await service.recent({ limit: 8, userId: USER_ID });

    expect(result.map((view) => view.key)).toEqual(["fantasy", "sci-fi", "history"]);
  });

  it("drops a recent key that has no visible catalog row", async () => {
    const { repository, service } = buildService();
    repository.recentGenreKeys.mockResolvedValue(["fantasy", "ghost-genre"]);
    repository.findVisibleByKeys.mockResolvedValue([genre({ key: "fantasy", name: "Fantasy" })]);

    const result = await service.recent({ limit: 8, userId: USER_ID });

    expect(result.map((view) => view.key)).toEqual(["fantasy"]);
  });

  it("passes the requested limit and user to the repository", async () => {
    const { repository, service } = buildService();

    await service.recent({ limit: 5, userId: USER_ID });

    expect(repository.recentGenreKeys).toHaveBeenCalledWith({ limit: 5, userId: USER_ID });
  });
});

describe("GenresService.stats", () => {
  it("returns an empty array without loading names or covers when the library has no genres", async () => {
    const { repository, service } = buildService();
    repository.aggregateGenreStats.mockResolvedValue([]);

    const result = await service.stats(USER_ID);

    expect(result).toEqual([]);
    expect(repository.findNamesByKeys).not.toHaveBeenCalled();
    expect(repository.listGenreCovers).not.toHaveBeenCalled();
  });

  it("merges labels, rounds the average rating and falls back to the key when unlabeled", async () => {
    const { repository, service } = buildService();
    repository.aggregateGenreStats.mockResolvedValue([
      {
        averageRating: 4.333333,
        booksCount: 3,
        key: "fantasy",
        readCount: 2,
        readingQueueCount: 1,
        wantToBuyCount: 0,
      },
      {
        averageRating: null,
        booksCount: 1,
        key: "orphan",
        readCount: 0,
        readingQueueCount: 0,
        wantToBuyCount: 1,
      },
    ]);
    repository.findNamesByKeys.mockResolvedValue([{ key: "fantasy", name: "Фентезі" }]);

    const result = await service.stats(USER_ID);

    expect(result).toEqual([
      {
        averageRating: 4.33,
        booksCount: 3,
        coverUrls: [],
        key: "fantasy",
        label: "Фентезі",
        readCount: 2,
        readingQueueCount: 1,
        wantToBuyCount: 0,
      },
      {
        averageRating: null,
        booksCount: 1,
        coverUrls: [],
        key: "orphan",
        label: "orphan",
        readCount: 0,
        readingQueueCount: 0,
        wantToBuyCount: 1,
      },
    ]);
  });

  it("caps cover previews per genre and spreads a shared cover across each of its genres", async () => {
    const { repository, service } = buildService();
    repository.aggregateGenreStats.mockResolvedValue([
      {
        averageRating: null,
        booksCount: 6,
        key: "fantasy",
        readCount: 0,
        readingQueueCount: 0,
        wantToBuyCount: 0,
      },
      {
        averageRating: null,
        booksCount: 1,
        key: "romance",
        readCount: 0,
        readingQueueCount: 0,
        wantToBuyCount: 0,
      },
    ]);
    repository.listGenreCovers.mockResolvedValue([
      { coverMedia: { id: "m1" }, genres: ["fantasy", "romance"] },
      { coverMedia: { id: "m2" }, genres: ["fantasy"] },
      { coverMedia: { id: "m3" }, genres: ["fantasy"] },
      { coverMedia: { id: "m4" }, genres: ["fantasy"] },
      { coverMedia: { id: "m5" }, genres: ["fantasy"] },
    ]);

    const result = await service.stats(USER_ID);
    const fantasy = result.find((entry) => entry.key === "fantasy");
    const romance = result.find((entry) => entry.key === "romance");

    expect(fantasy?.coverUrls).toEqual([
      "https://cdn/m1",
      "https://cdn/m2",
      "https://cdn/m3",
      "https://cdn/m4",
    ]);
    expect(romance?.coverUrls).toEqual(["https://cdn/m1"]);
  });

  it("skips a cover whose view cannot be built", async () => {
    const { mediaService, repository, service } = buildService();
    repository.aggregateGenreStats.mockResolvedValue([
      {
        averageRating: null,
        booksCount: 2,
        key: "fantasy",
        readCount: 0,
        readingQueueCount: 0,
        wantToBuyCount: 0,
      },
    ]);
    repository.listGenreCovers.mockResolvedValue([
      { coverMedia: { id: "broken" }, genres: ["fantasy"] },
      { coverMedia: { id: "ok" }, genres: ["fantasy"] },
    ]);
    mediaService.buildView.mockImplementation((asset: { id: string }) => {
      if (asset.id === "broken") {
        throw new Error("missing storage key");
      }
      return { urls: { thumb: `https://cdn/${asset.id}` } };
    });

    const result = await service.stats(USER_ID);

    expect(result[0]?.coverUrls).toEqual(["https://cdn/ok"]);
  });
});
