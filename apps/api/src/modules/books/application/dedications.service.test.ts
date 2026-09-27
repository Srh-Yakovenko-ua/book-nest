import type {
  BookView,
  DedicationsQuery,
  DedicationsQuickCounts,
  DedicationsSummaryView,
} from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { GenresService } from "../../genres/index.js";
import type {
  BooksRepository,
  BookWithRelations,
  DedicationsFilter,
} from "../infrastructure/books.repository.js";
import type { BookViewAssembler } from "./book-view-assembler.js";

import { DedicationsService } from "./dedications.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function makeQuery(overrides: Partial<DedicationsQuery> = {}): DedicationsQuery {
  return {
    filter: "all",
    pageNumber: 1,
    pageSize: 12,
    sort: "newest",
    ...overrides,
  };
}

function makeView(overrides: {
  authors?: string[];
  genres?: string[];
  id: string;
  isFavoriteDedication?: boolean;
  readingStatus?: BookView["readingStatus"];
}): BookView {
  return {
    authors: (overrides.authors ?? []).map((name, index) => ({
      id: `${overrides.id}-${index}`,
      name,
    })),
    genres: overrides.genres ?? [],
    id: overrides.id,
    isFavoriteDedication: overrides.isFavoriteDedication ?? false,
    readingStatus: overrides.readingStatus ?? "not_started",
  } as unknown as BookView;
}

const EMPTY_SUMMARY: DedicationsSummaryView = {
  authorsCount: 0,
  availableGenres: [],
  favoriteCount: 0,
  finishedCount: 0,
  topAuthor: null,
  topGenre: null,
  totalCount: 0,
  unfinishedCount: 0,
};

const ZERO_COUNTS: DedicationsQuickCounts = { all: 0, favorites: 0, finished: 0, unfinished: 0 };

function setup(options: {
  quickCounts?: DedicationsQuickCounts;
  searchKeys?: string[];
  summary?: DedicationsSummaryView;
  totalCount?: number;
  views?: BookView[];
}) {
  const views = options.views ?? [];
  const rows = views.map((view) => ({ id: view.id }) as unknown as BookWithRelations);

  const listDedicationsForQuery = vi.fn().mockResolvedValue(rows);
  const countDedicationsForQuery = vi.fn().mockResolvedValue(options.totalCount ?? views.length);
  const dedicationsSummary = vi.fn().mockResolvedValue(options.summary ?? EMPTY_SUMMARY);
  const countDedicationQuickFilters = vi.fn().mockResolvedValue(options.quickCounts ?? ZERO_COUNTS);
  const booksRepository = {
    countDedicationQuickFilters,
    countDedicationsForQuery,
    dedicationsSummary,
    listDedicationsForQuery,
  } as unknown as BooksRepository;

  const viewByRowId = new Map(views.map((view) => [view.id, view]));
  const viewOf = vi.fn(
    (row: BookWithRelations) => viewByRowId.get(row.id) ?? makeView({ id: row.id }),
  );
  const bookViewAssembler = { viewOf } as unknown as BookViewAssembler;

  const searchKeys = vi.fn().mockResolvedValue(options.searchKeys ?? []);
  const genresService = { searchKeys } as unknown as GenresService;

  const service = new DedicationsService(booksRepository, bookViewAssembler, genresService);

  return {
    countDedicationQuickFilters,
    countDedicationsForQuery,
    dedicationsSummary,
    listDedicationsForQuery,
    searchKeys,
    service,
  };
}

