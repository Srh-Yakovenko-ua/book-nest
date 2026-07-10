import type { Nullable, ReadingStatus, SeriesNextBook } from "@app/shared";

import { ReadingStatusSchema } from "@app/shared";
import { compareAsc } from "date-fns";

export type SeriesBookPreview = {
  createdAt: Date;
  id: string;
  partNumber: Nullable<number>;
  readingStatus: ReadingStatus;
  title: string;
  updatedAt: Date;
};

export type SeriesBookRow = {
  createdAt: Date;
  id: string;
  partNumber: Nullable<number>;
  readingStatus: string;
  title: string;
  updatedAt: Date;
};

export type SeriesBooksSummary = {
  finishedInSeries: number;
  nextBook: Nullable<SeriesNextBook>;
  readingInSeries: number;
};

type PartOrderedBook = {
  createdAt: Date;
  partNumber: Nullable<number>;
};

const FINISHED_READING_STATUS: ReadingStatus = "finished";

const IN_PROGRESS_READING_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "reading",
  "rereading",
]);

export function compareByPartThenCreated(first: PartOrderedBook, second: PartOrderedBook): number {
  if (first.partNumber !== second.partNumber) {
    if (first.partNumber === null) {
      return 1;
    }
    if (second.partNumber === null) {
      return -1;
    }
    return first.partNumber - second.partNumber;
  }

  return compareAsc(first.createdAt, second.createdAt);
}

export function computeHasUnreadEarlierParts({
  books,
  currentPartNumber,
}: {
  books: SeriesBookPreview[];
  currentPartNumber: Nullable<number>;
}): Nullable<boolean> {
  if (currentPartNumber === null) {
    return null;
  }

  return books.some(
    (book) =>
      book.partNumber !== null &&
      book.partNumber < currentPartNumber &&
      book.readingStatus !== FINISHED_READING_STATUS,
  );
}

export function computeSeriesLastActivityAt({
  books,
  seriesUpdatedAt,
}: {
  books: SeriesBookPreview[];
  seriesUpdatedAt: Date;
}): Date {
  return books.reduce(
    (latest, book) => (book.updatedAt > latest ? book.updatedAt : latest),
    seriesUpdatedAt,
  );
}

export function countFinishedBooks(books: SeriesBookPreview[]): number {
  return books.filter((book) => book.readingStatus === FINISHED_READING_STATUS).length;
}

export function summarizeSeriesBooks(books: SeriesBookPreview[]): SeriesBooksSummary {
  const nextBook = selectNextBook(books);

  return {
    finishedInSeries: countFinishedBooks(books),
    nextBook:
      nextBook === undefined
        ? null
        : { id: nextBook.id, partNumber: nextBook.partNumber, title: nextBook.title },
    readingInSeries: countReadingBooks(books),
  };
}

export function toSeriesBookPreview(book: SeriesBookRow): SeriesBookPreview {
  return { ...book, readingStatus: ReadingStatusSchema.parse(book.readingStatus) };
}

function countReadingBooks(books: SeriesBookPreview[]): number {
  return books.filter((book) => IN_PROGRESS_READING_STATUSES.has(book.readingStatus)).length;
}

function selectNextBook(books: SeriesBookPreview[]): SeriesBookPreview | undefined {
  const ordered = [...books].sort(compareByPartThenCreated);
  const inProgress = ordered.find((book) => IN_PROGRESS_READING_STATUSES.has(book.readingStatus));
  if (inProgress !== undefined) {
    return inProgress;
  }

  return ordered.find((book) => book.readingStatus !== FINISHED_READING_STATUS);
}
