import { describe, expect, it, vi } from "vitest";

import type { GenreModel } from "../../../generated/prisma/models.js";
import type { GenresRepository } from "../infrastructure/genres.repository.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { fakeOf } from "../../../test/fake.js";
import { GenresService } from "./genres.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const GENRE_ID = "22222222-2222-4222-8222-222222222222";

function buildService(): {
  repository: {
    findSystemByKeys: ReturnType<typeof vi.fn>;
    findSystemKeys: ReturnType<typeof vi.fn>;
    findSystemKeysByName: ReturnType<typeof vi.fn>;
    findSystemNamesByKeys: ReturnType<typeof vi.fn>;
    listSystem: ReturnType<typeof vi.fn>;
    recentGenreKeys: ReturnType<typeof vi.fn>;
  };
  service: GenresService;
} {
  const repository = {
    findSystemByKeys: vi.fn().mockResolvedValue([]),
    findSystemKeys: vi.fn().mockResolvedValue([]),
    findSystemKeysByName: vi.fn().mockResolvedValue([]),
    findSystemNamesByKeys: vi.fn().mockResolvedValue([]),
    listSystem: vi.fn().mockResolvedValue([]),
    recentGenreKeys: vi.fn().mockResolvedValue([]),
  };
  const service = new GenresService(fakeOf<GenresRepository>(repository));
  return { repository, service };
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

describe("GenresService.list", () => {
  it("maps each system catalog row to the GenreView shape in repository order", async () => {
    const { repository, service } = buildService();
    repository.listSystem.mockResolvedValue([
      genre({ key: "sci-fi", name: "Science Fiction" }),
      genre({ key: "fantasy", name: "Fantasy" }),
    ]);

    const result = await service.list();

    expect(result).toEqual([
      {
        groupKey: "fiction",
        groupName: "Fiction",
        id: GENRE_ID,
        isDefault: true,
        key: "sci-fi",
        name: "Science Fiction",
      },
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
});

describe("GenresService.assertGenresSelectable", () => {
  it("does not query the catalog for an empty key list", async () => {
    const { repository, service } = buildService();

    await service.assertGenresSelectable([]);

    expect(repository.findSystemKeys).not.toHaveBeenCalled();
  });

  it("resolves when every key exists in the system catalog", async () => {
    const { repository, service } = buildService();
    repository.findSystemKeys.mockResolvedValue(["fantasy", "romance"]);

    await expect(service.assertGenresSelectable(["fantasy", "romance"])).resolves.toBeUndefined();
    expect(repository.findSystemKeys).toHaveBeenCalledWith(["fantasy", "romance"]);
  });

  it("rejects unknown keys with a field error per offending index", async () => {
    const { repository, service } = buildService();
    repository.findSystemKeys.mockResolvedValue(["fantasy"]);

    const error = await service
      .assertGenresSelectable(["fantasy", "ghost", "custom"])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestError);
    expect(error).toMatchObject({
      fields: [
        { field: "genres.1", message: "Unknown genre: ghost" },
        { field: "genres.2", message: "Unknown genre: custom" },
      ],
    });
  });
});

describe("GenresService.recent", () => {
  it("returns an empty array without loading catalog rows when no keys are recent", async () => {
    const { repository, service } = buildService();

    const result = await service.recent({ limit: 8, userId: USER_ID });

    expect(result).toEqual([]);
    expect(repository.findSystemByKeys).not.toHaveBeenCalled();
  });

  it("preserves the recency order of the keys regardless of the catalog row order", async () => {
    const { repository, service } = buildService();
    repository.recentGenreKeys.mockResolvedValue(["romance", "fantasy"]);
    repository.findSystemByKeys.mockResolvedValue([
      genre({ key: "fantasy", name: "Fantasy" }),
      genre({ key: "romance", name: "Romance" }),
    ]);

    const result = await service.recent({ limit: 8, userId: USER_ID });

    expect(result.map((entry) => entry.key)).toEqual(["romance", "fantasy"]);
    expect(repository.recentGenreKeys).toHaveBeenCalledWith({ limit: 8, userId: USER_ID });
  });

  it("drops a recent key that has no system catalog row", async () => {
    const { repository, service } = buildService();
    repository.recentGenreKeys.mockResolvedValue(["fantasy", "ghost"]);
    repository.findSystemByKeys.mockResolvedValue([genre()]);

    const result = await service.recent({ limit: 8, userId: USER_ID });

    expect(result.map((entry) => entry.key)).toEqual(["fantasy"]);
  });
});

describe("GenresService lookups", () => {
  it("resolves names against the system catalog only", async () => {
    const { repository, service } = buildService();
    repository.findSystemNamesByKeys.mockResolvedValue([{ key: "fantasy", name: "Fantasy" }]);

    const result = await service.findNamesByKeys(["fantasy"]);

    expect(result).toEqual([{ key: "fantasy", name: "Fantasy" }]);
    expect(repository.findSystemNamesByKeys).toHaveBeenCalledWith(["fantasy"]);
  });

  it("searches keys by name against the system catalog only", async () => {
    const { repository, service } = buildService();
    repository.findSystemKeysByName.mockResolvedValue(["fantasy"]);

    const result = await service.searchKeys("фент");

    expect(result).toEqual(["fantasy"]);
    expect(repository.findSystemKeysByName).toHaveBeenCalledWith("фент");
  });
});
