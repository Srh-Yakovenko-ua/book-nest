import type {
  DeliveryView,
  LoanInfoView,
  MediaView,
  SeriesBookView,
  SeriesCoverPreview,
  SeriesDetailsView,
  SeriesOverviewView,
  SeriesStatsView,
  SeriesView,
} from "@app/shared";

export function makeDelivery(overrides: Partial<DeliveryView> = {}): DeliveryView {
  return {
    cancelledAt: null,
    cancelReason: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: null,
    deliveryService: null,
    expectedDeliveryDate: null,
    id: "delivery-1",
    note: null,
    orderDate: null,
    orderNumber: null,
    price: null,
    receivedAt: null,
    status: "in_transit",
    storeName: null,
    trackingNumber: null,
    trackingUrl: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeLoanInfo(overrides: Partial<LoanInfoView> = {}): LoanInfoView {
  return {
    contact: null,
    expectedReturnDate: null,
    loanDate: null,
    loanType: "lent_to_someone",
    loanUiStatus: "no_return_date",
    note: null,
    personName: "Олена",
    remindToReturn: false,
    ...overrides,
  };
}

export function makeSeriesBookView(overrides: Partial<SeriesBookView> = {}): SeriesBookView {
  return {
    activeDelivery: null,
    ageCategory: "16_plus",
    authors: [{ id: "author-1", name: "Ребекка Яррос" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentPage: null,
    finishedAt: null,
    formats: ["paper"],
    genres: ["fantasy", "romance"],
    id: "series-book-1",
    isFavorite: false,
    isInReadingQueue: false,
    loanInfo: null,
    originalTitle: null,
    ownershipStatus: "owned",
    pagesCount: 512,
    partNumber: 1,
    publicationYear: 2023,
    publisher: null,
    rating: null,
    readingStatus: "finished",
    startedAt: null,
    tags: [{ id: "tag-1", name: "дракони" }],
    title: "Четверте крило",
    ...overrides,
  };
}

export function makeSeriesCoverMedia(overrides: Partial<MediaView> = {}): MediaView {
  return {
    contentType: "image/webp",
    createdAt: "2026-01-01T00:00:00.000Z",
    height: 800,
    id: "series-cover-media-1",
    kind: "book_cover",
    name: "cover.webp",
    sizeBytes: 1024,
    urls: {
      card: "https://cdn.test/series-card.webp",
      full: "https://cdn.test/series-full.webp",
      thumb: "https://cdn.test/series-thumb.webp",
    },
    width: 600,
    ...overrides,
  };
}

export function makeSeriesCoverPreview(
  overrides: Partial<SeriesCoverPreview> = {},
): SeriesCoverPreview {
  return {
    bookId: "series-book-1",
    cover: makeSeriesCoverMedia(),
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
    almostRead: [],
    attentionCounts: {
      empty: 0,
      incomplete_data: 0,
      incomplete_set: 0,
      missing_parts: 0,
      next_unavailable: 0,
      unknown_status: 0,
    },
    booksInSeries: 14,
    fullyReadSeries: 2,
    statusCounts: { completed: 3, ongoing: 4, unknown: 1 },
    topUnfinished: [
      makeSeriesView({
        finishedInSeries: 3,
        id: "top-1",
        name: "Пісня льоду й полум'я",
        nextBook: {
          cover: makeSeriesCoverMedia({ id: "top-1-next-cover" }),
          id: "top-1-next",
          partNumber: 4,
          title: "Бенкет круків",
        },
        totalBooks: 5,
      }),
      makeSeriesView({
        finishedInSeries: 1,
        id: "top-2",
        name: "Хроніки Амбера",
        nextBook: { cover: null, id: "amber-2", partNumber: 2, title: "Рушниці Авалона" },
        totalBooks: 4,
      }),
      makeSeriesView({
        finishedInSeries: 2,
        id: "top-3",
        name: "Основа",
        nextBook: { cover: null, id: "found-3", partNumber: 3, title: "Друга Основа" },
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
    averagePages: 507,
    averageRating: 8.5,
    booksCount: 3,
    favoriteBook: { id: "series-book-1", title: "Четверте крило" },
    finishedCount: 1,
    lastFinishedAt: "2026-01-05T00:00:00.000Z",
    pagesCount: 1520,
    readingCount: 1,
    readingDurationDays: 4,
    readPagesCount: 512,
    readPagesPartial: false,
    startedAt: "2026-01-01T00:00:00.000Z",
    unreadCount: 1,
    ...overrides,
  };
}

export function makeSeriesView(overrides: Partial<SeriesView> = {}): SeriesView {
  return {
    ageCategories: ["16_plus"],
    authors: [{ id: "author-1", name: "Ребекка Яррос" }],
    averagePages: 507,
    averageRating: 8.5,
    booksInSeries: 3,
    covers: [
      makeSeriesCoverPreview({ bookId: "series-book-1", title: "Четверте крило" }),
      makeSeriesCoverPreview({ bookId: "series-book-2", title: "Ковадло зірок" }),
      makeSeriesCoverPreview({ bookId: "series-book-3", title: "Оніксове полум'я" }),
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    finishedInSeries: 1,
    formats: ["paper"],
    genres: [],
    hasFavoriteBook: false,
    hasPublicationYears: true,
    hasPublisher: true,
    id: "series-1",
    languages: ["ukrainian"],
    lastActivityAt: "2026-01-05T00:00:00.000Z",
    missingPartNumbers: [],
    name: "Емпіреї",
    nextBook: {
      cover: makeSeriesCoverMedia({ id: "next-book-cover-1" }),
      id: "next-book-1",
      ownershipStatus: "owned",
      partNumber: 2,
      title: "Ковадло зірок",
    },
    ownership: { ownedCount: 2, total: 3 },
    pagesCount: 1520,
    readingInSeries: 1,
    status: "ongoing",
    tags: [{ id: "tag-1", name: "дракони" }],
    totalBooks: 5,
    ...overrides,
  };
}
