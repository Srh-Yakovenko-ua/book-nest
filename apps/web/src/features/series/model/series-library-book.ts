import type {
  OwnershipStatus,
  ReadingStatus,
  SeriesBookView,
  SeriesDetailsView,
} from "@app/shared";

import type { LibraryBook } from "@/features/books/model/library-book";

import { FALLBACK_READING_STATUS } from "@/features/books/model/library-book";
import { ownershipStatuses, readingStatuses } from "@/lib/book-status";

import { authorsDifferFromSeries } from "./series-details-derive";

const PERCENT_MAX = 100;

const READING_NOW_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "reading",
  "rereading",
]);

export type SeriesBookProgress = {
  current: number;
  percent: number;
  total: number;
};

export type SeriesBookRouteState = "next" | "read" | "unread";

export type SeriesLibraryBookLabels = {
  authorsUnknown: string;
  ownershipLabel: (value: OwnershipStatus) => string;
  ratingLabel: (value: number) => string;
  statusLabel: (value: ReadingStatus) => string;
};

export function isReadingNow(status: ReadingStatus): boolean {
  return READING_NOW_STATUSES.has(status);
}

export function seriesBookProgress(book: SeriesBookView): SeriesBookProgress | undefined {
  if (!isReadingNow(book.readingStatus)) return undefined;
  if (book.currentPage === null || book.pagesCount === null || book.pagesCount <= 0) {
    return undefined;
  }

  return {
    current: book.currentPage,
    percent: Math.round((book.currentPage / book.pagesCount) * PERCENT_MAX),
    total: book.pagesCount,
  };
}

export function seriesBookRouteState({
  isNextInOrder,
  readingStatus,
}: {
  isNextInOrder: boolean;
  readingStatus: ReadingStatus;
}): SeriesBookRouteState {
  if (isNextInOrder) return "next";
  if (readingStatus === "finished") return "read";
  return "unread";
}

export function toSeriesLibraryBook({
  book,
  labels,
  seriesAuthors,
}: {
  book: SeriesBookView;
  labels: SeriesLibraryBookLabels;
  seriesAuthors: SeriesDetailsView["authors"];
}): LibraryBook {
  const baseStatus =
    readingStatuses.find((entry) => entry.value === book.readingStatus) ?? FALLBACK_READING_STATUS;
  const ownershipBase = ownershipStatuses.find((entry) => entry.value === book.ownershipStatus);
  const rating = book.rating === null || book.rating === 0 ? undefined : book.rating;

  return {
    authors: contextAuthors({ book, labels, seriesAuthors }),
    cover: book.cover ? { alt: book.title, src: book.cover.urls.card } : undefined,
    href: `/books/${book.id}`,
    id: book.id,
    isFavorite: book.isFavorite,
    originalTitle: book.originalTitle ?? undefined,
    ownership:
      book.ownershipStatus === "none" || ownershipBase === undefined
        ? undefined
        : { ...ownershipBase, label: labels.ownershipLabel(book.ownershipStatus) },
    ownershipStatus: book.ownershipStatus,
    rating,
    ratingLabel: rating === undefined ? undefined : labels.ratingLabel(rating),
    readingStatus: book.readingStatus,
    status: { ...baseStatus, label: labels.statusLabel(book.readingStatus) },
    title: book.title,
  };
}

function contextAuthors({
  book,
  labels,
  seriesAuthors,
}: {
  book: SeriesBookView;
  labels: SeriesLibraryBookLabels;
  seriesAuthors: SeriesDetailsView["authors"];
}): string[] {
  if (!authorsDifferFromSeries({ bookAuthors: book.authors, seriesAuthors })) return [];
  if (book.authors.length === 0) return [labels.authorsUnknown];
  return book.authors.map((author) => author.name);
}
