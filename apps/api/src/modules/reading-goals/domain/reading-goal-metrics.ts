import type { Nullable, ReadingGoalMetrics, ReadingGoalStatus } from "@app/shared";

import { differenceInCalendarDays } from "date-fns";

import type { ReadingGoalCandidateBook, ReadingGoalProgress } from "./reading-goal-progress.js";

import { startOfUtcDay, toNullableIsoDate } from "../../../core/iso-date.js";
import { calculateReadingGoalPace } from "./reading-goal-pace.js";
import {
  calculateReadingGoalProgress,
  selectQualifyingReadingGoalBooks,
} from "./reading-goal-progress.js";
import { calculateReadingGoalProjection } from "./reading-goal-projection.js";
import { calculateReadingGoalRisk } from "./reading-goal-risk.js";
import { resolveReadingGoalQualificationWindow } from "./reading-goal-window.js";
import { INCLUSIVE_DAY, READING_GOAL_ROUNDING, roundTo } from "./reading-goal.constants.js";

export type ReadingGoalCalculation = {
  metrics: ReadingGoalMetrics;
  progress: ReadingGoalProgress;
};

export type ReadingGoalCalculationGoal = {
  archivedDay: Nullable<Date>;
  createdDay: Date;
  deadline: Date;
  targetCount: number;
};

export type ReadingGoalSnapshotBook = {
  bookId: string;
  qualifiedFinishedAt: Nullable<Date>;
};

type IdleDaysInput = {
  goalStartDate: Date;
  lastCountedAt: Nullable<Date>;
  status: ReadingGoalStatus;
  today: Date;
};

type MetricsInput = {
  goal: ReadingGoalCalculationGoal;
  snapshotBooks: ReadingGoalSnapshotBook[];
  today: Date;
};

type RequiredPaceInput = {
  daysLeft: Nullable<number>;
  remainingCount: number;
  status: ReadingGoalStatus;
};

export function calculateReadingGoalMetrics({
  goal,
  snapshotBooks,
  today,
}: MetricsInput): ReadingGoalCalculation {
  const { archivedDay, deadline, targetCount } = goal;
  const qualificationWindow = resolveReadingGoalQualificationWindow(goal);
  const { goalStartDate } = qualificationWindow;
  const qualifyingBooks = selectQualifyingReadingGoalBooks({
    books: snapshotBooks.map(toCandidateBook),
    ...qualificationWindow,
  });
  const progress = calculateReadingGoalProgress({
    archivedDay,
    books: qualifyingBooks,
    deadline,
    goalStartDate,
    targetCount,
    today,
  });
  const { completedAt, completedCount, daysLeft, remainingCount, status } = progress;
  const schedule = calculateReadingGoalPace({
    archivedDay,
    completedAt,
    completedCount,
    daysLeft,
    deadline,
    goalStartDate,
    remainingCount,
    status,
    targetCount,
    today,
  });
  const projection = calculateReadingGoalProjection({
    completedAt,
    completedCount,
    deadline,
    elapsedDays: schedule.elapsedDays,
    remainingCount,
    status,
    today,
  });
  const requiredBooksPerDay = calculateRequiredBooksPerDay({ daysLeft, remainingCount, status });
  const lastCountedAt = qualifyingBooks.at(-1)?.finishedAt ?? null;
  const daysSinceLastCounted = calculateDaysSinceLastCounted({
    goalStartDate,
    lastCountedAt,
    status,
    today,
  });
  const risk = calculateReadingGoalRisk({
    actualBooksPerDay: projection.actualBooksPerDay,
    daysLeft,
    daysSinceLastCounted,
    elapsedDays: schedule.elapsedDays,
    elapsedPercent: schedule.elapsedPercent,
    pace: schedule.pace,
    projectedDaysDelta: projection.projectedDaysDelta,
    remainingCount,
    requiredBooksPerDay,
    status,
  });

  return {
    metrics: {
      actualBooksPerDay: roundPerDayRate(projection.actualBooksPerDay),
      averageDaysPerBook: calculateAverageDaysPerBook({
        completedCount,
        elapsedDays: schedule.elapsedDays,
      }),
      completedCount,
      daysLeft,
      daysSinceLastCounted,
      elapsedDays: schedule.elapsedDays,
      elapsedPercent: schedule.elapsedPercent,
      expectedCompletedCount: schedule.expectedCompletedCount,
      lastCountedAt: toNullableIsoDate(lastCountedAt),
      pace: schedule.pace,
      paceDeltaBooks: schedule.paceDeltaBooks,
      paceDeltaPercent: schedule.paceDeltaPercent,
      progressPercent: schedule.progressPercent,
      projectedCompletionDate: toNullableIsoDate(projection.projectedCompletionDate),
      projectedDaysDelta: projection.projectedDaysDelta,
      projectionConfidence: projection.projectionConfidence,
      remainingCount,
      requiredBooksPerDay: roundNullablePerDayRate(requiredBooksPerDay),
      requiredDaysPerBook: calculateRequiredDaysPerBook(requiredBooksPerDay),
      riskLevel: risk.riskLevel,
      riskReasons: risk.riskReasons,
      totalDays: schedule.totalDays,
    },
    progress,
  };
}

function calculateAverageDaysPerBook({
  completedCount,
  elapsedDays,
}: {
  completedCount: number;
  elapsedDays: number;
}): Nullable<number> {
  if (completedCount === 0) {
    return null;
  }
  return roundDaysPerBook(elapsedDays / completedCount);
}

function calculateDaysSinceLastCounted({
  goalStartDate,
  lastCountedAt,
  status,
  today,
}: IdleDaysInput): Nullable<number> {
  if (!tracksIdleDays(status)) {
    return null;
  }
  return Math.max(
    0,
    differenceInCalendarDays(startOfUtcDay(today), lastCountedAt ?? goalStartDate),
  );
}

function calculateRequiredBooksPerDay({
  daysLeft,
  remainingCount,
  status,
}: RequiredPaceInput): Nullable<number> {
  if (status !== "active" || remainingCount === 0 || daysLeft === null) {
    return null;
  }
  return remainingCount / Math.max(1, daysLeft + INCLUSIVE_DAY);
}

function calculateRequiredDaysPerBook(requiredBooksPerDay: Nullable<number>): Nullable<number> {
  if (requiredBooksPerDay === null) {
    return null;
  }
  return roundDaysPerBook(1 / requiredBooksPerDay);
}

function roundDaysPerBook(value: number): number {
  return roundTo({ decimals: READING_GOAL_ROUNDING.daysPerBook, value });
}

function roundNullablePerDayRate(value: Nullable<number>): Nullable<number> {
  return value === null ? null : roundPerDayRate(value);
}

function roundPerDayRate(value: number): number {
  return roundTo({ decimals: READING_GOAL_ROUNDING.perDayRate, value });
}

function toCandidateBook({
  bookId,
  qualifiedFinishedAt,
}: ReadingGoalSnapshotBook): ReadingGoalCandidateBook {
  return { bookId, finishedAt: qualifiedFinishedAt };
}

function tracksIdleDays(status: ReadingGoalStatus): boolean {
  return status === "active" || status === "expired";
}
