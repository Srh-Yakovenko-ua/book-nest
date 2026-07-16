import type {
  Nullable,
  SeriesOrderFixChange,
  SeriesOrderFixStrategy,
  SeriesOrderQueuePreviewItem,
} from "@app/shared";

import { compareByPartThenCreated } from "../../series/index.js";
import { type SeriesOrderDetectedIssue } from "./series-order-detection.js";

export type FixPlan = {
  addedBookIds: string[];
  after: SeriesOrderQueuePreviewItem[];
  before: SeriesOrderQueuePreviewItem[];
  changes: SeriesOrderFixChange[];
  limitExceeded: boolean;
  movedBookIds: string[];
  shiftedUnrelatedBooksCount: number;
  warnings: string[];
};

export type FixPlanQueueItem = {
  bookId: string;
  queuePosition: number;
  seriesId: Nullable<string>;
  title: string;
};

type ResolvedOrdering = {
  addedBookIds: string[];
  entries: FixPlanQueueItem[];
  limitExceeded: boolean;
};

const EPOCH = new Date(0);

export function computeFixPlan({
  issue,
  queue,
  queueLimit,
  strategy,
}: {
  issue: SeriesOrderDetectedIssue;
  queue: FixPlanQueueItem[];
  queueLimit: number;
  strategy: SeriesOrderFixStrategy;
}): FixPlan {
  const affectedSeriesId = issue.series.id;
  const resolved =
    strategy === "REORDER_SERIES_SLOTS"
      ? resolveReorder({ affectedSeriesId, issue, queue })
      : resolveAdd({ affectedSeriesId, issue, queue, queueLimit, strategy });

  const before = queue.map((item) => toPreviewItem({ affectedSeriesId, item }));
  const after = resolved.entries
    .map((item) => toPreviewItem({ affectedSeriesId, item }))
    .sort((first, second) => first.queuePosition - second.queuePosition);

  const addedBookIds = new Set(resolved.addedBookIds);
  const beforePositionByBookId = new Map(queue.map((item) => [item.bookId, item.queuePosition]));
  const changes = buildChanges({ addedBookIds, beforePositionByBookId, entries: resolved.entries });

  const movedBookIds = changes
    .filter((change) => change.type === "move")
    .map((change) => change.bookId);
  const shiftedUnrelatedBooksCount = countShiftedUnrelated({
    affectedSeriesId,
    entries: resolved.entries,
    movedBookIds: new Set(movedBookIds),
  });

  return {
    addedBookIds: resolved.addedBookIds,
    after,
    before,
    changes,
    limitExceeded: resolved.limitExceeded,
    movedBookIds,
    shiftedUnrelatedBooksCount,
    warnings: resolved.limitExceeded ? [buildLimitWarning(queueLimit)] : [],
  };
}

function buildChanges({
  addedBookIds,
  beforePositionByBookId,
  entries,
}: {
  addedBookIds: Set<string>;
  beforePositionByBookId: Map<string, number>;
  entries: FixPlanQueueItem[];
}): SeriesOrderFixChange[] {
  const changes: SeriesOrderFixChange[] = [];
  for (const entry of entries) {
    if (addedBookIds.has(entry.bookId)) {
      changes.push({
        bookId: entry.bookId,
        fromPosition: null,
        title: entry.title,
        toPosition: entry.queuePosition,
        type: "add",
      });
      continue;
    }
    const fromPosition = beforePositionByBookId.get(entry.bookId);
    if (fromPosition !== undefined && fromPosition !== entry.queuePosition) {
      changes.push({
        bookId: entry.bookId,
        fromPosition,
        title: entry.title,
        toPosition: entry.queuePosition,
        type: "move",
      });
    }
  }

  return changes.sort((first, second) => first.toPosition - second.toPosition);
}

function buildLimitWarning(queueLimit: number): string {
  return `Додавання перевищить ліміт черги у ${queueLimit} книг`;
}

function countShiftedUnrelated({
  affectedSeriesId,
  entries,
  movedBookIds,
}: {
  affectedSeriesId: string;
  entries: FixPlanQueueItem[];
  movedBookIds: Set<string>;
}): number {
  return entries.filter(
    (entry) => movedBookIds.has(entry.bookId) && entry.seriesId !== affectedSeriesId,
  ).length;
}

function resolveAdd({
  affectedSeriesId,
  issue,
  queue,
  queueLimit,
  strategy,
}: {
  affectedSeriesId: string;
  issue: SeriesOrderDetectedIssue;
  queue: FixPlanQueueItem[];
  queueLimit: number;
  strategy: SeriesOrderFixStrategy;
}): ResolvedOrdering {
  const toAdd =
    strategy === "ADD_NEXT_PREVIOUS_BEFORE" ? issue.addableBooks.slice(0, 1) : issue.addableBooks;
  const addEntries: FixPlanQueueItem[] = toAdd.map((book) => ({
    bookId: book.id,
    queuePosition: 0,
    seriesId: affectedSeriesId,
    title: book.title,
  }));

  const affectedIndex = queue.findIndex((item) => item.bookId === issue.primary.affectedBook.id);
  const insertAt = affectedIndex === -1 ? queue.length : affectedIndex;
  const ordered = [...queue.slice(0, insertAt), ...addEntries, ...queue.slice(insertAt)];

  return {
    addedBookIds: toAdd.map((book) => book.id),
    entries: ordered.map((item, index) => ({ ...item, queuePosition: index + 1 })),
    limitExceeded: queue.length + toAdd.length > queueLimit,
  };
}

function resolveReorder({
  affectedSeriesId,
  issue,
  queue,
}: {
  affectedSeriesId: string;
  issue: SeriesOrderDetectedIssue;
  queue: FixPlanQueueItem[];
}): ResolvedOrdering {
  const partOrderByBookId = new Map(
    issue.inPlayBooks.map((book) => [
      book.id,
      { createdAt: book.createdAt, partNumber: book.partNumber },
    ]),
  );
  const partOrderOf = (item: FixPlanQueueItem): { createdAt: Date; partNumber: Nullable<number> } =>
    partOrderByBookId.get(item.bookId) ?? { createdAt: EPOCH, partNumber: null };

  const seriesItems = queue.filter((item) => item.seriesId === affectedSeriesId);
  const slots = seriesItems
    .map((item) => item.queuePosition)
    .sort((first, second) => first - second);
  const sortedSeriesItems = [...seriesItems].sort((first, second) =>
    compareByPartThenCreated(partOrderOf(first), partOrderOf(second)),
  );

  const newPositionByBookId = new Map<string, number>();
  sortedSeriesItems.forEach((item, index) => {
    const slot = slots[index];
    if (slot !== undefined) {
      newPositionByBookId.set(item.bookId, slot);
    }
  });

  return {
    addedBookIds: [],
    entries: queue.map((item) => ({
      ...item,
      queuePosition: newPositionByBookId.get(item.bookId) ?? item.queuePosition,
    })),
    limitExceeded: false,
  };
}

function toPreviewItem({
  affectedSeriesId,
  item,
}: {
  affectedSeriesId: string;
  item: FixPlanQueueItem;
}): SeriesOrderQueuePreviewItem {
  return {
    belongsToAffectedSeries: item.seriesId === affectedSeriesId,
    bookId: item.bookId,
    queuePosition: item.queuePosition,
    title: item.title,
  };
}
