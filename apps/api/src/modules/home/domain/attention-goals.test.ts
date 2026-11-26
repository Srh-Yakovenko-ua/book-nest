import type { ReadingGoalMetrics, ReadingGoalRiskLevel } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { HomeActiveGoal } from "./home-goal-section.js";

import { buildGoalAttention } from "./attention-goals.js";

const GOAL_IDS = {
  other: "7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e42",
  primary: "7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e41",
  third: "7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e43",
} as const;

function goalAt({
  goalId,
  riskLevel,
}: {
  goalId: string;
  riskLevel: ReadingGoalRiskLevel;
}): HomeActiveGoal {
  return {
    deadline: new Date("2026-12-14T00:00:00.000Z"),
    goalId,
    listName: null,
    metrics: metricsAt(riskLevel),
    name: "Ten before New Year",
    status: "active",
    targetCount: 10,
  };
}

function metricsAt(riskLevel: ReadingGoalRiskLevel): ReadingGoalMetrics {
  return {
    actualBooksPerDay: null,
    averageDaysPerBook: null,
    completedCount: 2,
    daysLeft: 20,
    daysSinceLastCounted: 14,
    elapsedDays: 40,
    elapsedPercent: 67,
    expectedCompletedCount: 6.7,
    lastCountedAt: null,
    pace: null,
    paceDeltaBooks: null,
    paceDeltaPercent: null,
    progressPercent: 20,
    projectedCompletionDate: null,
    projectedDaysDelta: null,
    projectionConfidence: "low",
    remainingCount: 8,
    requiredBooksPerDay: null,
    requiredDaysPerBook: null,
    riskLevel,
    riskReasons: ["behind_schedule"],
    totalDays: 60,
  };
}

const CALM_PRIMARY = goalAt({ goalId: GOAL_IDS.primary, riskLevel: "none" });

describe("buildGoalAttention", () => {
  it("raises a critical goal as a high goal group", () => {
    const groups = buildGoalAttention([
      CALM_PRIMARY,
      goalAt({ goalId: GOAL_IDS.other, riskLevel: "critical" }),
    ]);

    expect(groups).toEqual([
      expect.objectContaining({
        count: 1,
        goalId: GOAL_IDS.other,
        isPrimary: false,
        reason: "goal_at_risk",
        severity: "high",
        unit: "goals",
      }),
    ]);
  });

  it("raises a high-risk goal as a medium goal group", () => {
    const groups = buildGoalAttention([
      CALM_PRIMARY,
      goalAt({ goalId: GOAL_IDS.other, riskLevel: "high" }),
    ]);

    expect(groups).toEqual([
      expect.objectContaining({ goalId: GOAL_IDS.other, severity: "medium" }),
    ]);
  });

  it.each<ReadingGoalRiskLevel>(["medium", "low", "none"])(
    "raises nothing for a goal at %s risk",
    (riskLevel) => {
      expect(
        buildGoalAttention([CALM_PRIMARY, goalAt({ goalId: GOAL_IDS.other, riskLevel })]),
      ).toEqual([]);
    },
  );

  it("raises the primary goal when it is critical and marks it primary", () => {
    const groups = buildGoalAttention([
      goalAt({ goalId: GOAL_IDS.primary, riskLevel: "critical" }),
    ]);

    expect(groups).toEqual([
      expect.objectContaining({ goalId: GOAL_IDS.primary, isPrimary: true, severity: "high" }),
    ]);
  });

  it("leaves a high-risk primary goal to the goal card", () => {
    expect(buildGoalAttention([goalAt({ goalId: GOAL_IDS.primary, riskLevel: "high" })])).toEqual(
      [],
    );
  });

  it("raises one group per goal at risk", () => {
    const groups = buildGoalAttention([
      CALM_PRIMARY,
      goalAt({ goalId: GOAL_IDS.other, riskLevel: "critical" }),
      goalAt({ goalId: GOAL_IDS.third, riskLevel: "high" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ goalId: GOAL_IDS.other }),
        expect.objectContaining({ goalId: GOAL_IDS.third }),
      ]),
    );
    expect(new Set(groups.map((group) => group.id)).size).toBe(2);
  });
});
