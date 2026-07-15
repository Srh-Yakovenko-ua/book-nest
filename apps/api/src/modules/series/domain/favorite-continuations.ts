import type {
  FavoriteSeriesContinuationItem,
  MediaView,
  Nullable,
  OwnershipStatus,
  QueuePriority,
  ReadingStatus,
  SeriesContinuationNextBook,
  SeriesContinuationRankReason,
  SeriesStatus,
} from "@app/shared";

import { compareDesc, max } from "date-fns";

import { compareByPartThenCreated } from "./series-preview.js";

export type ContinuationBook = {
  authors: { id: string; name: string }[];
  cover: Nullable<MediaView>;
  createdAt: Date;
  currentPage: Nullable<number>;
  favoriteAddedAt: Nullable<Date>;
  id: string;
  isFavorite: boolean;
  ownershipStatus: OwnershipStatus;
  pagesCount: Nullable<number>;
  partNumber: Nullable<number>;
  queuePosition: Nullable<number>;
  queuePriority: Nullable<QueuePriority>;
  readingStatus: ReadingStatus;
  title: string;
};

export type ContinuationSeriesGroup = {
  books: ContinuationBook[];
  series: ContinuationSeriesMeta;
};

export type ContinuationSeriesMeta = {
  id: string;
  status: SeriesStatus;
  title: string;
  totalBooks: Nullable<number>;
};

type AssembledContinuation = {
  favoriteBooksCount: number;
  lastFavoriteAddedAt: Nullable<Date>;
  nextBook: ContinuationBook;
  progress: ContinuationProgress;
  rankReason: SeriesContinuationRankReason;
  series: ContinuationSeriesView;
};

type ContinuationProgress = {
  closedBooks: number;
  finishedBooks: number;
  totalBooks: number;
};

type ContinuationSeriesView = {
  id: string;
  status: SeriesStatus;
  title: string;
  totalBooks: number;
};

const MIN_SERIES_BOOKS = 2;
const FULL_PERCENTAGE = 100;

const CLOSED_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>(["dnf", "finished"]);

const READING_STATUSES_AS_READING: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "reading",
  "rereading",
]);

const OWNERSHIP_RANK_REASON: Record<OwnershipStatus, SeriesContinuationRankReason> = {
  borrowed_from_someone: "available",
  in_transit: "in_transit",
  lent_to_someone: "lent",
  none: "not_owned",
  owned: "available",
  want_to_buy: "want_to_buy",
};

const RANK_PRIORITY: Record<SeriesContinuationRankReason, number> = {
  available: 2,
  in_transit: 4,
  lent: 3,
  not_owned: 6,
  paused: 1,
  reading: 0,
  want_to_buy: 5,
};

export function assembleContinuations(
  groups: ContinuationSeriesGroup[],
): FavoriteSeriesContinuationItem[] {
  const assembled: AssembledContinuation[] = [];
  for (const group of groups) {
    const continuation = assembleGroup(group);
    if (continuation !== null) {
      assembled.push(continuation);
    }
  }

  return assembled.sort(compareContinuations).map(toContinuationItem);
}

function assembleGroup(group: ContinuationSeriesGroup): Nullable<AssembledContinuation> {
  const { books, series } = group;
  if (books.length < MIN_SERIES_BOOKS) {
    return null;
  }

  const favorites = books.filter((book) => book.isFavorite);
  if (favorites.length === 0) {
    return null;
  }

  const ordered = [...books].sort(compareByPartThenCreated);
  const nextBook = ordered.find((book) => !CLOSED_STATUSES.has(book.readingStatus));
  if (nextBook === undefined) {
    return null;
  }

  return {
    favoriteBooksCount: favorites.length,
    lastFavoriteAddedAt: computeLastFavoriteAddedAt(favorites),
    nextBook,
    progress: computeProgress(books),
    rankReason: resolveRankReason(nextBook),
    series: {
      id: series.id,
      status: series.status,
      title: series.title,
      totalBooks: series.totalBooks ?? books.length,
    },
  };
}

function compareByFavoriteRecencyDesc(first: Nullable<Date>, second: Nullable<Date>): number {
  if (first === null && second === null) {
    return 0;
  }
  if (first === null) {
    return 1;
  }
  if (second === null) {
    return -1;
  }
  return compareDesc(first, second);
}

function compareContinuations(first: AssembledContinuation, second: AssembledContinuation): number {
  const rankDiff = RANK_PRIORITY[first.rankReason] - RANK_PRIORITY[second.rankReason];
  if (rankDiff !== 0) {
    return rankDiff;
  }

  const recencyDiff = compareByFavoriteRecencyDesc(
    first.lastFavoriteAddedAt,
    second.lastFavoriteAddedAt,
  );
  if (recencyDiff !== 0) {
    return recencyDiff;
  }

  return first.series.id.localeCompare(second.series.id);
}

function computeLastFavoriteAddedAt(favorites: ContinuationBook[]): Nullable<Date> {
  const dates = favorites
    .map((book) => book.favoriteAddedAt)
    .filter((date): date is Date => date !== null);
  if (dates.length === 0) {
    return null;
  }
  return max(dates);
}

function computeProgress(books: ContinuationBook[]): ContinuationProgress {
  let finishedBooks = 0;
  let closedBooks = 0;
  for (const book of books) {
    if (book.readingStatus === "finished") {
      finishedBooks += 1;
      closedBooks += 1;
    } else if (book.readingStatus === "dnf") {
      closedBooks += 1;
    }
  }
  return { closedBooks, finishedBooks, totalBooks: books.length };
}

function resolveRankReason(book: ContinuationBook): SeriesContinuationRankReason {
  if (READING_STATUSES_AS_READING.has(book.readingStatus)) {
    return "reading";
  }
  if (book.readingStatus === "paused") {
    return "paused";
  }
  return OWNERSHIP_RANK_REASON[book.ownershipStatus];
}

function toContinuationItem(continuation: AssembledContinuation): FavoriteSeriesContinuationItem {
  return {
    favoriteBooksCount: continuation.favoriteBooksCount,
    lastFavoriteAddedAt: toIsoString(continuation.lastFavoriteAddedAt),
    nextBook: toNextBookView(continuation.nextBook),
    progress: continuation.progress,
    rankReason: continuation.rankReason,
    series: continuation.series,
  };
}

function toIsoString(date: Nullable<Date>): Nullable<string> {
  return date === null ? null : date.toISOString();
}

function toNextBookView(book: ContinuationBook): SeriesContinuationNextBook {
  return {
    authors: book.authors,
    cover: book.cover,
    favoriteAddedAt: toIsoString(book.favoriteAddedAt),
    id: book.id,
    isFavorite: book.isFavorite,
    ownershipStatus: book.ownershipStatus,
    queue:
      book.queuePosition === null
        ? null
        : { position: book.queuePosition, priority: book.queuePriority },
    readingProgress: toReadingProgressView(book),
    readingStatus: book.readingStatus,
    seriesPosition: book.partNumber,
    title: book.title,
  };
}

function toReadingProgressView(
  book: ContinuationBook,
): SeriesContinuationNextBook["readingProgress"] {
  if (book.currentPage === null) {
    return null;
  }

  const percentage =
    book.pagesCount !== null && book.pagesCount > 0
      ? Math.round((book.currentPage / book.pagesCount) * FULL_PERCENTAGE)
      : null;

  return { currentPage: book.currentPage, percentage, totalPages: book.pagesCount };
}
