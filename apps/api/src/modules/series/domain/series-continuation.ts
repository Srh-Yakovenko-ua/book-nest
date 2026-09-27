import type {
  Nullable,
  OwnershipStatus,
  ReadingStatus,
  SeriesContinuationRankReason,
} from "@app/shared";

import {
  compareByPartThenCreated,
  isClosedReadingStatus,
  isInProgressReadingStatus,
} from "@app/shared";

export type ContinuationProgressView = {
  currentPage: number;
  percentage: Nullable<number>;
  totalPages: Nullable<number>;
};

export type SeriesContinuation<TBook extends SeriesOrderedBook> = {
  continuation: TBook;
  continuationIndex: number;
  previousClosed: TBook[];
};

export type SeriesOrderedBook = {
  createdAt: Date;
  partNumber: Nullable<number>;
  readingStatus: ReadingStatus;
};

const OWNERSHIP_CONTINUATION_REASON: Record<OwnershipStatus, SeriesContinuationRankReason> = {
  borrowed_from_someone: "available",
  in_transit: "in_transit",
  lent_to_someone: "lent",
  none: "not_owned",
  owned: "available",
  want_to_buy: "want_to_buy",
};

const FULL_PERCENTAGE = 100;

export function resolveContinuationReason(book: {
  ownershipStatus: OwnershipStatus;
  readingStatus: ReadingStatus;
}): SeriesContinuationRankReason {
  if (isInProgressReadingStatus(book.readingStatus)) {
    return "reading";
  }
  if (book.readingStatus === "paused") {
    return "paused";
  }
  return OWNERSHIP_CONTINUATION_REASON[book.ownershipStatus];
}

export function resolveSeriesContinuation<TBook extends SeriesOrderedBook>(
  books: readonly TBook[],
): Nullable<SeriesContinuation<TBook>> {
  const ordered = [...books].sort(compareByPartThenCreated);
  const continuationIndex = ordered.findIndex((book) => !isClosedReadingStatus(book.readingStatus));
  const continuation = ordered[continuationIndex];
  if (continuation === undefined) {
    return null;
  }

  return {
    continuation,
    continuationIndex,
    previousClosed: ordered.slice(0, continuationIndex),
  };
}

export function toContinuationProgress({
  currentPage,
  pagesCount,
}: {
  currentPage: Nullable<number>;
  pagesCount: Nullable<number>;
}): Nullable<ContinuationProgressView> {
  if (currentPage === null) {
    return null;
  }

  const percentage =
    pagesCount !== null && pagesCount > 0
      ? Math.min(FULL_PERCENTAGE, Math.round((currentPage / pagesCount) * FULL_PERCENTAGE))
      : null;

  return { currentPage, percentage, totalPages: pagesCount };
}
