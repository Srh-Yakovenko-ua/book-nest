import type {
  EarlierPartCandidate,
  InTransitImpact,
  Nullable,
  OwnershipStatus,
  QueuePriority,
} from "@app/shared";

import { computeHasUnreadEarlierParts, QueuePrioritySchema, selectNextBook } from "@app/shared";

import type { SeriesSetRow } from "./series-set.js";

import {
  countCompletingSubjects,
  countGapClosingSubjects,
  isMultiBookSeries,
} from "./series-set.js";

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
  const arrivingSets = seriesRows.map((row) => toArrivingSet(row));
  const completed = collectCompletedSeries(arrivingSets);
  const completedSeriesIds = new Set(completed.map((entry) => entry.seriesId));

  return [
    ...completedImpact(completed),
    ...ownershipGapsImpact(arrivingSets.filter((row) => !completedSeriesIds.has(row.id))),
    ...queueImpact(queueRows),
    ...nextStepImpact(seriesRows),
    ...goalImpact(goalRows),
  ];
}

function collectCompletedSeries(rows: readonly SeriesSetRow[]): CompletedSeries[] {
  return rows.flatMap((row) => {
    const arrivingCount = countCompletingSubjects(row);
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

function nextStepImpact(rows: readonly ImpactSeriesRow[]): InTransitImpact[] {
  const seriesCount = rows.filter(
    (row) =>
      isMultiBookSeries(toArrivingSet(row)) && selectNextBook(row.books)?.isArriving === true,
  ).length;
  if (seriesCount === 0) {
    return [];
  }

  return [{ kind: "series_next_step", seriesCount }];
}

function ownershipGapsImpact(rows: readonly SeriesSetRow[]): InTransitImpact[] {
  const gaps = rows.flatMap((row) => {
    const booksCount = countGapClosingSubjects(row);
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

function toArrivingSet(row: ImpactSeriesRow): SeriesSetRow {
  return {
    books: row.books.map((book) => ({
      isSubject: book.isArriving,
      ownershipStatus: book.ownershipStatus,
      partNumber: book.partNumber,
    })),
    id: row.id,
    totalBooks: row.totalBooks,
  };
}
