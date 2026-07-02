import type { ReadingStatus, SeriesNextBook } from "@app/shared";

import { ReadingStatusSchema } from "@app/shared";

export type SeriesBookPreview = {
  createdAt: Date;
  id: string;
  partNumber: null | number;
  readingStatus: ReadingStatus;
  title: string;
};

export type SeriesBooksSummary = {
  finishedInSeries: number;
  nextBook: null | SeriesNextBook;
};

type SeriesBookRow = {
  createdAt: Date;
  id: string;
  partNumber: null | number;
  readingStatus: string;
  title: string;
};

const FINISHED_READING_STATUS: ReadingStatus = "finished";

export function computeHasUnreadEarlierParts({
  books,
  currentPartNumber,
}: {
  books: SeriesBookPreview[];
  currentPartNumber: null | number;
}): boolean | null {
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

export function summarizeSeriesBooks(books: SeriesBookPreview[]): SeriesBooksSummary {
  const finishedInSeries = books.filter(
    (book) => book.readingStatus === FINISHED_READING_STATUS,
  ).length;

  const nextBook = [...books]
    .sort(compareByPartThenCreated)
    .find((book) => book.readingStatus !== FINISHED_READING_STATUS);

  return {
    finishedInSeries,
    nextBook:
      nextBook === undefined
        ? null
        : { id: nextBook.id, partNumber: nextBook.partNumber, title: nextBook.title },
  };
}

export function toSeriesBookPreview(book: SeriesBookRow): SeriesBookPreview {
  return { ...book, readingStatus: ReadingStatusSchema.parse(book.readingStatus) };
}

function compareByPartThenCreated(first: SeriesBookPreview, second: SeriesBookPreview): number {
  if (first.partNumber !== second.partNumber) {
    if (first.partNumber === null) {
      return 1;
    }
    if (second.partNumber === null) {
      return -1;
    }
    return first.partNumber - second.partNumber;
  }

  return first.createdAt.getTime() - second.createdAt.getTime();
}
