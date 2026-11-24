import type {
  Nullable,
  ReadingGoalPace,
  ReadingGoalProjectionConfidence,
  ReadingGoalRiskLevel,
  ReadingGoalRiskReason,
  ReadingGoalStatus,
} from "@app/shared";

import { ReadingGoalRiskLevelSchema, ReadingGoalRiskReasonSchema } from "@app/shared";

import { READING_GOAL_RISK } from "./reading-goal.constants.js";

export type ReadingGoalRiskAssessment = {
  riskLevel: ReadingGoalRiskLevel;
  riskReasons: ReadingGoalRiskReason[];
};

type ProjectedLatenessInput = {
  projectedDaysDelta: Nullable<number>;
  projectionConfidence: ReadingGoalProjectionConfidence;
  status: ReadingGoalStatus;
};

type ProjectedLatenessRiskLevel = Exclude<ReadingGoalRiskLevel, "critical">;

type RequiredPaceInput = {
  actualBooksPerDay: number;
  elapsedPercent: number;
  remainingCount: number;
  requiredBooksPerDay: Nullable<number>;
};

type RiskInput = ProjectedLatenessInput &
  RequiredPaceInput & {
    daysLeft: Nullable<number>;
    daysSinceLastCounted: Nullable<number>;
    elapsedDays: number;
    pace: Nullable<ReadingGoalPace>;
  };

type RiskLevelInput = {
  pace: Nullable<ReadingGoalPace>;
  projectedDaysDelta: Nullable<number>;
  riskReasons: ReadingGoalRiskReason[];
  status: ReadingGoalStatus;
};

const PROJECTED_LATE_REASON = ReadingGoalRiskReasonSchema.enum.projected_late;

export function calculateReadingGoalRisk(input: RiskInput): ReadingGoalRiskAssessment {
  const { pace, projectedDaysDelta, status } = input;
  const projectedLatenessLevel = resolveProjectedLatenessRiskLevel(input);
  const riskReasons = collectRiskReasons({ ...input, projectedLatenessLevel });
  const reasonsRiskLevel = resolveReasonsRiskLevel({
    pace,
    projectedDaysDelta,
    riskReasons: riskReasons.filter((reason) => reason !== PROJECTED_LATE_REASON),
    status,
  });
  return {
    riskLevel: strongerRiskLevel({ left: reasonsRiskLevel, right: projectedLatenessLevel }),
    riskReasons,
  };
}

export function resolveProjectedLateDays({
  projectedDaysDelta,
  projectionConfidence,
  status,
}: ProjectedLatenessInput): Nullable<number> {
  if (
    status !== "active" ||
    !READING_GOAL_RISK.projectedLateTrustedConfidence[projectionConfidence] ||
    projectedDaysDelta === null ||
    projectedDaysDelta >= 0
  ) {
    return null;
  }
  return Math.abs(projectedDaysDelta);
}

export function resolveProjectedLatenessRiskLevel(
  input: ProjectedLatenessInput,
): ProjectedLatenessRiskLevel {
  const lateDays = resolveProjectedLateDays(input);
  const { high, low, medium } = READING_GOAL_RISK.projectedLateMinimumDays;
  if (lateDays === null || lateDays < low) {
    return "none";
  }
  if (lateDays >= high) {
    return "high";
  }
  return lateDays >= medium ? "medium" : "low";
}

function collectRiskReasons({
  actualBooksPerDay,
  daysLeft,
  daysSinceLastCounted,
  elapsedDays,
  elapsedPercent,
  pace,
  projectedLatenessLevel,
  remainingCount,
  requiredBooksPerDay,
  status,
}: RiskInput & {
  projectedLatenessLevel: ProjectedLatenessRiskLevel;
}): ReadingGoalRiskReason[] {
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
    projected_late: projectedLatenessLevel !== "none",
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

function resolveReasonsRiskLevel({
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

function strongerRiskLevel({
  left,
  right,
}: {
  left: ReadingGoalRiskLevel;
  right: ReadingGoalRiskLevel;
}): ReadingGoalRiskLevel {
  const severity = ReadingGoalRiskLevelSchema.options;
  return severity.indexOf(right) > severity.indexOf(left) ? right : left;
}