describe("DedicationsService.getDedications", () => {
  it("maps rows to a paginated page and derives skip/take from the query", async () => {
    const views = [makeView({ id: "book-a" }), makeView({ id: "book-b" })];
    const { listDedicationsForQuery, service } = setup({ totalCount: 30, views });

    const result = await service.getDedications({
      query: makeQuery({ pageNumber: 3, pageSize: 10 }),
      userId: USER_ID,
    });

    expect(listDedicationsForQuery).toHaveBeenCalledWith({
      filter: {
        filter: "all",
        genreKey: undefined,
        search: undefined,
        searchGenreKeys: undefined,
        userId: USER_ID,
      },
      skip: 20,
      sort: "newest",
      take: 10,
    });
    expect(result.items.map((book) => book.id)).toEqual(["book-a", "book-b"]);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.totalCount).toBe(30);
    expect(result.pagesCount).toBe(3);
  });

  it("resolves the search into genre keys and forwards the whole filter", async () => {
    const { countDedicationsForQuery, listDedicationsForQuery, searchKeys, service } = setup({
      searchKeys: ["memoir"],
      views: [makeView({ id: "book-a" })],
    });

    await service.getDedications({
      query: makeQuery({ filter: "favorites", genre: "history", q: "memoir" }),
      userId: USER_ID,
    });

    expect(searchKeys).toHaveBeenCalledWith("memoir");
    const expectedFilter: DedicationsFilter = {
      filter: "favorites",
      genreKey: "history",
      search: "memoir",
      searchGenreKeys: ["memoir"],
      userId: USER_ID,
    };
    expect(listDedicationsForQuery).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expectedFilter }),
    );
    expect(countDedicationsForQuery).toHaveBeenCalledWith({ filter: expectedFilter });
  });

  it("skips genre-key resolution when there is no search term", async () => {
    const { searchKeys, service } = setup({ views: [] });

    await service.getDedications({ query: makeQuery(), userId: USER_ID });

    expect(searchKeys).not.toHaveBeenCalled();
  });

  it("ignores a search term below the minimum length", async () => {
    const { listDedicationsForQuery, searchKeys, service } = setup({ views: [] });

    await service.getDedications({ query: makeQuery({ q: "a" }), userId: USER_ID });

    expect(searchKeys).not.toHaveBeenCalled();
    expect(listDedicationsForQuery).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.objectContaining({ search: undefined }) }),
    );
  });
});

describe("DedicationsService.getDedicationsSummary", () => {
  it("delegates to the repository and returns its exact summary", async () => {
    const summary: DedicationsSummaryView = {
      authorsCount: 2,
      availableGenres: ["history", "memoir"],
      favoriteCount: 1,
      finishedCount: 1,
      topAuthor: { count: 2, name: "Frank Herbert" },
      topGenre: { count: 2, genre: "memoir" },
      totalCount: 2,
      unfinishedCount: 1,
    };
    const { dedicationsSummary, service } = setup({ summary });

    const result = await service.getDedicationsSummary({ userId: USER_ID });

    expect(dedicationsSummary).toHaveBeenCalledWith({ userId: USER_ID });
    expect(result).toEqual(summary);
  });
});

describe("DedicationsService.getDedicationsQuickCounts", () => {
  it("counts every chip over the resolved search and genre", async () => {
    const counts: DedicationsQuickCounts = { all: 5, favorites: 2, finished: 3, unfinished: 2 };
    const { countDedicationQuickFilters, searchKeys, service } = setup({
      quickCounts: counts,
      searchKeys: ["memoir"],
    });

    const result = await service.getDedicationsQuickCounts({
      query: { genre: "history", q: "memoir" },
      userId: USER_ID,
    });

    expect(searchKeys).toHaveBeenCalledWith("memoir");
    const base = {
      genreKey: "history",
      search: "memoir",
      searchGenreKeys: ["memoir"],
      userId: USER_ID,
    };
    expect(countDedicationQuickFilters).toHaveBeenCalledWith({
      filters: {
        all: { ...base, filter: "all" },
        favorites: { ...base, filter: "favorites" },
        finished: { ...base, filter: "finished" },
        unfinished: { ...base, filter: "unfinished" },
      },
    });
    expect(result).toEqual(counts);
  });

  it("skips genre-key resolution when there is no search term", async () => {
    const { countDedicationQuickFilters, searchKeys, service } = setup({});

    const result = await service.getDedicationsQuickCounts({ query: {}, userId: USER_ID });

    expect(searchKeys).not.toHaveBeenCalled();
    expect(countDedicationQuickFilters).toHaveBeenCalledWith({
      filters: expect.objectContaining({
        all: {
          filter: "all",
          genreKey: undefined,
          search: undefined,
          searchGenreKeys: undefined,
          userId: USER_ID,
        },
      }),
    });
    expect(result).toEqual(ZERO_COUNTS);
  });
});
