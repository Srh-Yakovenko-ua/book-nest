import type {
  LibraryPublisherDetail,
  LibraryPublisherListItem,
  LibraryPublishersSummary,
  LibraryPublisherStats,
  Nullable,
} from "@app/shared";

import type { PublisherModel } from "../../../generated/prisma/models.js";

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

const RATING_FRACTION_DIGITS = 2;

const ZERO_STATS: LibraryPublisherStats = {
  averageRating: null,
  booksCount: 0,
  lastBookAddedAt: null,
  lastBookReadAt: null,
  queueCount: 0,
  ratedBooksCount: 0,
  readCount: 0,
  readingCount: 0,
  seriesCount: 0,
  wantToBuyCount: 0,
  wantToReadCount: 0,
};

export function toLibraryPublisherDetail(row: LibraryStatsRow): LibraryPublisherDetail {
  return toLibraryPublisherListItem(row);
}

export function toLibraryPublisherDetailFromModel(model: PublisherModel): LibraryPublisherDetail {
  return {
    countryCode: model.countryCode,
    foundedYear: model.foundedYear,
    id: model.id,
    isCustom: model.userId !== null,
    name: model.name,
    stats: ZERO_STATS,
    websiteUrl: model.websiteUrl,
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
  priceTotals,
}: {
  counts: SummaryCountsRow;
  priceTotals: PriceTotalRow[];
}): LibraryPublishersSummary {
  return {
    averageBookRating:
      counts.averageBookRating === null ? null : roundRating(counts.averageBookRating),
    booksWithoutPublisherCount: counts.booksWithoutPublisherCount,
    booksWithPublisherCount: counts.booksWithPublisherCount,
    expectedPriceTotals: priceTotals.map((row) => ({
      amount: Number(row.amount),
      currency: row.currency,
      pricedBooksCount: row.pricedBooksCount,
    })),
    publishersCount: counts.publishersCount,
    ratedBooksCount: counts.ratedBooksCount,
    wantToBuyBooksCount: counts.wantToBuyBooksCount,
  };
}

function roundRating(value: number): number {
  const factor = 10 ** RATING_FRACTION_DIGITS;
  return Math.round(value * factor) / factor;
}
