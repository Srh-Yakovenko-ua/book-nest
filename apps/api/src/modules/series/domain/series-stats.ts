import type { Nullable, ReadingStatus, SeriesStatsView } from "@app/shared";

import { differenceInCalendarDays, max, min } from "date-fns";

import { toNullableIsoDateTime } from "../../../core/iso-date.js";
import { compareByPartThenCreated } from "./series-preview.js";

type PagedBook = Pick<StatsBook, "pagesCount">;

type RatedBook = Pick<StatsBook, "rating">;

type ReadPages = {
  readPagesCount: Nullable<number>;
  readPagesPartial: boolean;
};

type StatsBook = {
  createdAt: Date;
  finishedAt: Nullable<Date>;
  id: string;
  isFavorite: boolean;
  pagesCount: Nullable<number>;
  partNumber: Nullable<number>;
  rating: Nullable<number>;
  readingStatus: ReadingStatus;
  startedAt: Nullable<Date>;
  title: string;
};

const FINISHED_READING_STATUS: ReadingStatus = "finished";

const READING_READING_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "reading",
  "rereading",
]);

const RATING_ROUNDING_FACTOR = 10;

export function computeAveragePages(books: readonly PagedBook[]): Nullable<number> {
  const pages = collectPagesCounts(books);
  if (pages.length === 0) {
    return null;
  }
  const total = pages.reduce((sum, pagesCount) => sum + pagesCount, 0);
  return Math.round(total / pages.length);
}

export function computeAverageRating(books: readonly RatedBook[]): Nullable<number> {
  const ratings = books
    .map((book) => book.rating)
    .filter((rating): rating is number => rating !== null);
  if (ratings.length === 0) {
    return null;
  }
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return Math.round((total / ratings.length) * RATING_ROUNDING_FACTOR) / RATING_ROUNDING_FACTOR;
}

export function computePagesCount(books: readonly PagedBook[]): Nullable<number> {
  const pages = collectPagesCounts(books);
  if (pages.length === 0) {
    return null;
  }
  return pages.reduce((sum, pagesCount) => sum + pagesCount, 0);
}

export function computeSeriesStats(books: StatsBook[]): SeriesStatsView {
  const booksCount = books.length;
  const finishedCount = books.filter(
    (book) => book.readingStatus === FINISHED_READING_STATUS,
  ).length;
  const readingCount = books.filter((book) =>
    READING_READING_STATUSES.has(book.readingStatus),
  ).length;
  const unreadCount = books.filter(
    (book) =>
      book.readingStatus !== FINISHED_READING_STATUS &&
      !READING_READING_STATUSES.has(book.readingStatus),
  ).length;

  const startedAt = computeMinStartedAt(books);
  const lastFinishedAt = computeMaxFinishedAt(books);
  const readPages = computeReadPages(books);

  return {
    averagePages: computeAveragePages(books),
    averageRating: computeAverageRating(books),
    booksCount,
    favoriteBook: selectFavoriteBook(books),
    finishedCount,
    lastFinishedAt: toNullableIsoDateTime(lastFinishedAt),
    pagesCount: computePagesCount(books),
    readingCount,
    readingDurationDays: computeReadingDurationDays({ lastFinishedAt, startedAt }),
    readPagesCount: readPages.readPagesCount,
    readPagesPartial: readPages.readPagesPartial,
    startedAt: toNullableIsoDateTime(startedAt),
    unreadCount,
  };
}

function collectPagesCounts(books: readonly PagedBook[]): number[] {
  return books
    .map((book) => book.pagesCount)
    .filter((pagesCount): pagesCount is number => pagesCount !== null);
}

function computeMaxFinishedAt(books: StatsBook[]): Nullable<Date> {
  const finishedDates = books
    .map((book) => book.finishedAt)
    .filter((finishedAt): finishedAt is Date => finishedAt !== null);
  if (finishedDates.length === 0) {
    return null;
  }
  return max(finishedDates);
}

function computeMinStartedAt(books: StatsBook[]): Nullable<Date> {
  const startedDates = books
    .map((book) => book.startedAt)
    .filter((startedAt): startedAt is Date => startedAt !== null);
  if (startedDates.length === 0) {
    return null;
  }
  return min(startedDates);
}

function computeReadingDurationDays({
  lastFinishedAt,
  startedAt,
}: {
  lastFinishedAt: Nullable<Date>;
  startedAt: Nullable<Date>;
}): Nullable<number> {
  if (startedAt === null || lastFinishedAt === null) {
    return null;
  }
  const durationDays = differenceInCalendarDays(lastFinishedAt, startedAt);
  return durationDays < 0 ? null : durationDays;
}

function computeReadPages(books: StatsBook[]): ReadPages {
  const finishedBooks = books.filter((book) => book.readingStatus === FINISHED_READING_STATUS);
  const pages = collectPagesCounts(finishedBooks);
  if (pages.length === 0) {
    return { readPagesCount: null, readPagesPartial: false };
  }
  return {
    readPagesCount: pages.reduce((sum, pagesCount) => sum + pagesCount, 0),
    readPagesPartial: finishedBooks.some((book) => book.pagesCount === null),
  };
}

function selectFavoriteBook(books: StatsBook[]): Nullable<{ id: string; title: string }> {
  const favorite = [...books].sort(compareByPartThenCreated).find((book) => book.isFavorite);
  if (favorite === undefined) {
    return null;
  }
  return { id: favorite.id, title: favorite.title };
}
