import type { Nullable, ReadingGoalResult, ReadingGoalStatus } from "@app/shared";

import { compareAsc, differenceInCalendarDays, isAfter, isBefore } from "date-fns";

import { startOfUtcDay } from "../../../core/iso-date.js";
import { resolveReadingGoalCountingEnd } from "./reading-goal-window.js";

export type ReadingGoalCandidateBook = {
  bookId: string;
  finishedAt: Nullable<Date>;
};

export type ReadingGoalProgress = {
  completedAt: Nullable<Date>;
  completedCount: number;
  daysLeft: Nullable<number>;
  remainingCount: number;
  result: Nullable<ReadingGoalResult>;
  status: ReadingGoalStatus;
};

export type ReadingGoalQualifyingBook = {
  bookId: string;
  finishedAt: Date;
};

type LifecycleInput = {
  archivedAt: Nullable<Date>;
  completedCount: number;
  deadline: Date;
  now: Date;
  targetCount: number;
};

type ProgressInput = {
  archivedAt: Nullable<Date>;
  books: ReadingGoalCandidateBook[];
  deadline: Date;
  goalStartDate: Date;
  now: Date;
  targetCount: number;
};

type QualificationWindow = {
  countingEndsAt: Date;
  goalStartDate: Date;
};

export function calculateReadingGoalProgress({
  archivedAt,
  books,
  deadline,
  goalStartDate,
  now,
  targetCount,
}: ProgressInput): ReadingGoalProgress {
  const qualifyingBooks = selectQualifyingReadingGoalBooks({
    books,
    countingEndsAt: resolveReadingGoalCountingEnd({ archivedAt, deadline }),
    goalStartDate,
  });
  const completedCount = qualifyingBooks.length;
  const lifecycle = { archivedAt, completedCount, deadline, now, targetCount };
  const status = resolveReadingGoalStatus(lifecycle);
  return {
    completedAt: qualifyingBooks[targetCount - 1]?.finishedAt ?? null,
    completedCount,
    daysLeft: status === "active" ? remainingCalendarDays({ deadline, now }) : null,
    remainingCount: Math.max(0, targetCount - completedCount),
    result: resolveReadingGoalResult(lifecycle),
    status,
  };
}

export function qualifiesForReadingGoal({
  countingEndsAt,
  finishedAt,
  goalStartDate,
}: QualificationWindow & { finishedAt: Nullable<Date> }): boolean {
  if (finishedAt === null) {
    return false;
  }
  const finishedDay = startOfUtcDay(finishedAt);
  return (
    !isBefore(finishedDay, startOfUtcDay(goalStartDate)) &&
    !isAfter(finishedDay, startOfUtcDay(countingEndsAt))
  );
}

export function resolveReadingGoalResult({
  archivedAt,
  completedCount,
  deadline,
  now,
  targetCount,
}: LifecycleInput): Nullable<ReadingGoalResult> {
  if (completedCount >= targetCount) {
    return "completed";
  }
  return hasDeadlinePassed({ deadline, reference: archivedAt ?? now }) ? "expired" : null;
}

export function resolveReadingGoalStatus({
  archivedAt,
  completedCount,
  deadline,
  now,
  targetCount,
}: LifecycleInput): ReadingGoalStatus {
  if (archivedAt !== null) {
    return "archived";
  }
  if (completedCount >= targetCount) {
    return "completed";
  }
  if (hasDeadlinePassed({ deadline, reference: now })) {
    return "expired";
  }
  return "active";
}

export function selectQualifyingReadingGoalBooks({
  books,
  countingEndsAt,
  goalStartDate,
}: QualificationWindow & { books: ReadingGoalCandidateBook[] }): ReadingGoalQualifyingBook[] {
  return books
    .flatMap(({ bookId, finishedAt }) => {
      if (
        finishedAt === null ||
        !qualifiesForReadingGoal({ countingEndsAt, finishedAt, goalStartDate })
      ) {
        return [];
      }
      return [{ bookId, finishedAt }];
    })
    .sort(compareQualifyingBooks);
}

function compareQualifyingBooks(
  left: ReadingGoalQualifyingBook,
  right: ReadingGoalQualifyingBook,
): number {
  const byFinishedAt = compareAsc(left.finishedAt, right.finishedAt);
  if (byFinishedAt !== 0) {
    return byFinishedAt;
  }
  return left.bookId.localeCompare(right.bookId);
}

function hasDeadlinePassed({ deadline, reference }: { deadline: Date; reference: Date }): boolean {
  return isBefore(deadline, startOfUtcDay(reference));
}

function remainingCalendarDays({ deadline, now }: { deadline: Date; now: Date }): number {
  return Math.max(0, differenceInCalendarDays(deadline, startOfUtcDay(now)));
}
