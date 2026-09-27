import type {
  LibraryPublisherDetail,
  LibraryPublisherListItem,
  LibraryPublishersBestRated,
  LibraryPublishersMostRead,
  LibraryPublishersMostRepresented,
  LibraryPublishersSummary,
  LibraryPublishersUnread,
  Nullable,
} from "@app/shared";

export type LibraryDetailStatsRow = LibraryStatsRow & {
  wishlistWithoutPriceCount: number;
};

export type LibraryStatsRow = {
  averageRating: Nullable<number>;
  booksCount: number;
  countryCode: Nullable<string>;
  foundedYear: Nullable<number>;
  id: string;
  isCustom: boolean;
  lastBookAddedAt: Nullable<string>;
  lastBookReadAt: Nullable<string>;
  name: string;
  queueCount: number;
  ratedBooksCount: number;
  readCount: number;
  readingCount: number;
  seriesCount: number;
  wantToBuyCount: number;
  wantToReadCount: number;
  websiteUrl: Nullable<string>;
};

export type PriceTotalRow = {
  amount: string;
  currency: string;
  pricedBooksCount: number;
};

export type SummaryCountsRow = {
  averageBookRating: Nullable<number>;
  booksWithoutPublisherCount: number;
  booksWithPublisherCount: number;
  publishersCount: number;
  ratedBooksCount: number;
  wantToBuyBooksCount: number;
};

export type SummaryInsightsRow = {
  attributedBooksCount: number;
  bestRatedPublishers: LibraryPublishersBestRated[];
  booksToBuyWithPublisherCount: number;
  mostReadPublisher: Nullable<LibraryPublishersMostRead>;
  mostRepresentedPublisher: Nullable<LibraryPublishersMostRepresented>;
  publishersInPlansCount: number;
  topFiveBooksCount: number;
  unreadPublishers: LibraryPublishersUnread[];
};

const RATING_FRACTION_DIGITS = 2;
const PERCENT_SCALE = 100;

export function toLibraryPublisherDetail(row: LibraryDetailStatsRow): LibraryPublisherDetail {
  const listItem = toLibraryPublisherListItem(row);
  return {
    ...listItem,
    stats: { ...listItem.stats, wishlistWithoutPriceCount: row.wishlistWithoutPriceCount },
  };
}

export function toLibraryPublisherListItem(row: LibraryStatsRow): LibraryPublisherListItem {
  return {
    countryCode: row.countryCode,
    foundedYear: row.foundedYear,
    id: row.id,
    isCustom: row.isCustom,
    name: row.name,
    stats: {
      averageRating: row.averageRating === null ? null : roundRating(row.averageRating),
      booksCount: row.booksCount,
      lastBookAddedAt: row.lastBookAddedAt,
      lastBookReadAt: row.lastBookReadAt,
      queueCount: row.queueCount,
      ratedBooksCount: row.ratedBooksCount,
      readCount: row.readCount,
      readingCount: row.readingCount,
      seriesCount: row.seriesCount,
      wantToBuyCount: row.wantToBuyCount,
      wantToReadCount: row.wantToReadCount,
    },
    websiteUrl: row.websiteUrl,
  };
}

export function toLibraryPublishersSummary({
  counts,
  insights,
  priceTotals,
}: {
  counts: SummaryCountsRow;
  insights: SummaryInsightsRow;
  priceTotals: PriceTotalRow[];
}): LibraryPublishersSummary {
  return {
    averageBookRating:
      counts.averageBookRating === null ? null : roundRating(counts.averageBookRating),
    bestRatedPublishers: insights.bestRatedPublishers.map((publisher) => ({
      ...publisher,
      averageRating: roundRating(publisher.averageRating),
    })),
    booksToBuyWithPublisherCount: insights.booksToBuyWithPublisherCount,
    booksWithoutPublisherCount: counts.booksWithoutPublisherCount,
    booksWithPublisherCount: counts.booksWithPublisherCount,
    expectedPriceTotals: priceTotals.map((row) => ({
      amount: Number(row.amount),
      currency: row.currency,
      pricedBooksCount: row.pricedBooksCount,
    })),
    mostReadPublisher: insights.mostReadPublisher,
    mostRepresentedPublisher: insights.mostRepresentedPublisher,
    publishersCount: counts.publishersCount,
    publishersInPlansCount: insights.publishersInPlansCount,
    ratedBooksCount: counts.ratedBooksCount,
    topFiveBooksCoveragePercent: toCoveragePercent(insights),
    unreadPublishers: insights.unreadPublishers,
    wantToBuyBooksCount: counts.wantToBuyBooksCount,
  };
}

function roundRating(value: number): number {
  const factor = 10 ** RATING_FRACTION_DIGITS;
  return Math.round(value * factor) / factor;
}

function toCoveragePercent({
  attributedBooksCount,
  topFiveBooksCount,
}: Pick<SummaryInsightsRow, "attributedBooksCount" | "topFiveBooksCount">): number {
  if (attributedBooksCount === 0) {
    return 0;
  }
  return (topFiveBooksCount / attributedBooksCount) * PERCENT_SCALE;
}
