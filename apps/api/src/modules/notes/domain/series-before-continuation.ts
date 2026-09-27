import type { Nullable, ReadingStatus, SeriesBeforeNextBookView } from "@app/shared";

import { compareDesc, max } from "date-fns";

import { resolveSeriesContinuation } from "../../series/index.js";

export const SERIES_BEFORE_CONTINUATION_POLICY = {
  previewLimit: 5,
} as const satisfies { previewLimit: SeriesBeforeNextBookView["previewLimit"] };

const CONTINUATION_STATE_RANK = { other: 2, paused: 1, reading: 0 } as const;

export type BeforeContinuationPlan = {
  continuationBookId: string;
  continuationReadingStatus: ReadingStatus;
  distanceByBookId: ReadonlyMap<string, number>;
};

export type OverviewSeriesCandidate = {
  continuationReadingStatus: ReadingStatus;
  hasBeforeContinuationPlan: boolean;
  lastActivityAt: Nullable<Date>;
  seriesId: string;
};

export type RecapNoteRow = {
  bookId: string;
  id: string;
  isFavorite: boolean;
  isPinned: boolean;
  updatedAt: Date;
};

export type SeriesShapeBook = {
  createdAt: Date;
  id: string;
  partNumber: Nullable<number>;
  readingStatus: ReadingStatus;
};

export function continuationReadingStatusOf(
  books: readonly SeriesShapeBook[],
): Nullable<ReadingStatus> {
  return resolveSeriesContinuation(books)?.continuation.readingStatus ?? null;
}

export function latestActivityOf(dates: readonly Nullable<Date>[]): Nullable<Date> {
  const known = dates.filter((date): date is Date => date !== null);
  return known.length === 0 ? null : max(known);
}

export function pickOverviewSeries(
  candidates: readonly OverviewSeriesCandidate[],
): Nullable<OverviewSeriesCandidate> {
  return [...candidates].sort(compareOverviewCandidates)[0] ?? null;
}

export function planBeforeContinuation({
  books,
  notedBookIds,
}: {
  books: readonly SeriesShapeBook[];
  notedBookIds: ReadonlySet<string>;
}): Nullable<BeforeContinuationPlan> {
  const resolved = resolveSeriesContinuation(books);
  if (resolved === null || resolved.previousClosed.length === 0) {
    return null;
  }

  const distanceByBookId = new Map(
    resolved.previousClosed.map((book, index) => [book.id, resolved.continuationIndex - index]),
  );
  const hasEligibleNote = [...distanceByBookId.keys()].some((bookId) => notedBookIds.has(bookId));
  if (!hasEligibleNote) {
    return null;
  }

  return {
    continuationBookId: resolved.continuation.id,
    continuationReadingStatus: resolved.continuation.readingStatus,
    distanceByBookId,
  };
}

export function rankRecapNotes({
  distanceByBookId,
  notes,
}: {
  distanceByBookId: ReadonlyMap<string, number>;
  notes: readonly RecapNoteRow[];
}): RecapNoteRow[] {
  const distanceOf = (note: RecapNoteRow): number =>
    distanceByBookId.get(note.bookId) ?? Number.POSITIVE_INFINITY;

  return notes
    .filter((note) => distanceByBookId.has(note.bookId))
    .sort(
      (first, second) =>
        Number(second.isPinned) - Number(first.isPinned) ||
        Number(second.isFavorite) - Number(first.isFavorite) ||
        distanceOf(first) - distanceOf(second) ||
        compareDesc(first.updatedAt, second.updatedAt) ||
        first.id.localeCompare(second.id),
    );
}

function compareNullableRecency(first: Nullable<Date>, second: Nullable<Date>): number {
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

function compareOverviewCandidates(
  first: OverviewSeriesCandidate,
  second: OverviewSeriesCandidate,
): number {
  return (
    Number(second.hasBeforeContinuationPlan) - Number(first.hasBeforeContinuationPlan) ||
    continuationStateRankOf(first.continuationReadingStatus) -
      continuationStateRankOf(second.continuationReadingStatus) ||
    compareNullableRecency(first.lastActivityAt, second.lastActivityAt) ||
    first.seriesId.localeCompare(second.seriesId)
  );
}

function continuationStateRankOf(status: ReadingStatus): number {
  switch (status) {
    case "paused":
      return CONTINUATION_STATE_RANK.paused;
    case "reading":
    case "rereading":
      return CONTINUATION_STATE_RANK.reading;
    default:
      return CONTINUATION_STATE_RANK.other;
  }
}
