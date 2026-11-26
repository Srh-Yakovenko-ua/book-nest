import type {
  HomeAttentionGroup,
  HomeAttentionSeverity,
  Nullable,
  ReadingGoalRiskLevel,
} from "@app/shared";

import type { HomeActiveGoal } from "./home-goal-section.js";

import { toIsoDate } from "../../../core/iso-date.js";

const GOAL_RISK_SEVERITY: Record<ReadingGoalRiskLevel, Nullable<HomeAttentionSeverity>> = {
  critical: "high",
  high: "medium",
  low: null,
  medium: null,
  none: null,
};

const DEFAULT_RISK_REASON = "behind_schedule";

const SINGLE_GOAL = 1;

export function buildGoalAttention(goals: readonly HomeActiveGoal[]): HomeAttentionGroup[] {
  const [primary] = goals;

  return goals.flatMap((goal): HomeAttentionGroup[] => {
    const severity = GOAL_RISK_SEVERITY[goal.metrics.riskLevel];
    const isPrimary = goal.goalId === primary?.goalId;
    if (severity === null || (isPrimary && goal.metrics.riskLevel !== "critical")) {
      return [];
    }
    return [
      {
        count: SINGLE_GOAL,
        dueDate: toIsoDate(goal.deadline),
        goalId: goal.goalId,
        goalName: goal.name,
        id: `goal_at_risk:${goal.goalId}`,
        isPrimary,
        listName: goal.listName,
        reason: "goal_at_risk",
        riskReason: goal.metrics.riskReasons[0] ?? DEFAULT_RISK_REASON,
        severity,
        unit: "goals",
      },
    ];
  });
}
