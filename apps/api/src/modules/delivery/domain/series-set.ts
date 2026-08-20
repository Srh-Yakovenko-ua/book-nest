import type { Nullable, OwnershipStatus } from "@app/shared";

import { ownershipStatusHoldsCopy } from "@app/shared";

export type SeriesSetBook = {
  isSubject: boolean;
  ownershipStatus: OwnershipStatus;
  partNumber: Nullable<number>;
};

export type SeriesSetRow = {
  books: readonly SeriesSetBook[];
  id: string;
  totalBooks: Nullable<number>;
};

export function countCompletingSubjects(row: SeriesSetRow): number {
  if (!isMultiBookSeries(row)) {
    return 0;
  }
  if (row.totalBooks !== null && row.books.length < row.totalBooks) {
    return 0;
  }

  const subjectCount = countSubjects(row);
  if (subjectCount === 0) {
    return 0;
  }

  const stillMissing = row.books.some(
    (book) => !book.isSubject && !ownershipStatusHoldsCopy(book.ownershipStatus),
  );

  return stillMissing ? 0 : subjectCount;
}

export function countGapClosingSubjects(row: SeriesSetRow): number {
  const heldParts = row.books.flatMap((book) =>
    !book.isSubject && ownershipStatusHoldsCopy(book.ownershipStatus) && book.partNumber !== null
      ? [book.partNumber]
      : [],
  );
  if (heldParts.length === 0) {
    return 0;
  }

  const lowestHeldPart = Math.min(...heldParts);
  const highestHeldPart = Math.max(...heldParts);

  return row.books.filter(
    (book) =>
      book.isSubject &&
      book.partNumber !== null &&
      book.partNumber > lowestHeldPart &&
      book.partNumber < highestHeldPart,
  ).length;
}

export function countSubjects(row: SeriesSetRow): number {
  return row.books.filter((book) => book.isSubject).length;
}

export function isMultiBookSeries(row: SeriesSetRow): boolean {
  return row.books.length > 1 || (row.totalBooks ?? 0) > 1;
}
