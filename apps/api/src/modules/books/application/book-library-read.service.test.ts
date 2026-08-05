import type { FavoritesSummaryView } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { GenresService } from "../../genres/application/genres.service.js";
import type { MediaService } from "../../media/application/media.service.js";
import type {
  ActiveReadingRow,
  BooksRepository,
  BookWithRelations,
} from "../infrastructure/books.repository.js";

import { fakeOf } from "../../../test/fake.js";
import { BookLibraryReadService } from "./book-library-read.service.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PUBLISHER_ID = "44444444-4444-4444-8444-444444444444";

function bookRow(overrides: Partial<BookWithRelations> = {}): BookWithRelations {
  return {
    ageCategory: "not_specified",
    authors: [
      {
        author: { id: AUTHOR_ID, name: "Frank Herbert", normalizedName: "frank herbert" },
        authorId: AUTHOR_ID,
        bookId: BOOK_ID,
        position: 0,
      },
    ] as BookWithRelations["authors"],
    coverMedia: null,
    coverMediaId: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    dedication: null,
    deliveries: [],
    description: null,
    favoriteAddedAt: null,
    firstAuthorName: "Frank Herbert",
    formats: [],
    genres: [],
    id: BOOK_ID,
    illustrator: null,
    isbn: null,
    isFavorite: false,
    isFavoriteDedication: false,
    language: "ukrainian",
    lists: [],
    loans: [],
    originalTitle: null,
    ownershipStatus: "none",
    pagesCount: null,
    pagesCountUnavailable: false,
    partNumber: null,
    publicationYear: null,
    publisher: { id: PUBLISHER_ID, name: "Penguin", normalizedName: "penguin" },
    publisherId: PUBLISHER_ID,
    purchaseInfo: null,
    queuePosition: null,
    queuePriority: null,
    queuePriorityReason: null,
    queuePriorityReasonCustomText: null,
    queuePriorityTargetDate: null,
    readingProgress: null,
    readingStatus: "not_started",
    series: null,
    seriesId: null,
    tags: [],
    title: "Dune",
    translator: null,
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  } as BookWithRelations;
}

function buildReadService(
  overrides: {
    countForLibrary?: number;
    favoritesSummary?: FavoritesSummaryView;
    listForLibrary?: BookWithRelations[];
    recentPurchaseStores?: string[];
  } = {},
): {
  genresService: {
    findNamesByKeys: ReturnType<typeof vi.fn>;
    searchKeys: ReturnType<typeof vi.fn>;
  };
  repository: {
    countForLibrary: ReturnType<typeof vi.fn>;
    favoritesSummary: ReturnType<typeof vi.fn>;
    listForLibrary: ReturnType<typeof vi.fn>;
    recentPurchaseStores: ReturnType<typeof vi.fn>;
  };
  service: BookLibraryReadService;
} {
  const repository = {
    countForLibrary: vi.fn().mockResolvedValue(overrides.countForLibrary ?? 0),
    favoritesSummary: vi.fn().mockResolvedValue(
      overrides.favoritesSummary ?? {
        averageRating: null,
        finished: 0,
        reading: 0,
        series: 0,
        solo: 0,
        total: 0,
        wantToRead: 0,
      },
    ),
    listForLibrary: vi.fn().mockResolvedValue(overrides.listForLibrary ?? []),
    recentPurchaseStores: vi.fn().mockResolvedValue(overrides.recentPurchaseStores ?? []),
  };

  const mediaService = { buildViewOrNull: vi.fn().mockReturnValue(null) };
  const viewAssembler = new BookViewAssembler(
    fakeOf<BooksRepository>(repository),
    fakeOf<MediaService>(mediaService),
  );
  const genresService = {
    findNamesByKeys: vi.fn().mockResolvedValue([]),
    searchKeys: vi.fn().mockResolvedValue([]),
  };

  const service = new BookLibraryReadService(
    fakeOf<BooksRepository>(repository),
    viewAssembler,
    fakeOf<GenresService>(genresService),
  );

  return { genresService, repository, service };
}

