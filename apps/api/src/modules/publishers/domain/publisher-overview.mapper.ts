import type {
  LibraryPublisherOverview,
  MediaView,
  Nullable,
  PublisherOverviewLatestBook,
  PublisherOverviewReadingBook,
  PublisherOverviewReadingProgress,
  PublisherOverviewSeries,
  PublisherOverviewWishlistBook,
} from "@app/shared";

import {
  BookFormatsSchema,
  OwnershipStatusSchema,
  ReadingStatusSchema,
  SeriesStatusSchema,
} from "@app/shared";

import type { BookStoreLinkModel, MediaAssetModel } from "../../../generated/prisma/models.js";

import { computeBestOffer } from "../../books/domain/best-offer.js";

export type OverviewLatestBookRow = CompactBookRow & {
  createdAt: Date;
  formats: string[];
  ownershipStatus: string;
  partNumber: Nullable<number>;
  readingStatus: string;
  series: Nullable<{
    deletedAt: Nullable<Date>;
    id: string;
    name: string;
    totalBooks: Nullable<number>;
  }>;
};

export type OverviewReadingBookRow = CompactBookRow & {
  pagesCount: Nullable<number>;
  readingProgress: Nullable<{ currentPage: Nullable<number> }>;
  readingStatus: string;
};

export type OverviewSeriesRow = {
  booksCount: number;
  id: string;
  name: string;
  readCount: number;
  status: string;
};

export type OverviewWishlistBookRow = CompactBookRow & {
  storeLinks: BookStoreLinkModel[];
};

type CompactBookRow = {
  authors: { author: { id: string; name: string } }[];
  coverMedia: Nullable<MediaAssetModel>;
  id: string;
  title: string;
};

type CoverBuilder = (asset: Nullable<MediaAssetModel>) => Nullable<MediaView>;

type OverviewRows = {
  activeReading: OverviewReadingBookRow[];
  latestBook: Nullable<OverviewLatestBookRow>;
  series: OverviewSeriesRow[];
  wishlist: OverviewWishlistBookRow[];
};

export function toLibraryPublisherOverview({
  buildCover,
  rows,
}: {
  buildCover: CoverBuilder;
  rows: OverviewRows;
}): LibraryPublisherOverview {
  return {
    activeReading: rows.activeReading.map((row) => toReadingBook({ buildCover, row })),
    latestBook:
      rows.latestBook === null ? null : toLatestBook({ buildCover, row: rows.latestBook }),
    series: rows.series.map(toOverviewSeries),
    wishlist: rows.wishlist.map((row) => toWishlistBook({ buildCover, row })),
  };
}

function toCompactBook({
  buildCover,
  row,
}: {
  buildCover: CoverBuilder;
  row: CompactBookRow;
}): Pick<PublisherOverviewReadingBook, "authors" | "cover" | "id" | "title"> {
  return {
    authors: row.authors.map((bookAuthor) => ({
      id: bookAuthor.author.id,
      name: bookAuthor.author.name,
    })),
    cover: buildCover(row.coverMedia),
    id: row.id,
    title: row.title,
  };
}

function toLatestBook({
  buildCover,
  row,
}: {
  buildCover: CoverBuilder;
  row: OverviewLatestBookRow;
}): PublisherOverviewLatestBook {
  const series = row.series === null || row.series.deletedAt !== null ? null : row.series;
  return {
    ...toCompactBook({ buildCover, row }),
    createdAt: row.createdAt.toISOString(),
    formats: BookFormatsSchema.parse(row.formats),
    ownershipStatus: OwnershipStatusSchema.parse(row.ownershipStatus),
    readingStatus: ReadingStatusSchema.parse(row.readingStatus),
    series:
      series === null
        ? null
        : {
            id: series.id,
            name: series.name,
            partNumber: row.partNumber,
            totalBooks: series.totalBooks,
          },
  };
}

function toOverviewSeries(row: OverviewSeriesRow): PublisherOverviewSeries {
  return {
    booksCount: row.booksCount,
    id: row.id,
    name: row.name,
    readCount: row.readCount,
    status: SeriesStatusSchema.parse(row.status),
  };
}

function toReadingBook({
  buildCover,
  row,
}: {
  buildCover: CoverBuilder;
  row: OverviewReadingBookRow;
}): PublisherOverviewReadingBook {
  return {
    ...toCompactBook({ buildCover, row }),
    progress: toReadingProgress({
      currentPage: row.readingProgress?.currentPage ?? null,
      pagesCount: row.pagesCount,
    }),
    readingStatus: ReadingStatusSchema.parse(row.readingStatus),
  };
}

function toReadingProgress({
  currentPage,
  pagesCount,
}: {
  currentPage: Nullable<number>;
  pagesCount: Nullable<number>;
}): Nullable<PublisherOverviewReadingProgress> {
  if (currentPage === null || pagesCount === null || pagesCount <= 0) {
    return null;
  }
  return { currentPage, pagesCount };
}

function toWishlistBook({
  buildCover,
  row,
}: {
  buildCover: CoverBuilder;
  row: OverviewWishlistBookRow;
}): PublisherOverviewWishlistBook {
  return {
    ...toCompactBook({ buildCover, row }),
    bestOffer: computeBestOffer({ links: row.storeLinks }),
  };
}
