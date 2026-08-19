import type { Nullable, OwnershipStatus, ReadingStatus, SeriesNextBook } from "@app/shared";

import { BOOK_PART_NUMBER_MIN, OwnershipStatusSchema, ReadingStatusSchema } from "@app/shared";
import { compareAsc, max } from "date-fns";

export type EarlierPartCandidate = Pick<SeriesBookPreview, "partNumber" | "readingStatus">;

export type SeriesBookPreview = {
  createdAt: Date;
  id: string;
  ownershipStatus: OwnershipStatus;
  partNumber: Nullable<number>;
  publicationYear: Nullable<number>;
  publisherId: Nullable<string>;
  readingStatus: ReadingStatus;
  title: string;
  updatedAt: Date;
};

export type SeriesBookRow = {
  createdAt: Date;
  id: string;
  ownershipStatus: string;
  partNumber: Nullable<number>;
  publicationYear: Nullable<number>;
  publisherId: Nullable<string>;
  readingStatus: string;
  title: string;
  updatedAt: Date;
};

export type SeriesBooksSummary = {
  finishedInSeries: number;
  hasPublicationYears: boolean;
  hasPublisher: boolean;
  missingPartNumbers: readonly number[];
  nextBook: Nullable<SeriesNextBookSummary>;
  readingInSeries: number;
};

export type SeriesNextBookSummary = Omit<SeriesNextBook, "cover">;

type PartNumberedBook = Pick<SeriesBookPreview, "partNumber">;

type PartOrderedBook = {
  createdAt: Date;
  partNumber: Nullable<number>;
};

type ReadingOrderedBook = PartOrderedBook & { readingStatus: ReadingStatus };

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

export function computeSeriesLastActivityAt({
  books,
  seriesUpdatedAt,
}: {
  books: SeriesBookPreview[];
  seriesUpdatedAt: Date;
}): Date {
  return max([seriesUpdatedAt, ...books.map((book) => book.updatedAt)]);
}

export function countFinishedBooks(books: SeriesBookPreview[]): number {
  return books.filter((book) => book.readingStatus === FINISHED_READING_STATUS).length;
}

export function selectNextBook<TBook extends ReadingOrderedBook>(
  books: readonly TBook[],
): TBook | undefined {
  const ordered = [...books].sort(compareByPartThenCreated);
  const inProgress = ordered.find((book) => IN_PROGRESS_READING_STATUSES.has(book.readingStatus));
  if (inProgress !== undefined) {
    return inProgress;
  }

  return ordered.find((book) => book.readingStatus !== FINISHED_READING_STATUS);
}

export function summarizeSeriesBooks(books: SeriesBookPreview[]): SeriesBooksSummary {
  const nextBook = selectNextBook(books);

  return {
    finishedInSeries: countFinishedBooks(books),
    hasPublicationYears: hasAnyPublicationYear(books),
    hasPublisher: hasAnyPublisher(books),
    missingPartNumbers: collectMissingPartNumbers(books),
    nextBook:
      nextBook === undefined
        ? null
        : {
            id: nextBook.id,
            ownershipStatus: nextBook.ownershipStatus,
            partNumber: nextBook.partNumber,
            title: nextBook.title,
          },
    readingInSeries: countReadingBooks(books),
  };
}

export function toSeriesBookPreview(book: SeriesBookRow): SeriesBookPreview {
  return {
    ...book,
    ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
    readingStatus: ReadingStatusSchema.parse(book.readingStatus),
  };
}

function collectMissingPartNumbers(books: readonly PartNumberedBook[]): readonly number[] {
  const presentParts = new Set<number>();
  for (const book of books) {
    if (book.partNumber !== null) {
      presentParts.add(book.partNumber);
    }
  }

  if (presentParts.size === 0) {
    return [];
  }

  const highestPart = Math.max(...presentParts);

  const missingParts: number[] = [];
  for (let part = BOOK_PART_NUMBER_MIN; part < highestPart; part += 1) {
    if (!presentParts.has(part)) {
      missingParts.push(part);
    }
  }

  return missingParts;
}

function countReadingBooks(books: SeriesBookPreview[]): number {
  return books.filter((book) => IN_PROGRESS_READING_STATUSES.has(book.readingStatus)).length;
}

function hasAnyPublicationYear(
  books: readonly Pick<SeriesBookPreview, "publicationYear">[],
): boolean {
  return books.some((book) => book.publicationYear !== null);
}

function hasAnyPublisher(books: readonly Pick<SeriesBookPreview, "publisherId">[]): boolean {
  return books.some((book) => book.publisherId !== null);
}