describe("BookLibraryReadService.list", () => {
  it("maps the page to a Paginator of BookView with the correct counts", async () => {
    const { service } = buildReadService({
      countForLibrary: 3,
      listForLibrary: [bookRow({ id: BOOK_ID })],
    });

    const page = await service.list({
      query: { pageNumber: 1, pageSize: 2, sort: "created_desc" },
      userId: USER_ID,
    });

    expect(page).toMatchObject({
      page: 1,
      pagesCount: 2,
      pageSize: 2,
      totalCount: 3,
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(BOOK_ID);
  });

  it("ignores a single-character query and runs no search", async () => {
    const { genresService, repository, service } = buildReadService({
      listForLibrary: [bookRow()],
    });

    await service.list({
      query: { pageNumber: 1, pageSize: 20, q: "a", sort: "created_desc" },
      userId: USER_ID,
    });

    expect(genresService.searchKeys).not.toHaveBeenCalled();
    expect(repository.listForLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.objectContaining({ search: undefined }) }),
    );
  });

  it("keeps a single-digit query so the ISBN search still applies", async () => {
    const { genresService, repository, service } = buildReadService({
      listForLibrary: [bookRow()],
    });

    await service.list({
      query: { pageNumber: 1, pageSize: 20, q: "9", sort: "created_desc" },
      userId: USER_ID,
    });

    expect(genresService.searchKeys).toHaveBeenCalledWith({ query: "9", userId: USER_ID });
    expect(repository.listForLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.objectContaining({ search: "9" }) }),
    );
  });

  it("applies the search for a query of at least two characters", async () => {
    const { genresService, repository, service } = buildReadService({
      listForLibrary: [bookRow()],
    });

    await service.list({
      query: { pageNumber: 1, pageSize: 20, q: "ab", sort: "created_desc" },
      userId: USER_ID,
    });

    expect(genresService.searchKeys).toHaveBeenCalledWith({ query: "ab", userId: USER_ID });
    expect(repository.listForLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.objectContaining({ search: "ab" }) }),
    );
  });
});

describe("BookLibraryReadService.recentPurchaseStores", () => {
  it("returns the store names produced by the repository", async () => {
    const { service } = buildReadService({ recentPurchaseStores: ["Yakaboo", "Knyharnya Ye"] });

    const result = await service.recentPurchaseStores({ limit: 8, userId: USER_ID });

    expect(result).toEqual(["Yakaboo", "Knyharnya Ye"]);
  });

  it("returns an empty array when the user has no purchase stores", async () => {
    const { service } = buildReadService({ recentPurchaseStores: [] });

    const result = await service.recentPurchaseStores({ limit: 8, userId: USER_ID });

    expect(result).toEqual([]);
  });

  it("forwards the limit and user id to the repository", async () => {
    const { repository, service } = buildReadService({});

    await service.recentPurchaseStores({ limit: 5, userId: USER_ID });

    expect(repository.recentPurchaseStores).toHaveBeenCalledWith({ limit: 5, userId: USER_ID });
  });
});

describe("BookLibraryReadService.favoritesSummary", () => {
  it("delegates to the repository with the finished and reading status sets scoped to the user", async () => {
    const { repository, service } = buildReadService();

    await service.favoritesSummary(USER_ID);

    expect(repository.favoritesSummary).toHaveBeenCalledWith({
      finishedStatuses: ["finished"],
      readingStatuses: ["reading", "rereading"],
      userId: USER_ID,
      wantToReadStatuses: ["want_to_read"],
    });
  });

  it("returns the summary produced by the repository", async () => {
    const { service } = buildReadService({
      favoritesSummary: {
        averageRating: 8.5,
        finished: 3,
        reading: 2,
        series: 4,
        solo: 3,
        topGenres: [],
        topTags: [],
        total: 7,
        unrated: 2,
        wantToRead: 1,
      },
    });

    const result = await service.favoritesSummary(USER_ID);

    expect(result).toEqual({
      averageRating: 8.5,
      finished: 3,
      reading: 2,
      series: 4,
      solo: 3,
      topGenres: [],
      topTags: [],
      total: 7,
      unrated: 2,
      wantToRead: 1,
    });
  });

  it("passes through a null average rating when no favorite has a rating", async () => {
    const { service } = buildReadService({
      favoritesSummary: {
        averageRating: null,
        finished: 0,
        reading: 0,
        series: 0,
        solo: 0,
        topGenres: [],
        topTags: [],
        total: 4,
        unrated: 4,
        wantToRead: 0,
      },
    });

    const result = await service.favoritesSummary(USER_ID);

    expect(result.averageRating).toBeNull();
  });
});

