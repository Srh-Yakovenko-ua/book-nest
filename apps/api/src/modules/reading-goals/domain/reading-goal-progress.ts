import type { Nullable, ReadingGoalResult, ReadingGoalStatus } from "@app/shared";

import { compareAsc, isAfter, isBefore } from "date-fns";

import type { ReadingGoalQualificationWindow } from "./reading-goal-window.js";

import { daysBetweenUtcDays, startOfUtcDay } from "../../../core/iso-date.js";
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
  archivedDay: Nullable<Date>;
  completedCount: number;
  deadline: Date;
  targetCount: number;
  today: Date;
};

type ProgressInput = {
  archivedDay: Nullable<Date>;
  books: ReadingGoalCandidateBook[];
  deadline: Date;
  goalStartDate: Date;
  targetCount: number;
  today: Date;
};

export function calculateReadingGoalProgress({
  archivedDay,
  books,
  deadline,
  goalStartDate,
  targetCount,
  today,
}: ProgressInput): ReadingGoalProgress {
  const qualifyingBooks = selectQualifyingReadingGoalBooks({
    books,
    countingEndsAt: resolveReadingGoalCountingEnd({ archivedDay, deadline }),
    goalStartDate,
  });
  const completedCount = qualifyingBooks.length;
  const lifecycle = { archivedDay, completedCount, deadline, targetCount, today };
  const status = resolveReadingGoalStatus(lifecycle);
  return {
    completedAt: qualifyingBooks[targetCount - 1]?.finishedAt ?? null,
    completedCount,
    daysLeft: status === "active" ? remainingCalendarDays({ deadline, today }) : null,
    remainingCount: Math.max(0, targetCount - completedCount),
    result: resolveReadingGoalResult(lifecycle),
    status,
  };
}

export function hasDeadlinePassed({
  deadline,
  reference,
}: {
  deadline: Date;
  reference: Date;
}): boolean {
  return isBefore(deadline, startOfUtcDay(reference));
}

export function qualifiesForReadingGoal({
  countingEndsAt,
  finishedAt,
  goalStartDate,
}: ReadingGoalQualificationWindow & { finishedAt: Nullable<Date> }): boolean {
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
  archivedDay,
  completedCount,
  deadline,
  targetCount,
  today,
}: LifecycleInput): Nullable<ReadingGoalResult> {
  if (completedCount >= targetCount) {
    return "completed";
  }
  return hasDeadlinePassed({ deadline, reference: archivedDay ?? today }) ? "expired" : null;
}

export function resolveReadingGoalStatus({
  archivedDay,
  completedCount,
  deadline,
  targetCount,
  today,
}: LifecycleInput): ReadingGoalStatus {
  if (archivedDay !== null) {
    return "archived";
  }
  if (completedCount >= targetCount) {
    return "completed";
  }
  if (hasDeadlinePassed({ deadline, reference: today })) {
    return "expired";
  }
  return "active";
}

export function selectQualifyingReadingGoalBooks({
  books,
  countingEndsAt,
  goalStartDate,
}: ReadingGoalQualificationWindow & {
  books: ReadingGoalCandidateBook[];
}): ReadingGoalQualifyingBook[] {
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

function remainingCalendarDays({ deadline, today }: { deadline: Date; today: Date }): number {
  return Math.max(0, daysBetweenUtcDays({ end: deadline, start: today }));
}
