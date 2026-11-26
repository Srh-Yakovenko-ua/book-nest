import type {
  HomeGoalRecentCompletion,
  HomeGoalSection,
  Nullable,
  ReadingGoalMetrics,
  ReadingGoalStatus,
} from "@app/shared";

import { HOME_DASHBOARD_RULES } from "@app/shared";

import { addDaysToIsoDate, toIsoDate } from "../../../core/iso-date.js";

export type HomeActiveGoal = {
  deadline: Date;
  goalId: string;
  listName: Nullable<string>;
  metrics: ReadingGoalMetrics;
  name: Nullable<string>;
  status: ReadingGoalStatus;
  targetCount: number;
};

export type HomeCompletedGoal = {
  completedAt: Date;
  goalId: string;
  listName: Nullable<string>;
  name: Nullable<string>;
  targetCount: number;
};

export type HomeGoalPlans = {
  active: HomeActiveGoal[];
  completed: HomeCompletedGoal[];
};

const COMPLETION_WINDOW_START_OFFSET = -(HOME_DASHBOARD_RULES.recent.goalCompletionWindowDays - 1);

export function buildHomeGoalSection({
  plans,
  today,
}: {
  plans: HomeGoalPlans;
  today: string;
}): HomeGoalSection {
  const [primary] = plans.active;

  return {
    activeGoalsCount: plans.active.length,
    primaryGoal:
      primary === undefined
        ? null
        : {
            contextActions: [{ goalId: primary.goalId, kind: "open_goal" }],
            deadline: toIsoDate(primary.deadline),
            goalId: primary.goalId,
            listName: primary.listName,
            metrics: primary.metrics,
            name: primary.name,
            status: primary.status,
            targetCount: primary.targetCount,
          },
    recentCompletion: findRecentCompletion({ completed: plans.completed, today }),
  };
}

export function findRecentCompletion({
  completed,
  today,
}: {
  completed: HomeCompletedGoal[];
  today: string;
}): Nullable<HomeGoalRecentCompletion> {
  const windowStart = addDaysToIsoDate(today, COMPLETION_WINDOW_START_OFFSET);
  const [latest] = completed
    .map((goal) => ({ completedDay: toIsoDate(goal.completedAt), goal }))
    .filter(({ completedDay }) => completedDay >= windowStart && completedDay <= today)
    .sort(compareRecentFirst);

  if (latest === undefined) {
    return null;
  }
  return {
    completedAt: latest.completedDay,
    goalId: latest.goal.goalId,
    listName: latest.goal.listName,
    name: latest.goal.name,
    targetCount: latest.goal.targetCount,
  };
}

function compareRecentFirst(
  left: { completedDay: string; goal: HomeCompletedGoal },
  right: { completedDay: string; goal: HomeCompletedGoal },
): number {
  if (left.completedDay !== right.completedDay) {
    return left.completedDay > right.completedDay ? -1 : 1;
  }
  return left.goal.goalId < right.goal.goalId ? -1 : 1;
}
