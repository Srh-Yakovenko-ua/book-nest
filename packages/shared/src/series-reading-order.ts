import { compareAsc } from "date-fns";

import type { ReadingStatus } from "./book-enums.js";
import type { Nullable } from "./common.js";

import { isInProgressReadingStatus } from "./book-enums.js";

export type EarlierPartCandidate = {
  partNumber: Nullable<number>;
  readingStatus: ReadingStatus;
};

type PartOrderedBook = {
  createdAt: Date;
  partNumber: Nullable<number>;
};

type ReadingOrderedBook = PartOrderedBook & { readingStatus: ReadingStatus };

const FINISHED_READING_STATUS: ReadingStatus = "finished";

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
  books: readonly EarlierPartCandidate[];
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

export function selectNextBook<TBook extends ReadingOrderedBook>(
  books: readonly TBook[],
): TBook | undefined {
  const ordered = [...books].sort(compareByPartThenCreated);
  const inProgress = ordered.find((book) => isInProgressReadingStatus(book.readingStatus));
  if (inProgress !== undefined) {
    return inProgress;
  }

  return ordered.find((book) => book.readingStatus !== FINISHED_READING_STATUS);
}
