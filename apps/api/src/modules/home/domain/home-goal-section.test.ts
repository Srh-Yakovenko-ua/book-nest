import type { ReadingGoalMetrics } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { HomeActiveGoal, HomeCompletedGoal } from "./home-goal-section.js";

import { buildHomeGoalSection, findRecentCompletion } from "./home-goal-section.js";

const TODAY = "2026-11-24";

const GOAL_IDS = {
  first: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c51",
  fourth: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c54",
  second: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c52",
  third: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c53",
} as const;

const METRICS: ReadingGoalMetrics = {
  actualBooksPerDay: null,
  averageDaysPerBook: null,
  completedCount: 3,
  daysLeft: 37,
  daysSinceLastCounted: null,
  elapsedDays: 20,
  elapsedPercent: 35,
  expectedCompletedCount: 3.5,
  lastCountedAt: null,
  pace: null,
  paceDeltaBooks: null,
  paceDeltaPercent: null,
  progressPercent: 30,
  projectedCompletionDate: null,
  projectedDaysDelta: null,
  projectionConfidence: "none",
  remainingCount: 7,
  requiredBooksPerDay: null,
  requiredDaysPerBook: null,
  riskLevel: "none",
  riskReasons: [],
  totalDays: 57,
};

function activeGoal({ deadline, goalId }: { deadline: string; goalId: string }): HomeActiveGoal {
  return {
    deadline: new Date(`${deadline}T00:00:00.000Z`),
    goalId,
    listName: null,
    metrics: METRICS,
    name: "Winter shelf",
    status: "active",
    targetCount: 10,
  };
}

function completedGoal({
  completedOn,
  goalId,
}: {
  completedOn: string;
  goalId: string;
}): HomeCompletedGoal {
  return {
    completedAt: new Date(`${completedOn}T12:00:00.000Z`),
    goalId,
    listName: "Classics",
    name: "Autumn classics",
    targetCount: 5,
  };
}

describe("buildHomeGoalSection", () => {
  it("makes the first active goal primary with an open-goal action", () => {
    const section = buildHomeGoalSection({
      plans: {
        active: [
          activeGoal({ deadline: "2026-12-31", goalId: GOAL_IDS.first }),
          activeGoal({ deadline: "2027-03-31", goalId: GOAL_IDS.second }),
        ],
        completed: [],
      },
      today: TODAY,
    });

    expect(section.primaryGoal).toMatchObject({
      contextActions: [{ goalId: GOAL_IDS.first, kind: "open_goal" }],
      deadline: "2026-12-31",
      goalId: GOAL_IDS.first,
    });
  });

  it("counts every active goal", () => {
    const section = buildHomeGoalSection({
      plans: {
        active: [
          activeGoal({ deadline: "2026-12-31", goalId: GOAL_IDS.first }),
          activeGoal({ deadline: "2027-03-31", goalId: GOAL_IDS.second }),
        ],
        completed: [],
      },
      today: TODAY,
    });

    expect(section.activeGoalsCount).toBe(2);
  });

  it("has no primary goal when no goal is active", () => {
    const section = buildHomeGoalSection({ plans: { active: [], completed: [] }, today: TODAY });

    expect(section).toMatchObject({ activeGoalsCount: 0, primaryGoal: null });
  });

  it("carries the recent completion next to the active goals", () => {
    const section = buildHomeGoalSection({
      plans: {
        active: [],
        completed: [completedGoal({ completedOn: "2026-11-22", goalId: GOAL_IDS.third })],
      },
      today: TODAY,
    });

    expect(section.recentCompletion).toMatchObject({ goalId: GOAL_IDS.third });
  });
});

describe("findRecentCompletion", () => {
  it("includes a goal completed today", () => {
    expect(
      findRecentCompletion({
        completed: [completedGoal({ completedOn: "2026-11-24", goalId: GOAL_IDS.first })],
        today: TODAY,
      }),
    ).toEqual({
      completedAt: "2026-11-24",
      goalId: GOAL_IDS.first,
      listName: "Classics",
      name: "Autumn classics",
      targetCount: 5,
    });
  });

  it("includes a goal completed six days ago", () => {
    expect(
      findRecentCompletion({
        completed: [completedGoal({ completedOn: "2026-11-18", goalId: GOAL_IDS.first })],
        today: TODAY,
      }),
    ).toMatchObject({ completedAt: "2026-11-18", goalId: GOAL_IDS.first });
  });

  it("excludes a goal completed seven days ago", () => {
    expect(
      findRecentCompletion({
        completed: [completedGoal({ completedOn: "2026-11-17", goalId: GOAL_IDS.first })],
        today: TODAY,
      }),
    ).toBeNull();
  });

  it("excludes a completion dated after today", () => {
    expect(
      findRecentCompletion({
        completed: [completedGoal({ completedOn: "2026-11-25", goalId: GOAL_IDS.first })],
        today: TODAY,
      }),
    ).toBeNull();
  });

  it("picks the most recent completion inside the window", () => {
    expect(
      findRecentCompletion({
        completed: [
          completedGoal({ completedOn: "2026-11-19", goalId: GOAL_IDS.first }),
          completedGoal({ completedOn: "2026-11-23", goalId: GOAL_IDS.second }),
          completedGoal({ completedOn: "2026-11-20", goalId: GOAL_IDS.third }),
          completedGoal({ completedOn: "2026-11-25", goalId: GOAL_IDS.fourth }),
        ],
        today: TODAY,
      }),
    ).toMatchObject({ completedAt: "2026-11-23", goalId: GOAL_IDS.second });
  });
});
