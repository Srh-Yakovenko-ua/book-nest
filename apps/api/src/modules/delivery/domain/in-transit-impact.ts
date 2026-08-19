import type { InTransitImpact, Nullable, OwnershipStatus, QueuePriority } from "@app/shared";

import { ownershipStatusHoldsCopy, QueuePrioritySchema } from "@app/shared";

import type { EarlierPartCandidate } from "../../series/index.js";

import { computeHasUnreadEarlierParts, selectNextBook } from "../../series/index.js";

export type ImpactGoalRow = {
  bookId: string;
  goalId: string;
};

export type ImpactQueueRow = {
  id: string;
  partNumber: Nullable<number>;
  queuePriority: Nullable<QueuePriority>;
  seriesBooks: readonly EarlierPartCandidate[];
};

export type ImpactSeriesBook = {
  createdAt: Date;
  isArriving: boolean;
  ownershipStatus: OwnershipStatus;
  partNumber: Nullable<number>;
  readingStatus: EarlierPartCandidate["readingStatus"];
};

export type ImpactSeriesRow = {
  books: readonly ImpactSeriesBook[];
  id: string;
  totalBooks: Nullable<number>;
};

export type InTransitImpactData = {
  goalRows: readonly ImpactGoalRow[];
  queueRows: readonly ImpactQueueRow[];
  seriesRows: readonly ImpactSeriesRow[];
};

const HIGH_QUEUE_PRIORITY: QueuePriority = QueuePrioritySchema.enum.high;

type CompletedSeries = {
  arrivingCount: number;
  seriesId: string;
};

export function buildInTransitImpact({
  goalRows,
  queueRows,
  seriesRows,
}: InTransitImpactData): InTransitImpact[] {
  const completed = collectCompletedSeries(seriesRows);
  const completedSeriesIds = new Set(completed.map((entry) => entry.seriesId));

  return [
    ...completedImpact(completed),
    ...ownershipGapsImpact(seriesRows.filter((row) => !completedSeriesIds.has(row.id))),
    ...queueImpact(queueRows),
    ...nextStepImpact(seriesRows),
    ...goalImpact(goalRows),
  ];
}

function collectCompletedSeries(rows: readonly ImpactSeriesRow[]): CompletedSeries[] {
  return rows.flatMap((row) => {
    const arrivingCount = countCompletingArrivals(row);
    return arrivingCount === 0 ? [] : [{ arrivingCount, seriesId: row.id }];
  });
}

function completedImpact(completed: readonly CompletedSeries[]): InTransitImpact[] {
  if (completed.length === 0) {
    return [];
  }

  return [
    {
      booksCount: completed.reduce((total, entry) => total + entry.arrivingCount, 0),
      kind: "series_completed",
      seriesCount: completed.length,
    },
  ];
}

function countCompletingArrivals(row: ImpactSeriesRow): number {
  if (!isMultiBookSeries(row)) {
    return 0;
  }
  if (row.totalBooks !== null && row.books.length < row.totalBooks) {
    return 0;
  }

  const arrivingCount = row.books.filter((book) => book.isArriving).length;
  if (arrivingCount === 0) {
    return 0;
  }

  const stillMissing = row.books.some(
    (book) => !book.isArriving && !ownershipStatusHoldsCopy(book.ownershipStatus),
  );

  return stillMissing ? 0 : arrivingCount;
}

function countOwnershipGapArrivals(row: ImpactSeriesRow): number {
  const ownedParts = row.books.flatMap((book) =>
    ownershipStatusHoldsCopy(book.ownershipStatus) && book.partNumber !== null
      ? [book.partNumber]
      : [],
  );
  if (ownedParts.length === 0) {
    return 0;
  }

  const lowestOwnedPart = Math.min(...ownedParts);
  const highestOwnedPart = Math.max(...ownedParts);

  return row.books.filter(
    (book) =>
      book.isArriving &&
      book.partNumber !== null &&
      book.partNumber > lowestOwnedPart &&
      book.partNumber < highestOwnedPart,
  ).length;
}

function goalImpact(rows: readonly ImpactGoalRow[]): InTransitImpact[] {
  if (rows.length === 0) {
    return [];
  }

  return [
    {
      booksCount: new Set(rows.map((row) => row.bookId)).size,
      goalsCount: new Set(rows.map((row) => row.goalId)).size,
      kind: "goal_books",
    },
  ];
}

function isMultiBookSeries(row: ImpactSeriesRow): boolean {
  return row.books.length > 1 || (row.totalBooks ?? 0) > 1;
}

function nextStepImpact(rows: readonly ImpactSeriesRow[]): InTransitImpact[] {
  const seriesCount = rows.filter(
    (row) => isMultiBookSeries(row) && selectNextBook(row.books)?.isArriving === true,
  ).length;
  if (seriesCount === 0) {
    return [];
  }

  return [{ kind: "series_next_step", seriesCount }];
}

function ownershipGapsImpact(rows: readonly ImpactSeriesRow[]): InTransitImpact[] {
  const gaps = rows.flatMap((row) => {
    const booksCount = countOwnershipGapArrivals(row);
    return booksCount === 0 ? [] : [booksCount];
  });
  if (gaps.length === 0) {
    return [];
  }

  return [
    {
      booksCount: gaps.reduce((total, count) => total + count, 0),
      kind: "series_ownership_gaps",
      seriesCount: gaps.length,
    },
  ];
}

function queueImpact(rows: readonly ImpactQueueRow[]): InTransitImpact[] {
  const unblocked = rows.filter(
    (row) =>
      computeHasUnreadEarlierParts({
        books: row.seriesBooks,
        currentPartNumber: row.partNumber,
      }) !== true,
  );
  if (unblocked.length === 0) {
    return [];
  }

  return [
    {
      booksCount: unblocked.length,
      highPriorityCount: unblocked.filter((row) => row.queuePriority === HIGH_QUEUE_PRIORITY)
        .length,
      kind: "queue_available",
    },
  ];
}
