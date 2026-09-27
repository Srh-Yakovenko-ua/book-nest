import type { GenresQuery } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type { MediaService } from "../../media/index.js";
import type { GenreAggregate } from "../domain/genre-aggregate.js";
import type { GenreStatsRepository } from "../infrastructure/genre-stats.repository.js";

import { fakeOf } from "../../../test/fake.js";
import { GenreStatsService } from "./genre-stats.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const DEFAULT_QUERY: GenresQuery = {
  filter: "all",
  pageNumber: 1,
  pageSize: 24,
  sort: "books_count_desc",
};

function aggregate(overrides: Partial<GenreAggregate> & { key: string }): GenreAggregate {
  return {
    averageRating: null,
    booksCount: 1,
    groupKey: "fiction",
    groupName: "Fiction",
    label: overrides.key,
    normalizedName: overrides.key,
    ratedBooksCount: 0,
    readCount: 0,
    readingQueueCount: 0,
    sortOrder: 0,
    wantToBuyCount: 0,
    ...overrides,
  };
}

function asset(id: string): MediaAssetModel {
  return fakeOf<MediaAssetModel>({ id });
}

function buildService(genres: GenreAggregate[]): {
  mediaService: { buildThumbUrlOrNull: ReturnType<typeof vi.fn> };
  repository: {
    aggregateGenres: ReturnType<typeof vi.fn>;
    listCoverPreviews: ReturnType<typeof vi.fn>;
  };
  service: GenreStatsService;
} {
  const repository = {
    aggregateGenres: vi.fn().mockResolvedValue(genres),
    listCoverPreviews: vi.fn().mockResolvedValue([]),
  };
  const mediaService = {
    buildThumbUrlOrNull: vi.fn((cover: MediaAssetModel) =>
      cover.id === "broken" ? null : `https://cdn/${cover.id}`,
    ),
  };
  const service = new GenreStatsService(
    fakeOf<GenreStatsRepository>(repository),
    fakeOf<MediaService>(mediaService),
  );
  return { mediaService, repository, service };
}

describe("GenreStatsService.list", () => {
  it("slices the sorted result and requests covers only for the page keys in one call", async () => {
    const { repository, service } = buildService([
      aggregate({ booksCount: 1, key: "c" }),
      aggregate({ booksCount: 3, key: "a" }),
      aggregate({ booksCount: 2, key: "b" }),
    ]);

    const result = await service.list({
      query: { ...DEFAULT_QUERY, pageNumber: 2, pageSize: 2 },
      userId: USER_ID,
    });

    expect(result).toMatchObject({ page: 2, pagesCount: 2, pageSize: 2, totalCount: 3 });
    expect(result.items.map((item) => item.key)).toEqual(["c"]);
    expect(repository.listCoverPreviews).toHaveBeenCalledTimes(1);
    expect(repository.listCoverPreviews).toHaveBeenCalledWith({
      keys: ["c"],
      limitPerGenre: 4,
      userId: USER_ID,
    });
  });

  it("counts the total after search, advanced and quick filters but before pagination", async () => {
    const { service } = buildService([
      aggregate({ booksCount: 4, key: "fantasy", readingQueueCount: 1 }),
      aggregate({ booksCount: 1, key: "fairy", readingQueueCount: 1 }),
      aggregate({ booksCount: 5, key: "history", readingQueueCount: 1 }),
      aggregate({ booksCount: 6, key: "farce" }),
    ]);

    const result = await service.list({
      query: { ...DEFAULT_QUERY, booksMin: 2, filter: "in_queue", pageSize: 1, q: "fa" },
      userId: USER_ID,
    });

    expect(result.totalCount).toBe(1);
    expect(result.items.map((item) => item.key)).toEqual(["fantasy"]);
  });

  it("attaches cover thumbnails per genre and skips covers without a usable view", async () => {
    const { repository, service } = buildService([aggregate({ booksCount: 2, key: "fantasy" })]);
    repository.listCoverPreviews.mockResolvedValue([
      { coverMedia: asset("first"), genreKey: "fantasy" },
      { coverMedia: asset("broken"), genreKey: "fantasy" },
      { coverMedia: asset("second"), genreKey: "fantasy" },
    ]);

    const result = await service.list({ query: DEFAULT_QUERY, userId: USER_ID });

    expect(result.items[0]?.coverUrls).toEqual(["https://cdn/first", "https://cdn/second"]);
  });
});

describe("GenreStatsService.facets", () => {
  it("narrows quick counts by the criteria while keeping every represented group", async () => {
    const { service } = buildService([
      aggregate({ groupKey: "fiction", groupName: "Художні", key: "fantasy", readCount: 1 }),
      aggregate({ groupKey: "nonfiction", groupName: "Нехудожні", key: "history", sortOrder: 5 }),
    ]);

    const result = await service.facets({ query: { group: ["fiction"] }, userId: USER_ID });

    expect(result).toEqual({
      groups: [
        { key: "fiction", label: "Художні" },
        { key: "nonfiction", label: "Нехудожні" },
      ],
      quickCounts: { all: 1, finished: 1, in_queue: 0, unread: 0, want_to_buy: 0 },
    });
  });
});
