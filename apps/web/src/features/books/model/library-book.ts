import type { BookView, MediaView, OwnershipStatus, ReadingStatus } from "@app/shared";

import type { GenreIconName, UiIconName } from "@/components/icons";

import { ownershipStatuses, readingStatuses, type StatusEntry } from "@/lib/book-status";

export type LibraryBook = {
  authors: string[];
  cover?: { alt?: string; src: string };
  coverMedia?: MediaView;
  genres?: { icon?: GenreIconName; label: string }[];
  href: string;
  id: string;
  isFavorite: boolean;
  isInReadingQueue: boolean;
  loan?: { icon: UiIconName; text: string };
  ownership?: StatusEntry;
  ownershipStatus: OwnershipStatus;
  pagesText?: string;
  progress?: { ariaLabel: string; current: number; total: number; unit: string };
  publisher?: string;
  rating?: number;
  ratingLabel?: string;
  readingStatus: ReadingStatus;
  selected?: boolean;
  series?: string;
  status: StatusEntry;
  tags?: string[];
  title: string;
  year?: number;
};

export type LibraryBookLabels = {
  borrowedFrom: (name: string) => string;
  genreName: (key: string) => string;
  lentTo: (name: string) => string;
  ownershipLabel: (value: OwnershipStatus) => string;
  pagesText: (value: number) => string;
  progressAriaLabel: (current: number, total: number) => string;
  progressUnit: string;
  ratingLabel: (value: number) => string;
  statusLabel: (value: ReadingStatus) => string;
};

export type LibraryBookLinkComponent = React.ComponentType<{
  children?: React.ReactNode;
  className?: string;
  href: string;
}>;

const PROGRESS_STATUSES: readonly ReadingStatus[] = ["reading", "paused", "rereading"];

const FALLBACK_STATUS: StatusEntry =
  readingStatuses.find((entry) => entry.value === "not_started") ?? readingStatuses[0];

export function toLibraryBook(book: BookView, labels: LibraryBookLabels): LibraryBook {
  const baseStatus =
    readingStatuses.find((entry) => entry.value === book.readingStatus) ?? FALLBACK_STATUS;
  const status: StatusEntry = { ...baseStatus, label: labels.statusLabel(book.readingStatus) };
  const genres = book.genres.map((key) => ({ label: labels.genreName(key) }));
  const progress = resolveProgress(book);
  const rating = book.readingProgress?.rating ?? undefined;
  const ownershipBase = ownershipStatuses.find((entry) => entry.value === book.ownershipStatus);
  const ownership =
    book.ownershipStatus === "none" || ownershipBase === undefined
      ? undefined
      : { ...ownershipBase, label: labels.ownershipLabel(book.ownershipStatus) };
  const tags = book.tags.length === 0 ? undefined : book.tags.map((tag) => tag.name);
  const loan = toLoanNote(book, labels);

  return {
    authors: book.authors.map((author) => author.name),
    cover: book.cover ? { alt: book.title, src: book.cover.urls.thumb } : undefined,
    coverMedia: book.cover ?? undefined,
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
    series: book.series === null ? undefined : book.series.name,
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
