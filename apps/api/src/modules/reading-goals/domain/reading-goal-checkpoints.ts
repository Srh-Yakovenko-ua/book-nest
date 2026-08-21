import type { Nullable, ReadingGoalCheckpoint, ReadingGoalCheckpointStatus } from "@app/shared";

import { isAfter } from "date-fns";

import type {
  ReadingGoalCandidateBook,
  ReadingGoalQualifyingBook,
} from "./reading-goal-progress.js";

import {
  addDaysToIsoDate,
  daysBetweenIsoDates,
  parseIsoDate,
  startOfUtcDay,
  toIsoDate,
  toNullableIsoDate,
} from "../../../core/iso-date.js";
import { selectQualifyingReadingGoalBooks } from "./reading-goal-progress.js";
import { resolveReadingGoalCountingEnd } from "./reading-goal-window.js";
import { READING_GOAL_CHECKPOINTS } from "./reading-goal.constants.js";

export type ReadingGoalCheckpointDraft = {
  dueDate: string;
  targetCount: number;
};

type CheckpointGridPoint = {
  fraction: number;
  targetCount: number;
};

type CheckpointsInput = {
  archivedAt: Nullable<Date>;
  books: ReadingGoalCandidateBook[];
  deadline: Date;
  goalStartDate: Date;
  now: Date;
  targetCount: number;
};

export function buildReadingGoalCheckpoints({
  archivedAt,
  books,
  deadline,
  goalStartDate,
  now,
  targetCount: goalTargetCount,
}: CheckpointsInput): ReadingGoalCheckpoint[] {
  const qualifyingBooks = selectQualifyingReadingGoalBooks({
    books,
    countingEndsAt: resolveReadingGoalCountingEnd({ archivedAt, deadline }),
    goalStartDate,
  });
  const goalStartIsoDate = toIsoDate(goalStartDate);
  const totalDays = Math.max(
    1,
    daysBetweenIsoDates({ endIsoDate: toIsoDate(deadline), startIsoDate: goalStartIsoDate }) + 1,
  );
  const drafts = checkpointGrid(goalTargetCount).map(({ fraction, targetCount }) => ({
    dueDate: addDaysToIsoDate(goalStartIsoDate, dueDayOffset({ fraction, totalDays })),
    targetCount,
  }));

  return dedupeCheckpointTargets(drafts).map((draft) =>
    toReadingGoalCheckpoint({ draft, qualifyingBooks, today: startOfUtcDay(now) }),
  );
}

export function dedupeCheckpointTargets(
  drafts: ReadingGoalCheckpointDraft[],
): ReadingGoalCheckpointDraft[] {
  const byTargetCount = new Map<number, ReadingGoalCheckpointDraft>(
    drafts.map((draft) => [draft.targetCount, draft]),
  );
  return [...byTargetCount.values()];
}

function checkpointGrid(goalTargetCount: number): CheckpointGridPoint[] {
  if (goalTargetCount <= READING_GOAL_CHECKPOINTS.maxCount) {
    return Array.from({ length: goalTargetCount }, (_value, index) => ({
      fraction: (index + 1) / goalTargetCount,
      targetCount: index + 1,
    }));
  }
  return READING_GOAL_CHECKPOINTS.fractions.map((fraction) => ({
    fraction,
    targetCount: Math.ceil(goalTargetCount * fraction),
  }));
}

function dueDayOffset({ fraction, totalDays }: { fraction: number; totalDays: number }): number {
  return Math.max(0, Math.round(totalDays * fraction) - 1);
}

function resolveCheckpointStatus({
  dueDay,
  reachedAt,
  today,
}: {
  dueDay: Date;
  reachedAt: Nullable<Date>;
  today: Date;
}): ReadingGoalCheckpointStatus {
  if (reachedAt !== null && !isAfter(startOfUtcDay(reachedAt), dueDay)) {
    return "achieved";
  }
  return isAfter(today, dueDay) ? "missed" : "upcoming";
}

function toReadingGoalCheckpoint({
  draft,
  qualifyingBooks,
  today,
}: {
  draft: ReadingGoalCheckpointDraft;
  qualifyingBooks: ReadingGoalQualifyingBook[];
  today: Date;
}): ReadingGoalCheckpoint {
  const reachedAt = qualifyingBooks[draft.targetCount - 1]?.finishedAt ?? null;
  return {
    achievedAt: toNullableIsoDate(reachedAt),
    currentCompletedCount: qualifyingBooks.length,
    dueDate: draft.dueDate,
    status: resolveCheckpointStatus({ dueDay: parseIsoDate(draft.dueDate), reachedAt, today }),
    targetCount: draft.targetCount,
  };
}
