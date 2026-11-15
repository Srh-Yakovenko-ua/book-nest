import type { ReadingGoalMetrics } from "@app/shared";

type GoalPercentInput = Pick<ReadingGoalMetrics, "progressPercent" | "remainingCount">;

const GOAL_PERCENT_BOUNDS = {
  max: 100,
  maxWhileRemaining: 99,
  min: 0,
} as const satisfies Record<string, number>;

export function goalDisplayPercent({ progressPercent, remainingCount }: GoalPercentInput): number {
  const ceiling =
    remainingCount > 0 ? GOAL_PERCENT_BOUNDS.maxWhileRemaining : GOAL_PERCENT_BOUNDS.max;
  return Math.min(Math.max(Math.round(progressPercent), GOAL_PERCENT_BOUNDS.min), ceiling);
}