describe("BookLibraryReadService.overview activeReading", () => {
  function activeRow(overrides: Partial<ActiveReadingRow> = {}): ActiveReadingRow {
    return { currentPage: null, id: BOOK_ID, pagesCount: null, title: "Dune", ...overrides };
  }

  function buildOverviewService(activeBooks: ActiveReadingRow[]): {
    repository: { listActiveReading: ReturnType<typeof vi.fn> };
    service: BookLibraryReadService;
  } {
    const repository = {
      countByReadingStatuses: vi.fn().mockResolvedValue(0),
      countByUser: vi.fn().mockResolvedValue(0),
      countDistinctAuthors: vi.fn().mockResolvedValue(0),
      countDistinctSeries: vi.fn().mockResolvedValue(0),
      countFavorites: vi.fn().mockResolvedValue(0),
      countForLibrary: vi.fn().mockResolvedValue(0),
      listActiveReading: vi.fn().mockResolvedValue(activeBooks),
      listRecentlyAdded: vi.fn().mockResolvedValue([]),
      topGenreKeys: vi.fn().mockResolvedValue([]),
      topTags: vi.fn().mockResolvedValue([]),
    };
    const genresService = { findNamesByKeys: vi.fn().mockResolvedValue([]) };
    const service = new BookLibraryReadService(
      fakeOf<BooksRepository>(repository),
      fakeOf<BookViewAssembler>({ viewOf: vi.fn() }),
      fakeOf<GenresService>(genresService),
    );
    return { repository, service };
  }

  it("sums pagesAhead and clamps overshoot while excluding rows with unknown pages", async () => {
    const { service } = buildOverviewService([
      activeRow({ currentPage: 100, id: "b1", pagesCount: 300 }),
      activeRow({ currentPage: 250, id: "b2", pagesCount: 200 }),
      activeRow({ currentPage: 50, id: "b3", pagesCount: null }),
      activeRow({ currentPage: null, id: "b4", pagesCount: 400 }),
    ]);

    const res = await service.overview({ query: {}, userId: USER_ID });

    expect(res.activeReading).toEqual({ book: null, pagesAhead: 200 });
  });

  it("returns the single active book only when exactly one has known pages", async () => {
    const { service } = buildOverviewService([
      activeRow({ currentPage: 120, id: "b1", pagesCount: 320, title: "Solo" }),
    ]);

    const res = await service.overview({ query: {}, userId: USER_ID });

    expect(res.activeReading).toEqual({
      book: { currentPage: 120, id: "b1", pagesCount: 320, title: "Solo" },
      pagesAhead: 200,
    });
  });

  it("defaults the single active book currentPage to zero when it is unknown", async () => {
    const { service } = buildOverviewService([
      activeRow({ currentPage: null, id: "b1", pagesCount: 320, title: "Solo" }),
    ]);

    const res = await service.overview({ query: {}, userId: USER_ID });

    expect(res.activeReading).toEqual({
      book: { currentPage: 0, id: "b1", pagesCount: 320, title: "Solo" },
      pagesAhead: 0,
    });
  });

  it("nulls the active book when the only active book has unknown pages", async () => {
    const { service } = buildOverviewService([activeRow({ currentPage: 40, pagesCount: null })]);

    const res = await service.overview({ query: {}, userId: USER_ID });

    expect(res.activeReading).toEqual({ book: null, pagesAhead: 0 });
  });

  it("nulls the active book when two or more books are active", async () => {
    const { service } = buildOverviewService([
      activeRow({ currentPage: 100, id: "b1", pagesCount: 300 }),
      activeRow({ currentPage: 100, id: "b2", pagesCount: 250 }),
    ]);

    const res = await service.overview({ query: {}, userId: USER_ID });

    expect(res.activeReading).toEqual({ book: null, pagesAhead: 350 });
  });

  it("omits activeReading when no book is active", async () => {
    const { service } = buildOverviewService([]);

    const res = await service.overview({ query: {}, userId: USER_ID });

    expect(res.activeReading).toBeUndefined();
  });

  it("passes the owner scope through to the active reading query", async () => {
    const { repository, service } = buildOverviewService([]);

    await service.overview({ query: { owner: ["owned"] }, userId: USER_ID });

    expect(repository.listActiveReading).toHaveBeenCalledWith({
      ownershipStatuses: ["owned"],
      statuses: ["reading", "rereading"],
      userId: USER_ID,
    });
  });
});
