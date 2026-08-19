import type { Nullable, OwnershipStatus, ReadingStatus, SeriesNextBook } from "@app/shared";

import {
  BOOK_PART_NUMBER_MIN,
  isInProgressReadingStatus,
  OwnershipStatusSchema,
  ReadingStatusSchema,
  selectNextBook,
} from "@app/shared";
import { max } from "date-fns";

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

const FINISHED_READING_STATUS: ReadingStatus = "finished";

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
  return books.filter((book) => isInProgressReadingStatus(book.readingStatus)).length;
}

function hasAnyPublicationYear(
  books: readonly Pick<SeriesBookPreview, "publicationYear">[],
): boolean {
  return books.some((book) => book.publicationYear !== null);
}

function hasAnyPublisher(books: readonly Pick<SeriesBookPreview, "publisherId">[]): boolean {
  return books.some((book) => book.publisherId !== null);
}
