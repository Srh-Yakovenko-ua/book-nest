import type { LibraryOverviewView, OwnershipStatus, ReadingStatus } from "@app/shared";

import type { ActiveReadingRow } from "../infrastructure/book-library-read.repository.js";

export type ActiveReadingView = LibraryOverviewView["activeReading"];

type ActiveReadingBook = NonNullable<ActiveReadingView>["book"];

type LibraryOverviewConfig = {
  readonly borrowedStatuses: OwnershipStatus[];
  readonly finishedStatuses: ReadingStatus[];
  readonly inTransitStatuses: OwnershipStatus[];
  readonly physicalOwnershipStatuses: OwnershipStatus[];
  readonly readingInProgressStatuses: ReadingStatus[];
  readonly recentLimit: number;
  readonly topLimit: number;
  readonly wantToBuyStatuses: OwnershipStatus[];
  readonly wantToReadStatuses: ReadingStatus[];
};

const BORROWED_OWNERSHIP_STATUSES: OwnershipStatus[] = ["borrowed_from_someone", "lent_to_someone"];

export const LIBRARY_OVERVIEW: LibraryOverviewConfig = {
  borrowedStatuses: BORROWED_OWNERSHIP_STATUSES,
  finishedStatuses: ["finished"],
  inTransitStatuses: ["in_transit"],
  physicalOwnershipStatuses: ["owned", ...BORROWED_OWNERSHIP_STATUSES],
  readingInProgressStatuses: ["reading", "rereading"],
  recentLimit: 3,
  topLimit: 3,
  wantToBuyStatuses: ["want_to_buy"],
  wantToReadStatuses: ["want_to_read"],
};

export function buildActiveReadingView(activeBooks: ActiveReadingRow[]): ActiveReadingView {
  if (activeBooks.length === 0) {
    return undefined;
  }
  const pagesAhead = activeBooks.reduce((total, activeBook) => {
    if (activeBook.pagesCount === null || activeBook.currentPage === null) {
      return total;
    }
    return total + Math.max(0, activeBook.pagesCount - activeBook.currentPage);
  }, 0);
  return { book: resolveSingleActiveBook(activeBooks), pagesAhead };
}

export function intersectOwnership({
  allowed,
  scope,
}: {
  allowed: OwnershipStatus[];
  scope?: OwnershipStatus[];
}): OwnershipStatus[] {
  if (scope === undefined) {
    return allowed;
  }
  return allowed.filter((status) => scope.includes(status));
}

function resolveSingleActiveBook(activeBooks: ActiveReadingRow[]): ActiveReadingBook {
  if (activeBooks.length !== 1) {
    return null;
  }
  const [onlyBook] = activeBooks;
  if (onlyBook === undefined || onlyBook.pagesCount === null) {
    return null;
  }
  return {
    currentPage: onlyBook.currentPage ?? 0,
    id: onlyBook.id,
    pagesCount: onlyBook.pagesCount,
    title: onlyBook.title,
  };
}
