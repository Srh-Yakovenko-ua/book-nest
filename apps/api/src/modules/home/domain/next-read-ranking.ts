import type {
  HomeNextReadReason,
  HomeNextReadSource,
  Nullable,
  SeriesContinuationRankReason,
} from "@app/shared";

import { HOME_DASHBOARD_RULES } from "@app/shared";
import { compareAsc } from "date-fns";

import type { HomeTemporalContext } from "./home-temporal-context.js";

import { assertNever } from "../../../core/assert-never.js";
import { daysBetweenIsoDates, toZonedIsoDate } from "../../../core/iso-date.js";
import { compareText } from "./compare-text.js";
import { isAvailableOwnership, isQueueEligibleStatus } from "./next-read-eligibility.js";

export type NextReadFavoriteContinuation = {
  bookId: string;
  ownershipStatus: string;
  rankReason: SeriesContinuationRankReason;
};

export type NextReadLibraryBook = {
  createdAt: Date;
  id: string;
  isFavorite: boolean;
  readingStatus: string;
  seriesId: Nullable<string>;
};

export type NextReadPick = {
  bookId: string;
  reason: HomeNextReadReason;
  source: HomeNextReadSource;
};

export type NextReadQueueEntry = {
  id: string;
  ownershipStatus: string;
  queuePosition: Nullable<number>;
  readingStatus: string;
};

type LibraryGroup = "favorite_on_shelf" | "favorite_planned" | "other_on_shelf" | "planned";

const LIBRARY_GROUP_ORDER: readonly LibraryGroup[] = [
  "favorite_planned",
  "planned",
  "favorite_on_shelf",
  "other_on_shelf",
];

const ROTATION_EPOCH_DAY = "1970-01-01";

const RESUMABLE_OR_STARTABLE_CONTINUATIONS: ReadonlySet<SeriesContinuationRankReason> =
  new Set<SeriesContinuationRankReason>(["available", "paused"]);

export function isLibraryBookEligible({
  book,
  continuationBySeriesId,
  disabledSeriesIds,
}: {
  book: NextReadLibraryBook;
  continuationBySeriesId: ReadonlyMap<string, string>;
  disabledSeriesIds: ReadonlySet<string>;
}): boolean {
  if (book.seriesId === null || disabledSeriesIds.has(book.seriesId)) {
    return true;
  }
  return continuationBySeriesId.get(book.seriesId) === book.id;
}

export function mergeNextReadPicks({
  limit,
  sources,
}: {
  limit: number;
  sources: NextReadPick[][];
}): NextReadPick[] {
  const seen = new Set<string>();
  const merged: NextReadPick[] = [];
  for (const pick of sources.flat()) {
    if (merged.length >= limit) {
      break;
    }
    if (seen.has(pick.bookId)) {
      continue;
    }
    seen.add(pick.bookId);
    merged.push(pick);
  }
  return merged;
}

export function pickFavoriteSeriesCandidates(
  continuations: readonly NextReadFavoriteContinuation[],
): NextReadPick[] {
  return continuations.flatMap((continuation): NextReadPick[] =>
    RESUMABLE_OR_STARTABLE_CONTINUATIONS.has(continuation.rankReason) &&
    isAvailableOwnership(continuation.ownershipStatus)
      ? [{ bookId: continuation.bookId, reason: "favorite_series", source: "favorite_series" }]
      : [],
  );
}

export function pickQueueCandidates({
  blockedBookIds,
  entries,
}: {
  blockedBookIds: ReadonlySet<string>;
  entries: readonly NextReadQueueEntry[];
}): NextReadPick[] {
  return entries
    .flatMap((entry) =>
      entry.queuePosition !== null &&
      isQueueEligibleStatus(entry.readingStatus) &&
      isAvailableOwnership(entry.ownershipStatus) &&
      !blockedBookIds.has(entry.id)
        ? [{ id: entry.id, position: entry.queuePosition }]
        : [],
    )
    .sort((left, right) => left.position - right.position || compareText(left.id, right.id))
    .map((entry): NextReadPick => ({ bookId: entry.id, reason: "queue_next", source: "queue" }));
}

export function rankLibraryCandidates({
  books,
  continuationBySeriesId,
  disabledSeriesIds,
  temporal,
}: {
  books: readonly NextReadLibraryBook[];
  continuationBySeriesId: ReadonlyMap<string, string>;
  disabledSeriesIds: ReadonlySet<string>;
  temporal: HomeTemporalContext;
}): NextReadPick[] {
  const dayIndex = daysBetweenIsoDates({
    endIsoDate: temporal.today,
    startIsoDate: ROTATION_EPOCH_DAY,
  });
  const eligible = books.filter((book) =>
    isLibraryBookEligible({ book, continuationBySeriesId, disabledSeriesIds }),
  );

  return LIBRARY_GROUP_ORDER.flatMap((group) => {
    const members = eligible
      .filter((book) => resolveLibraryGroup(book) === group)
      .sort(compareOldestFirst);
    return rotateByDay({ dayIndex, items: members }).map((book): NextReadPick => ({
      bookId: book.id,
      reason: resolveLibraryReason({ book, group, temporal }),
      source: "library",
    }));
  });
}

export function resolveLibraryGroup(book: NextReadLibraryBook): Nullable<LibraryGroup> {
  if (book.readingStatus === "want_to_read") {
    return book.isFavorite ? "favorite_planned" : "planned";
  }
  if (book.readingStatus === "not_started") {
    return book.isFavorite ? "favorite_on_shelf" : "other_on_shelf";
  }
  return null;
}

export function rotateByDay<TItem>({
  dayIndex,
  items,
}: {
  dayIndex: number;
  items: readonly TItem[];
}): TItem[] {
  if (items.length === 0) {
    return [];
  }
  const offset = dayIndex % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function compareOldestFirst(left: NextReadLibraryBook, right: NextReadLibraryBook): number {
  return compareAsc(left.createdAt, right.createdAt) || compareText(left.id, right.id);
}

function isLongOnShelf({
  createdAt,
  temporal,
}: {
  createdAt: Date;
  temporal: HomeTemporalContext;
}): boolean {
  const createdDay = toZonedIsoDate({ instant: createdAt, timeZone: temporal.timeZone });
  return (
    daysBetweenIsoDates({ endIsoDate: temporal.today, startIsoDate: createdDay }) >=
    HOME_DASHBOARD_RULES.nextRead.longOnShelfDays
  );
}

function resolveLibraryReason({
  book,
  group,
  temporal,
}: {
  book: NextReadLibraryBook;
  group: LibraryGroup;
  temporal: HomeTemporalContext;
}): HomeNextReadReason {
  switch (group) {
    case "favorite_on_shelf":
      return "favorite_on_shelf";
    case "favorite_planned":
      return "favorite_planned";
    case "other_on_shelf":
      return isLongOnShelf({ createdAt: book.createdAt, temporal }) ? "long_on_shelf" : "discovery";
    case "planned":
      return "planned";
    default:
      return assertNever(group);
  }
}
