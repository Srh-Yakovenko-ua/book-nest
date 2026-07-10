import type { Nullable, ReadingStatus, SeriesBookView, SeriesStatsView } from "@app/shared";

type StatsBook = Pick<SeriesBookView, "pagesCount" | "rating" | "readingStatus">;

const FINISHED_READING_STATUS: ReadingStatus = "finished";

const READING_READING_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "reading",
  "rereading",
]);

const RATING_ROUNDING_FACTOR = 10;

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

  return {
    averageRating: computeAverageRating(books),
    booksCount,
    finishedCount,
    pagesCount: computePagesCount(books),
    readingCount,
    unreadCount,
  };
}

function computeAverageRating(books: StatsBook[]): Nullable<number> {
  const ratings = books
    .map((book) => book.rating)
    .filter((rating): rating is number => rating !== null);
  if (ratings.length === 0) {
    return null;
  }
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return Math.round((total / ratings.length) * RATING_ROUNDING_FACTOR) / RATING_ROUNDING_FACTOR;
}

function computePagesCount(books: StatsBook[]): Nullable<number> {
  const pages = books
    .map((book) => book.pagesCount)
    .filter((pagesCount): pagesCount is number => pagesCount !== null);
  if (pages.length === 0) {
    return null;
  }
  return pages.reduce((sum, pagesCount) => sum + pagesCount, 0);
}
