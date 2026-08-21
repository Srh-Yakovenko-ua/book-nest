import type { Nullable, ReadingGoalPace, ReadingGoalStatus } from "@app/shared";

import { differenceInCalendarDays } from "date-fns";

import { startOfUtcDay } from "../../../core/iso-date.js";
import { resolveReadingGoalObservationEnd } from "./reading-goal-window.js";
import {
  INCLUSIVE_DAY,
  READING_GOAL_PACE,
  READING_GOAL_ROUNDING,
  roundTo,
} from "./reading-goal.constants.js";

const PERCENT_SCALE = 100;

export type ReadingGoalPaceMetrics = {
  elapsedDays: number;
  elapsedPercent: number;
  expectedCompletedCount: number;
  pace: Nullable<ReadingGoalPace>;
  paceDeltaBooks: Nullable<number>;
  paceDeltaPercent: Nullable<number>;
  progressPercent: number;
  totalDays: number;
};

type ActivePaceInput = CriticalPaceInput & { paceDeltaBooks: number };

type CriticalPaceInput = {
  daysLeft: Nullable<number>;
  elapsedPercent: number;
  progressPercent: number;
  remainingCount: number;
};

type ElapsedDaysInput = {
  goalStartDate: Date;
  observationEndsAt: Date;
  totalDays: number;
};

type PaceInput = {
  archivedAt: Nullable<Date>;
  completedAt: Nullable<Date>;
  completedCount: number;
  daysLeft: Nullable<number>;
  deadline: Date;
  goalStartDate: Date;
  now: Date;
  remainingCount: number;
  status: ReadingGoalStatus;
  targetCount: number;
};

type TotalDaysInput = {
  deadline: Date;
  goalStartDate: Date;
};

export function calculateReadingGoalPace({
  archivedAt,
  completedAt,
  completedCount,
  daysLeft,
  deadline,
  goalStartDate,
  now,
  remainingCount,
  status,
  targetCount,
}: PaceInput): ReadingGoalPaceMetrics {
  const totalDays = calculateTotalDays({ deadline, goalStartDate });
  const elapsedDays = calculateElapsedDays({
    goalStartDate,
    observationEndsAt: resolveReadingGoalObservationEnd({
      archivedAt,
      completedAt,
      deadline,
      now,
      status,
    }),
    totalDays,
  });
  const elapsedPercent = clampPercent(roundPercent((elapsedDays / totalDays) * PERCENT_SCALE));
  const exactExpectedCompletedCount = (targetCount * elapsedDays) / totalDays;
  const progressPercent = roundPercent(
    Math.min((completedCount / targetCount) * PERCENT_SCALE, PERCENT_SCALE),
  );
  const scheduleMetrics = {
    elapsedDays,
    elapsedPercent,
    expectedCompletedCount: roundBooks(exactExpectedCompletedCount),
    progressPercent,
    totalDays,
  };

  if (status !== "active") {
    return { ...scheduleMetrics, pace: null, paceDeltaBooks: null, paceDeltaPercent: null };
  }

  const paceDeltaBooks = roundBooks(completedCount - exactExpectedCompletedCount);
  return {
    ...scheduleMetrics,
    pace: resolveActivePace({
      daysLeft,
      elapsedPercent,
      paceDeltaBooks,
      progressPercent,
      remainingCount,
    }),
    paceDeltaBooks,
    paceDeltaPercent: roundPercent(progressPercent - elapsedPercent),
  };
}

function calculateElapsedDays({
  goalStartDate,
  observationEndsAt,
  totalDays,
}: ElapsedDaysInput): number {
  const elapsedDays =
    differenceInCalendarDays(observationEndsAt, startOfUtcDay(goalStartDate)) + INCLUSIVE_DAY;
  return clamp({ lowerBound: 0, upperBound: totalDays, value: elapsedDays });
}

function calculateTotalDays({ deadline, goalStartDate }: TotalDaysInput): number {
  return Math.max(
    1,
    differenceInCalendarDays(startOfUtcDay(deadline), startOfUtcDay(goalStartDate)) + INCLUSIVE_DAY,
  );
}

function clamp({
  lowerBound,
  upperBound,
  value,
}: {
  lowerBound: number;
  upperBound: number;
  value: number;
}): number {
  return Math.min(upperBound, Math.max(lowerBound, value));
}

function clampPercent(value: number): number {
  return clamp({ lowerBound: 0, upperBound: PERCENT_SCALE, value });
}

function hasCriticalPace({
  daysLeft,
  elapsedPercent,
  progressPercent,
  remainingCount,
}: CriticalPaceInput): boolean {
  const deadlinePressure =
    daysLeft !== null &&
    daysLeft <= READING_GOAL_PACE.criticalDaysLeft &&
    remainingCount >= READING_GOAL_PACE.criticalRemainingBooks;
  const progressGap =
    elapsedPercent >= READING_GOAL_PACE.criticalElapsedPercent &&
    progressPercent <= elapsedPercent - READING_GOAL_PACE.criticalProgressGapPercent;
  return deadlinePressure || progressGap;
}

function resolveActivePace({
  daysLeft,
  elapsedPercent,
  paceDeltaBooks,
  progressPercent,
  remainingCount,
}: ActivePaceInput): ReadingGoalPace {
  if (hasCriticalPace({ daysLeft, elapsedPercent, progressPercent, remainingCount })) {
    return "critical";
  }
  if (paceDeltaBooks >= READING_GOAL_PACE.aheadBooks) {
    return "ahead";
  }
  if (paceDeltaBooks <= READING_GOAL_PACE.behindBooks) {
    return "behind";
  }
  return "on_track";
}

function roundBooks(value: number): number {
  return roundTo({ decimals: READING_GOAL_ROUNDING.booksDelta, value });
}

function roundPercent(value: number): number {
  return roundTo({ decimals: READING_GOAL_ROUNDING.percent, value });
}
