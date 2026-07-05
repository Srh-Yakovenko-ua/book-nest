import type { ReadingStatus } from "@app/shared";

import type { SeriesBookPreview } from "./series-preview.js";

import { countFinishedBooks } from "./series-preview.js";

type SeriesProgressInput = {
  books: SeriesBookPreview[];
  totalBooks: null | number;
};

const ENGAGED_READING_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "finished",
  "reading",
  "rereading",
]);

export function computeSeriesProgress({ books, totalBooks }: SeriesProgressInput): number {
  const denominator = totalBooks ?? books.length;
  if (denominator <= 0) {
    return 0;
  }

  return countFinishedBooks(books) / denominator;
}

export function isSeriesFullyRead({ books, totalBooks }: SeriesProgressInput): boolean {
  const booksInSeries = books.length;
  if (booksInSeries === 0) {
    return false;
  }

  const finishedInSeries = countFinishedBooks(books);
  if (finishedInSeries !== booksInSeries) {
    return false;
  }

  return totalBooks === null || finishedInSeries >= totalBooks;
}

export function isSeriesUnfinished({ books, totalBooks }: SeriesProgressInput): boolean {
  const isMultiBook = books.length > 1 || (totalBooks ?? 0) > 1;
  if (!isMultiBook) {
    return false;
  }

  const hasEngagedBook = books.some((book) => ENGAGED_READING_STATUSES.has(book.readingStatus));
  if (!hasEngagedBook) {
    return false;
  }

  return !isSeriesFullyRead({ books, totalBooks });
}
