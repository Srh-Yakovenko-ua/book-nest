import type {
  SeriesBookView,
  SeriesDetailsView,
  SeriesOverviewView,
  SeriesStatsView,
  SeriesView,
} from "@app/shared";

export function makeSeriesBookView(overrides: Partial<SeriesBookView> = {}): SeriesBookView {
  return {
    ageCategory: "16_plus",
    authors: [{ id: "author-1", name: "Ребекка Яррос" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentPage: null,
    formats: ["paper"],
    genres: ["fantasy", "romance"],
    id: "series-book-1",
    isFavorite: false,
    isInReadingQueue: false,
    originalTitle: null,
    ownershipStatus: "owned",
    pagesCount: 512,
    partNumber: 1,
    publicationYear: 2023,
    rating: null,
    readingStatus: "finished",
    tags: [{ id: "tag-1", name: "дракони" }],
    title: "Четверте крило",
    ...overrides,
  };
}

export function makeSeriesDetailsView(
  overrides: Partial<SeriesDetailsView> = {},
): SeriesDetailsView {
  const { books, publishers, stats, ...seriesOverrides } = overrides;
  return {
    ...makeSeriesView(seriesOverrides),
    books: books ?? [
      makeSeriesBookView({
        id: "series-book-1",
        partNumber: 1,
        rating: 9,
        readingStatus: "finished",
        title: "Четверте крило",
      }),
      makeSeriesBookView({
        currentPage: 180,
        id: "series-book-2",
        ownershipStatus: "owned",
        pagesCount: 640,
        partNumber: 2,
        rating: null,
        readingStatus: "reading",
        title: "Ковадло зірок",
      }),
      makeSeriesBookView({
        id: "series-book-3",
        ownershipStatus: "want_to_buy",
        pagesCount: null,
        partNumber: 3,
        rating: null,
        readingStatus: "not_started",
        title: "Оніксове полум'я",
      }),
    ],
    publishers: publishers ?? [{ id: "publisher-1", name: "Vivat" }],
    stats: stats ?? makeSeriesStats(),
  };
}

export function makeSeriesOverview(
  overrides: Partial<SeriesOverviewView> = {},
): SeriesOverviewView {
  return {
    booksInSeries: 14,
    fullyReadSeries: 2,
    statusCounts: { completed: 3, ongoing: 4, unknown: 1 },
    topUnfinished: [
      makeSeriesView({
        finishedInSeries: 3,
        id: "top-1",
        name: "Пісня льоду й полум'я",
        totalBooks: 5,
      }),
      makeSeriesView({
        finishedInSeries: 1,
        id: "top-2",
        name: "Хроніки Амбера",
        nextBook: { id: "amber-2", partNumber: 2, title: "Рушниці Авалона" },
        totalBooks: 4,
      }),
      makeSeriesView({
        finishedInSeries: 2,
        id: "top-3",
        name: "Основа",
        nextBook: { id: "found-3", partNumber: 3, title: "Друга Основа" },
        totalBooks: 7,
      }),
    ],
    totalSeries: 8,
    unfinishedSeries: 5,
    ...overrides,
  };
}

export function makeSeriesStats(overrides: Partial<SeriesStatsView> = {}): SeriesStatsView {
  return {
    averageRating: 8.5,
    booksCount: 3,
    finishedCount: 1,
    pagesCount: 1520,
    readingCount: 1,
    unreadCount: 1,
    ...overrides,
  };
}

export function makeSeriesView(overrides: Partial<SeriesView> = {}): SeriesView {
  return {
    authors: [{ id: "author-1", name: "Ребекка Яррос" }],
    booksInSeries: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    finishedInSeries: 1,
    genres: [],
    id: "series-1",
    lastActivityAt: "2026-01-05T00:00:00.000Z",
    name: "Емпіреї",
    nextBook: { id: "next-book-1", partNumber: 2, title: "Ковадло зірок" },
    readingInSeries: 1,
    status: "ongoing",
    totalBooks: 5,
    ...overrides,
  };
}
