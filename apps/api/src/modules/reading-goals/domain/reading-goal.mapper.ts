import type { ReadingGoalListItem, ReadingGoalView } from "@app/shared";

import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";
import type { ReadingGoalCalculation } from "./reading-goal-metrics.js";
import type { ReadingGoalProgress } from "./reading-goal-progress.js";

import { toIsoDate, toNullableIsoDate, toNullableIsoDateTime } from "../../../core/iso-date.js";

export function toReadingGoalListItem({
  calculation,
  goal,
}: {
  calculation: ReadingGoalCalculation;
  goal: ReadingGoalWithList;
}): ReadingGoalListItem {
  return {
    ...toReadingGoalView({ goal, progress: calculation.progress }),
    ...calculation.metrics,
  };
}

export function toReadingGoalView({
  goal,
  progress,
}: {
  goal: ReadingGoalWithList;
  progress: ReadingGoalProgress;
}): ReadingGoalView {
  return {
    archivedAt: toNullableIsoDateTime(goal.archivedAt),
    completedAt: toNullableIsoDate(progress.completedAt),
    completedCount: progress.completedCount,
    createdAt: goal.createdAt.toISOString(),
    daysLeft: progress.daysLeft,
    deadline: toIsoDate(goal.deadline),
    id: goal.id,
    list: goal.list === null ? null : { id: goal.list.id, name: goal.list.name },
    name: goal.name,
    remainingCount: progress.remainingCount,
    result: progress.result,
    status: progress.status,
    targetCount: goal.targetCount,
  };
}
