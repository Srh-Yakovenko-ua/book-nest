import type {
  LibraryPublisherDetail,
  LibraryPublisherDetailStats,
  LibraryPublisherListItem,
  LibraryPublishersPage,
  LibraryPublishersSummary,
  LibraryPublisherStats,
} from "@app/shared";

export const LONG_PUBLISHER_NAME =
  "Видавництво Старого Лева — незалежне українське видавництво повного циклу";

export function makePublisherDetail(
  overrides: Partial<LibraryPublisherDetail> = {},
): LibraryPublisherDetail {
  const { stats, ...rest } = overrides;
  return {
    countryCode: "UA",
    foundedYear: 1996,
    id: "publisher-1",
    isCustom: true,
    name: "Vivat",
    websiteUrl: "https://vivat.com.ua",
    ...rest,
    stats: stats ?? makePublisherDetailStats(),
  };
}

export function makePublisherDetailStats(
  overrides: Partial<LibraryPublisherDetailStats> = {},
): LibraryPublisherDetailStats {
  return { ...makePublisherStats(), wishlistWithoutPriceCount: 0, ...overrides };
}

export function makePublisherListItem(
  overrides: Partial<LibraryPublisherListItem> = {},
): LibraryPublisherListItem {
  const { stats, ...rest } = overrides;
  return {
    countryCode: "UA",
    foundedYear: 1996,
    id: "publisher-1",
    isCustom: false,
    name: "Vivat",
    websiteUrl: "https://vivat.com.ua",
    ...rest,
    stats: stats ?? makePublisherStats(),
  };
}

export function makePublishersPage(
  items: LibraryPublisherListItem[] = [makePublisherListItem()],
  overrides: Partial<LibraryPublishersPage> = {},
): LibraryPublishersPage {
  return {
    items,
    page: 1,
    pagesCount: 1,
    pageSize: 24,
    totalCount: items.length,
    ...overrides,
  };
}

export function makePublishersSummary(
  overrides: Partial<LibraryPublishersSummary> = {},
): LibraryPublishersSummary {
  return {
    averageBookRating: 4,
    bestRatedPublishers: [],
    booksToBuyWithPublisherCount: 7,
    booksWithoutPublisherCount: 0,
    booksWithPublisherCount: 340,
    expectedPriceTotals: [],
    mostReadPublisher: null,
    mostRepresentedPublisher: null,
    publishersCount: 12,
    publishersInPlansCount: 3,
    ratedBooksCount: 20,
    topFiveBooksCoveragePercent: 60,
    unreadPublishers: [],
    wantToBuyBooksCount: 7,
    ...overrides,
  };
}

export function makePublisherStats(
  overrides: Partial<LibraryPublisherStats> = {},
): LibraryPublisherStats {
  return {
    averageRating: 4,
    booksCount: 8,
    lastBookAddedAt: "2026-03-01T00:00:00.000Z",
    lastBookReadAt: "2026-02-01T00:00:00.000Z",
    queueCount: 1,
    ratedBooksCount: 2,
    readCount: 5,
    readingCount: 1,
    seriesCount: 1,
    wantToBuyCount: 3,
    wantToReadCount: 2,
    ...overrides,
  };
}
