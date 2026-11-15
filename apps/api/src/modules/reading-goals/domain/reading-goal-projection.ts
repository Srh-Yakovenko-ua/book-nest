import type { Nullable, ReadingGoalProjectionConfidence, ReadingGoalStatus } from "@app/shared";

import {
  addDaysToIsoDate,
  daysBetweenIsoDates,
  parseIsoDate,
  toIsoDate,
} from "../../../core/iso-date.js";
import { READING_GOAL_PROJECTION } from "./reading-goal.constants.js";

export type ReadingGoalProjection = {
  actualBooksPerDay: number;
  projectedCompletionDate: Nullable<Date>;
  projectedDaysDelta: Nullable<number>;
  projectionConfidence: ReadingGoalProjectionConfidence;
};

type ProjectionInput = {
  completedAt: Nullable<Date>;
  completedCount: number;
  deadline: Date;
  elapsedDays: number;
  remainingCount: number;
  status: ReadingGoalStatus;
  today: Date;
};

type RemainingDaysInput = {
  completedCount: number;
  observedDays: number;
  remainingCount: number;
};

export function calculateReadingGoalProjection({
  completedAt,
  completedCount,
  deadline,
  elapsedDays,
  remainingCount,
  status,
  today,
}: ProjectionInput): ReadingGoalProjection {
  const observedDays = Math.max(1, elapsedDays);
  const actualBooksPerDay = completedCount / observedDays;
  const deadlineIsoDate = toIsoDate(deadline);

  if (completedAt !== null) {
    const completionIsoDate = toIsoDate(completedAt);
    return {
      actualBooksPerDay,
      projectedCompletionDate: parseIsoDate(completionIsoDate),
      projectedDaysDelta: daysBetweenIsoDates({
        endIsoDate: deadlineIsoDate,
        startIsoDate: completionIsoDate,
      }),
      projectionConfidence: "high",
    };
  }

  if (status !== "active" || completedCount === 0) {
    return {
      actualBooksPerDay,
      projectedCompletionDate: null,
      projectedDaysDelta: null,
      projectionConfidence: "none",
    };
  }

  const projectedIsoDate = addDaysToIsoDate(
    toIsoDate(today),
    estimateRemainingDays({ completedCount, observedDays, remainingCount }),
  );
  return {
    actualBooksPerDay,
    projectedCompletionDate: parseIsoDate(projectedIsoDate),
    projectedDaysDelta: daysBetweenIsoDates({
      endIsoDate: deadlineIsoDate,
      startIsoDate: projectedIsoDate,
    }),
    projectionConfidence: resolveProjectionConfidence(completedCount),
  };
}

function estimateRemainingDays({
  completedCount,
  observedDays,
  remainingCount,
}: RemainingDaysInput): number {
  return Math.ceil((remainingCount * observedDays) / completedCount);
}

function resolveProjectionConfidence(countedCount: number): ReadingGoalProjectionConfidence {
  const { high, low, medium } = READING_GOAL_PROJECTION.confidenceMinimumCounted;
  if (countedCount >= high) {
    return "high";
  }
  if (countedCount >= medium) {
    return "medium";
  }
  if (countedCount >= low) {
    return "low";
  }
  return "none";
}
