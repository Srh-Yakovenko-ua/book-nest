import type { Nullable } from "@app/shared";

import { ReadingGoalActivityTypeSchema } from "@app/shared";
import { compareAsc } from "date-fns";
import { z } from "zod";

import type { ReadingGoalQualifyingBook } from "./reading-goal-progress.js";

import { assertNever } from "../../../core/assert-never.js";
import { parseIsoDate } from "../../../core/iso-date.js";
import { compareReadingGoalQualifyingBooks } from "./reading-goal-progress.js";

export type ReadingGoalActivityReplayRow = {
  bookId: Nullable<string>;
  createdAt: Date;
  id: string;
  metadata: unknown;
  type: string;
};

export type ReadingGoalCountedOrdinalReplay = {
  activityId: string;
  completedCount: number;
  recordedCompletedCount: number;
};

export type ReadingGoalCountedReplay =
  | { ordinals: ReadingGoalCountedOrdinalReplay[]; status: "replayed" }
  | { skip: ReadingGoalCountedReplaySkip; status: "skipped" };

export type ReadingGoalCountedReplaySkip =
  | { activityId: string; reason: "unknown_activity_type"; type: string }
  | {
      activityId: string;
      reason:
        | "ambiguous_deleted_book_tie"
        | "missing_goal_created"
        | "negative_running_count"
        | "unknown_metadata_shape";
    }
  | { countedTotal: number; reason: "final_count_mismatch"; replayedCount: number };

type ParsedReplayEvent = { event: ReplayEvent } | { skip: ReadingGoalCountedReplaySkip };

type ReplayEvent =
  | (ReplayEventBase & {
      hasDeletedBook: boolean;
      kind: "book_counted";
      order: ReadingGoalQualifyingBook;
      recordedCompletedCount: number;
    })
  | (ReplayEventBase & { kind: "book_uncounted" })
  | (ReplayEventBase & { kind: "count_unchanged" })
  | (ReplayEventBase & { kind: "goal_created" });

type ReplayEventBase = {
  activityId: string;
  createdAt: Date;
};

const BookCountedMetadataSchema = z.object({
  completedCount: z.number().int().nonnegative(),
  finishedAt: z.iso.date(),
});

const REPLAY_KIND_RANK: Record<ReplayEvent["kind"], number> = {
  book_counted: 2,
  book_uncounted: 1,
  count_unchanged: 3,
  goal_created: 0,
};

const DELETED_BOOK_ORDER_KEY = "";

export function replayReadingGoalCountedOrdinals({
  activities,
  countedTotal,
}: {
  activities: readonly ReadingGoalActivityReplayRow[];
  countedTotal: number;
}): ReadingGoalCountedReplay {
  const events: ReplayEvent[] = [];
  for (const activity of activities) {
    const parsed = parseReplayEvent(activity);
    if ("skip" in parsed) {
      return { skip: parsed.skip, status: "skipped" };
    }
    events.push(parsed.event);
  }
  const sortedEvents = events.sort(compareReplayEvents);
  const deletedBookTie = findDeletedBookTie(sortedEvents);
  if (deletedBookTie !== null) {
    return skipped({ activityId: deletedBookTie, reason: "ambiguous_deleted_book_tie" });
  }
  return replayEvents({ countedTotal, events: sortedEvents });
}

function compareReplayEvents(left: ReplayEvent, right: ReplayEvent): number {
  const byCreatedAt = compareAsc(left.createdAt, right.createdAt);
  if (byCreatedAt !== 0) {
    return byCreatedAt;
  }
  const byKind = REPLAY_KIND_RANK[left.kind] - REPLAY_KIND_RANK[right.kind];
  if (byKind !== 0) {
    return byKind;
  }
  if (left.kind === "book_counted" && right.kind === "book_counted") {
    const byBook = compareReadingGoalQualifyingBooks(left.order, right.order);
    if (byBook !== 0) {
      return byBook;
    }
  }
  return left.activityId.localeCompare(right.activityId);
}

function findDeletedBookTie(events: readonly ReplayEvent[]): Nullable<string> {
  for (const [index, right] of events.entries()) {
    const left = events[index - 1];
    if (left === undefined || left.kind !== "book_counted" || right.kind !== "book_counted") {
      continue;
    }
    if (!left.hasDeletedBook && !right.hasDeletedBook) {
      continue;
    }
    if (
      compareAsc(left.createdAt, right.createdAt) === 0 &&
      compareAsc(left.order.finishedAt, right.order.finishedAt) === 0
    ) {
      return left.hasDeletedBook ? left.activityId : right.activityId;
    }
  }
  return null;
}

function parseReplayEvent(activity: ReadingGoalActivityReplayRow): ParsedReplayEvent {
  const base = { activityId: activity.id, createdAt: activity.createdAt };
  const parsedType = ReadingGoalActivityTypeSchema.safeParse(activity.type);
  if (!parsedType.success) {
    return {
      skip: { activityId: activity.id, reason: "unknown_activity_type", type: activity.type },
    };
  }
  const activityType = parsedType.data;
  switch (activityType) {
    case "book_counted": {
      const metadata = BookCountedMetadataSchema.safeParse(activity.metadata);
      if (!metadata.success) {
        return { skip: { activityId: activity.id, reason: "unknown_metadata_shape" } };
      }
      return {
        event: {
          ...base,
          hasDeletedBook: activity.bookId === null,
          kind: "book_counted",
          order: {
            bookId: activity.bookId ?? DELETED_BOOK_ORDER_KEY,
            finishedAt: parseIsoDate(metadata.data.finishedAt),
          },
          recordedCompletedCount: metadata.data.completedCount,
        },
      };
    }
    case "book_uncounted":
      return { event: { ...base, kind: "book_uncounted" } };
    case "deadline_changed":
    case "goal_archived":
    case "goal_completed":
    case "goal_expired":
    case "goal_renamed":
    case "target_changed":
      return { event: { ...base, kind: "count_unchanged" } };
    case "goal_created":
      return { event: { ...base, kind: "goal_created" } };
    default:
      return assertNever(activityType);
  }
}

function replayEvents({
  countedTotal,
  events,
}: {
  countedTotal: number;
  events: readonly ReplayEvent[];
}): ReadingGoalCountedReplay {
  const ordinals: ReadingGoalCountedOrdinalReplay[] = [];
  let hasGoalCreated = false;
  let runningCount = 0;
  for (const event of events) {
    if (event.kind === "goal_created") {
      hasGoalCreated = true;
      continue;
    }
    if (event.kind === "count_unchanged") {
      continue;
    }
    if (!hasGoalCreated) {
      return skipped({ activityId: event.activityId, reason: "missing_goal_created" });
    }
    if (event.kind === "book_uncounted") {
      runningCount -= 1;
      if (runningCount < 0) {
        return skipped({ activityId: event.activityId, reason: "negative_running_count" });
      }
      continue;
    }
    runningCount += 1;
    ordinals.push({
      activityId: event.activityId,
      completedCount: runningCount,
      recordedCompletedCount: event.recordedCompletedCount,
    });
  }
  if (runningCount !== countedTotal) {
    return skipped({ countedTotal, reason: "final_count_mismatch", replayedCount: runningCount });
  }
  return { ordinals, status: "replayed" };
}

function skipped(skip: ReadingGoalCountedReplaySkip): ReadingGoalCountedReplay {
  return { skip, status: "skipped" };
}
