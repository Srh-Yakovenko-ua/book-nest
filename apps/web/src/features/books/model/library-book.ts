import type { BookFormat, BookView, MediaView, OwnershipStatus, ReadingStatus } from "@app/shared";

import { type GenreIconName, isGenreIconName, type UiIconName } from "@/components/icons";
import {
  bookFormats,
  ownershipStatuses,
  readingStatuses,
  type StatusDefinition,
  type StatusEntry,
} from "@/lib/book-status";

export type LibraryBook = {
  ageBadge?: string;
  authors: string[];
  cover?: { alt?: string; src: string };
  coverMedia?: MediaView;
  formats?: LibraryBookFormat[];
  genres?: { icon?: GenreIconName; label: string }[];
  href: string;
  id: string;
  isFavorite: boolean;
  isInReadingQueue?: boolean;
  loan?: { icon: UiIconName; text: string };
  originalTitle?: string;
  ownership?: StatusEntry;
  ownershipStatus: OwnershipStatus;
  pagesText?: string;
  progress?: { ariaLabel: string; current: number; total: number; unit: string };
  publisher?: string;
  rating?: number;
  ratingLabel?: string;
  readingStatus: ReadingStatus;
  selected?: boolean;
  series?: LibraryBookSeries;
  status: StatusEntry;
  tags?: string[];
  title: string;
  year?: number;
};

export type LibraryBookFormat = {
  icon: UiIconName;
  label: string;
  value: BookFormat;
};

export type LibraryBookLabels = {
  ageBadge18Plus: string;
  borrowedFrom: (name: string) => string;
  formatLabel: (value: BookFormat) => string;
  genreName: (key: string) => string;
  lentTo: (name: string) => string;
  ownershipLabel: (value: OwnershipStatus) => string;
  pagesText: (value: number) => string;
  progressAriaLabel: (current: number, total: number) => string;
  progressUnit: string;
  ratingLabel: (value: number) => string;
  seriesPosition: (position: number, total: number) => string;
  statusLabel: (value: ReadingStatus) => string;
};

export type LibraryBookLinkComponent = React.ComponentType<{
  children?: React.ReactNode;
  className?: string;
  href: string;
}>;

export type LibraryBookSeries = {
  href: string;
  id: string;
  name: string;
  position?: number;
  positionLabel?: string;
  total?: number;
};

const PROGRESS_STATUSES: readonly ReadingStatus[] = ["reading", "paused", "rereading"];

export const FALLBACK_READING_STATUS: StatusDefinition =
  readingStatuses.find((entry) => entry.value === "not_started") ?? readingStatuses[0];

export function toLibraryBook(book: BookView, labels: LibraryBookLabels): LibraryBook {
  const baseStatus =
    readingStatuses.find((entry) => entry.value === book.readingStatus) ?? FALLBACK_READING_STATUS;
  const status: StatusEntry = { ...baseStatus, label: labels.statusLabel(book.readingStatus) };
  const genres = book.genres.map((key) => ({
    icon: isGenreIconName(key) ? key : undefined,
    label: labels.genreName(key),
  }));
  const progress = resolveProgress(book);
  const rating = book.readingProgress?.rating ?? undefined;
  const ownershipBase = ownershipStatuses.find((entry) => entry.value === book.ownershipStatus);
  const ownership =
    book.ownershipStatus === "none" || ownershipBase === undefined
      ? undefined
      : { ...ownershipBase, label: labels.ownershipLabel(book.ownershipStatus) };
  const tags = book.tags.length === 0 ? undefined : book.tags.map((tag) => tag.name);
  const loan = toLoanNote(book, labels);
  const formats = toFormats(book, labels);
  const series = toSeries(book, labels);

  return {
    ageBadge: book.ageCategory === "18_plus" ? labels.ageBadge18Plus : undefined,
    authors: book.authors.map((author) => author.name),
    cover: book.cover ? { alt: book.title, src: book.cover.urls.card } : undefined,
    coverMedia: book.cover ?? undefined,
    formats,
    genres,
    href: `/books/${book.id}`,
    id: book.id,
    isFavorite: book.isFavorite,
    isInReadingQueue: book.isInReadingQueue,
    loan,
    ownership,
    ownershipStatus: book.ownershipStatus,
    pagesText: book.pagesCount === null ? undefined : labels.pagesText(book.pagesCount),
    progress:
      progress === undefined
        ? undefined
        : {
            ...progress,
            ariaLabel: labels.progressAriaLabel(progress.current, progress.total),
            unit: labels.progressUnit,
          },
    publisher: book.publisher === null ? undefined : book.publisher.name,
    rating,
    ratingLabel: rating === undefined ? undefined : labels.ratingLabel(rating),
    readingStatus: book.readingStatus,
    series,
    status,
    tags,
    title: book.title,
    year: book.publicationYear ?? undefined,
  };
}

function resolveProgress(book: BookView): undefined | { current: number; total: number } {
  if (!PROGRESS_STATUSES.includes(book.readingStatus)) return undefined;
  const currentPage = book.readingProgress?.currentPage;
  if (book.pagesCount === null || currentPage === null || currentPage === undefined) {
    return undefined;
  }
  return { current: currentPage, total: book.pagesCount };
}

function seriesPositionLabel({
  labels,
  position,
  total,
}: {
  labels: LibraryBookLabels;
  position?: number;
  total?: number;
}): string | undefined {
  if (position === undefined) return undefined;
  if (total === undefined) return String(position);
  return labels.seriesPosition(position, total);
}

function toFormats(book: BookView, labels: LibraryBookLabels): LibraryBookFormat[] {
  return book.formats.flatMap((value) => {
    const base = bookFormats.find((entry) => entry.value === value);
    if (base === undefined) return [];
    return [{ icon: base.icon, label: labels.formatLabel(value), value }];
  });
}

function toLoanNote(book: BookView, labels: LibraryBookLabels): LibraryBook["loan"] {
  if (book.loanInfo === null) return undefined;
  const name = book.loanInfo.personName.trim();
  if (name === "") return undefined;
  if (book.ownershipStatus === "lent_to_someone") {
    return { icon: "arrow-up-right", text: labels.lentTo(name) };
  }
  if (book.ownershipStatus === "borrowed_from_someone") {
    return { icon: "arrow-down-circle", text: labels.borrowedFrom(name) };
  }
  return undefined;
}

function toSeries(book: BookView, labels: LibraryBookLabels): LibraryBookSeries | undefined {
  if (book.series === null) return undefined;
  const position = book.partNumber ?? undefined;
  const total = book.series.totalBooks ?? undefined;
  const positionLabel = seriesPositionLabel({ labels, position, total });

  return {
    href: `/series/${book.series.id}`,
    id: book.series.id,
    name: book.series.name,
    position,
    positionLabel,
    total,
  };
}
