import type {
  BookFormat,
  OwnershipStatus,
  ReadingStatus,
  SeriesBookView,
  SeriesDetailsView,
} from "@app/shared";

import type { UiIconName } from "@/components/icons";
import type { LibraryBook } from "@/features/books/model/library-book";

import { FALLBACK_READING_STATUS } from "@/features/books/model/library-book";
import { bookFormats, ownershipStatuses, readingStatuses } from "@/lib/book-status";

import { authorsDifferFromSeries } from "./series-details-derive";

const PERCENT_MAX = 100;

const READING_NOW_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "reading",
  "rereading",
]);

const UPDATE_PROGRESS_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "paused",
  "reading",
  "rereading",
]);

const START_CANDIDATE_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "dnf",
  "not_started",
  "want_to_read",
]);

const AVAILABLE_OWNERSHIP_STATUSES: ReadonlySet<OwnershipStatus> = new Set<OwnershipStatus>([
  "borrowed_from_someone",
  "owned",
]);

export type SeriesBookPrimaryAction = "history" | "start" | "updateProgress";

export type SeriesBookRouteState = "next" | "read" | "unread";

export type SeriesEditionLine = {
  icon: UiIconName;
  label: string;
};

export type SeriesLibraryBookLabels = {
  ageBadge18Plus: string;
  authorsUnknown: string;
  formatLabel: (value: BookFormat) => string;
  ownershipLabel: (value: OwnershipStatus) => string;
  pagesText: (value: number) => string;
  ratingLabel: (value: number) => string;
  statusLabel: (value: ReadingStatus) => string;
};

export type SeriesPersonalState =
  | { kind: "dnf" }
  | { kind: "paused"; pages: null | SeriesProgressPages }
  | { kind: "progress"; pages: SeriesProgressPages; percent: number };

export type SeriesStartTarget = {
  id: string;
  title: string;
};

type SeriesProgressPages = {
  current: number;
  total: number;
};

export function isReadingNow(status: ReadingStatus): boolean {
  return READING_NOW_STATUSES.has(status);
}

export function seriesBookEdition({
  book,
  labels,
}: {
  book: SeriesBookView;
  labels: SeriesLibraryBookLabels;
}): SeriesEditionLine[] {
  const formatLines = book.formats.flatMap((value) => {
    const base = bookFormats.find((entry) => entry.value === value);
    if (base === undefined) return [];
    return [{ icon: base.icon, label: labels.formatLabel(value) }];
  });

  const pagesLines =
    book.pagesCount === null
      ? []
      : [{ icon: "pages" as const, label: labels.pagesText(book.pagesCount) }];

  const yearLines =
    book.publicationYear === null
      ? []
      : [{ icon: "calendar" as const, label: String(book.publicationYear) }];

  return [...formatLines, ...pagesLines, ...yearLines];
}

export function seriesBookPersonalState(book: SeriesBookView): SeriesPersonalState | undefined {
  const pages = seriesProgressPages(book);

  if (isReadingNow(book.readingStatus)) {
    if (pages === null) return undefined;
    return {
      kind: "progress",
      pages,
      percent: Math.round((pages.current / pages.total) * PERCENT_MAX),
    };
  }

  if (book.readingStatus === "paused") return { kind: "paused", pages };
  if (book.readingStatus === "dnf") return { kind: "dnf" };
  return undefined;
}

export function seriesBookPrimaryAction({
  isNextInOrder,
  ownershipStatus,
  readingStatus,
}: {
  isNextInOrder: boolean;
  ownershipStatus: OwnershipStatus;
  readingStatus: ReadingStatus;
}): SeriesBookPrimaryAction | undefined {
  if (readingStatus === "finished") return "history";
  if (UPDATE_PROGRESS_STATUSES.has(readingStatus)) return "updateProgress";
  if (
    START_CANDIDATE_STATUSES.has(readingStatus) &&
    isNextInOrder &&
    isAvailableOwnership(ownershipStatus)
  ) {
    return "start";
  }
  return undefined;
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
    ageBadge: book.ageCategory === "18_plus" ? labels.ageBadge18Plus : undefined,
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

function isAvailableOwnership(status: OwnershipStatus): boolean {
  return AVAILABLE_OWNERSHIP_STATUSES.has(status);
}

function seriesProgressPages(book: SeriesBookView): null | SeriesProgressPages {
  if (book.currentPage === null || book.pagesCount === null || book.pagesCount <= 0) {
    return null;
  }
  return { current: book.currentPage, total: book.pagesCount };
}
