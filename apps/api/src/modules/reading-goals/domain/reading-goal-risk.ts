import type {
  Nullable,
  ReadingGoalPace,
  ReadingGoalRiskLevel,
  ReadingGoalRiskReason,
  ReadingGoalStatus,
} from "@app/shared";

import { ReadingGoalRiskReasonSchema } from "@app/shared";

import { READING_GOAL_RISK } from "./reading-goal.constants.js";

export type ReadingGoalRiskAssessment = {
  riskLevel: ReadingGoalRiskLevel;
  riskReasons: ReadingGoalRiskReason[];
};

type RequiredPaceInput = {
  actualBooksPerDay: number;
  elapsedPercent: number;
  remainingCount: number;
  requiredBooksPerDay: Nullable<number>;
};

type RiskInput = RequiredPaceInput & {
  daysLeft: Nullable<number>;
  daysSinceLastCounted: Nullable<number>;
  elapsedDays: number;
  pace: Nullable<ReadingGoalPace>;
  projectedDaysDelta: Nullable<number>;
  status: ReadingGoalStatus;
};

type RiskLevelInput = {
  pace: Nullable<ReadingGoalPace>;
  projectedDaysDelta: Nullable<number>;
  riskReasons: ReadingGoalRiskReason[];
  status: ReadingGoalStatus;
};

export function calculateReadingGoalRisk(input: RiskInput): ReadingGoalRiskAssessment {
  const { pace, projectedDaysDelta, status } = input;
  const riskReasons = collectRiskReasons(input);
  return {
    riskLevel: resolveRiskLevel({ pace, projectedDaysDelta, riskReasons, status }),
    riskReasons,
  };
}

function collectRiskReasons({
  actualBooksPerDay,
  daysLeft,
  daysSinceLastCounted,
  elapsedDays,
  elapsedPercent,
  pace,
  remainingCount,
  requiredBooksPerDay,
  status,
}: RiskInput): ReadingGoalRiskReason[] {
  const isActive = status === "active";
  const hasRemainingBooks = remainingCount > 0;
  const isPresent: Record<ReadingGoalRiskReason, boolean> = {
    behind_schedule: pace === "behind",
    deadline_soon:
      isActive &&
      hasRemainingBooks &&
      daysLeft !== null &&
      daysLeft <= READING_GOAL_RISK.deadlineSoonDays,
    no_recent_progress:
      isActive &&
      hasRemainingBooks &&
      elapsedDays >= READING_GOAL_RISK.noRecentProgressElapsedDays &&
      daysSinceLastCounted !== null &&
      daysSinceLastCounted >= READING_GOAL_RISK.noRecentProgressDays,
    required_pace_high:
      isActive &&
      hasHighRequiredPace({
        actualBooksPerDay,
        elapsedPercent,
        remainingCount,
        requiredBooksPerDay,
      }),
  };
  return ReadingGoalRiskReasonSchema.options.filter((reason) => isPresent[reason]);
}

function hasHighRequiredPace({
  actualBooksPerDay,
  elapsedPercent,
  remainingCount,
  requiredBooksPerDay,
}: RequiredPaceInput): boolean {
  if (actualBooksPerDay > 0) {
    return (
      requiredBooksPerDay !== null &&
      requiredBooksPerDay >= actualBooksPerDay * READING_GOAL_RISK.requiredPaceMultiplier
    );
  }
  return elapsedPercent >= READING_GOAL_RISK.requiredPaceZeroElapsedPercent && remainingCount > 0;
}

function hasLowRisk({
  pace,
  projectedDaysDelta,
  status,
}: Omit<RiskLevelInput, "riskReasons">): boolean {
  return (
    status === "active" &&
    pace === "on_track" &&
    projectedDaysDelta !== null &&
    projectedDaysDelta >= 0 &&
    projectedDaysDelta <= READING_GOAL_RISK.lowRiskProjectedDeltaMax
  );
}

function resolveRiskLevel({
  pace,
  projectedDaysDelta,
  riskReasons,
  status,
}: RiskLevelInput): ReadingGoalRiskLevel {
  const hasCriticalCombination =
    riskReasons.includes("behind_schedule") && riskReasons.includes("deadline_soon");
  if (pace === "critical" || hasCriticalCombination) {
    return "critical";
  }
  if (riskReasons.length >= READING_GOAL_RISK.levelMinimumReasons.high) {
    return "high";
  }
  if (riskReasons.length >= READING_GOAL_RISK.levelMinimumReasons.medium) {
    return "medium";
  }
  if (hasLowRisk({ pace, projectedDaysDelta, status })) {
    return "low";
  }
  return "none";
}
