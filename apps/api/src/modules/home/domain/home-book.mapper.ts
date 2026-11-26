import type {
  HomeActiveBook,
  HomeNextReadCandidate,
  MediaView,
  Nullable,
  OwnershipStatus,
  ReadingStatus,
} from "@app/shared";

import {
  OwnershipStatusSchema,
  QueuePriorityReasonSchema,
  QueuePrioritySchema,
  ReadingStatusSchema,
} from "@app/shared";

import { toNullableIsoDate } from "../../../core/iso-date.js";
import { computeProgressPercent, resolveCurrentCyclePage } from "./reading-progress.js";

export type HomeBookFacts = {
  authors: HomeActiveBook["authors"];
  cover: Nullable<MediaView>;
  currentPage: Nullable<number>;
  cycleStartedAt: Nullable<string>;
  id: string;
  isFavorite: boolean;
  ownershipStatus: OwnershipStatus;
  pagesCount: Nullable<number>;
  progressPercent: Nullable<number>;
  queue: HomeNextReadCandidate["queue"];
  readingStatus: ReadingStatus;
  series: HomeActiveBook["series"];
  title: string;
};

export type HomeBookRecord = {
  _count: { readingCycles: number };
  authors: { author: { id: string; name: string } }[];
  id: string;
  isFavorite: boolean;
  ownershipStatus: string;
  pagesCount: Nullable<number>;
  partNumber: Nullable<number>;
  queuePosition: Nullable<number>;
  queuePriority: Nullable<string>;
  queuePriorityReason: Nullable<string>;
  queuePriorityTargetDate: Nullable<Date>;
  readingCycles: { _count: { events: number }; startedAt: Nullable<Date> }[];
  readingProgress: Nullable<{ currentPage: Nullable<number> }>;
  readingStatus: string;
  series: Nullable<{ deletedAt: Nullable<Date>; id: string; name: string }>;
  title: string;
};

export function toHomeBookFacts({
  book,
  cover,
}: {
  book: HomeBookRecord;
  cover: Nullable<MediaView>;
}): HomeBookFacts {
  const readingStatus = ReadingStatusSchema.parse(book.readingStatus);
  const [activeCycle] = book.readingCycles;
  const currentPage = resolveCurrentCyclePage({
    currentPage: book.readingProgress?.currentPage ?? null,
    endedCyclesCount: book._count.readingCycles,
    hasCurrentCycleProgress: activeCycle !== undefined && activeCycle._count.events > 0,
    readingStatus,
  });

  return {
    authors: book.authors.map((bookAuthor) => ({
      id: bookAuthor.author.id,
      name: bookAuthor.author.name,
    })),
    cover,
    currentPage,
    cycleStartedAt: toNullableIsoDate(activeCycle?.startedAt ?? null),
    id: book.id,
    isFavorite: book.isFavorite,
    ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
    pagesCount: book.pagesCount,
    progressPercent: computeProgressPercent({ currentPage, pagesCount: book.pagesCount }),
    queue: toQueueRef(book),
    readingStatus,
    series: toSeriesRef(book),
    title: book.title,
  };
}

function toQueueRef(book: HomeBookRecord): HomeNextReadCandidate["queue"] {
  if (book.queuePosition === null) {
    return null;
  }
  return {
    position: book.queuePosition,
    priority: QueuePrioritySchema.nullable().parse(book.queuePriority),
    reason: QueuePriorityReasonSchema.nullable().parse(book.queuePriorityReason),
    targetDate: toNullableIsoDate(book.queuePriorityTargetDate),
  };
}

function toSeriesRef(book: HomeBookRecord): HomeActiveBook["series"] {
  if (book.series === null || book.series.deletedAt !== null) {
    return null;
  }
  return { id: book.series.id, name: book.series.name, partNumber: book.partNumber };
}
