import type { Nullable, ReadingGoalStatus } from "@app/shared";

import { differenceInCalendarDays, isBefore } from "date-fns";

import { startOfUtcDay } from "../../../core/iso-date.js";

export type ReadingGoalProgress = {
  completedAt: Nullable<Date>;
  completedCount: number;
  daysLeft: Nullable<number>;
  remainingCount: number;
  status: ReadingGoalStatus;
};

type ProgressInput = {
  archivedAt: Nullable<Date>;
  deadline: Date;
  finishedDates: Date[];
  now: Date;
  targetCount: number;
};

export function calculateReadingGoalProgress({
  archivedAt,
  deadline,
  finishedDates,
  now,
  targetCount,
}: ProgressInput): ReadingGoalProgress {
  const completedCount = finishedDates.length;
  const status = resolveReadingGoalStatus({
    archivedAt,
    completedCount,
    deadline,
    now,
    targetCount,
  });
  const isCounting = status !== "completed" && status !== "archived";
  return {
    completedAt: completedCount >= targetCount ? (finishedDates[targetCount - 1] ?? null) : null,
    completedCount,
    daysLeft: isCounting ? differenceInCalendarDays(deadline, startOfUtcDay(now)) : null,
    remainingCount: Math.max(0, targetCount - completedCount),
    status,
  };
}

export function resolveReadingGoalStatus({
  archivedAt,
  completedCount,
  deadline,
  now,
  targetCount,
}: {
  archivedAt: Nullable<Date>;
  completedCount: number;
  deadline: Date;
  now: Date;
  targetCount: number;
}): ReadingGoalStatus {
  if (archivedAt !== null) {
    return "archived";
  }
  if (completedCount >= targetCount) {
    return "completed";
  }
  if (isBefore(deadline, startOfUtcDay(now))) {
    return "expired";
  }
  return "active";
}
