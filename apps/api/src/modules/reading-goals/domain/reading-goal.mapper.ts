import type { ReadingGoalView } from "@app/shared";

import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";
import type { ReadingGoalProgress } from "./reading-goal-progress.js";

import { toIsoDate, toNullableIsoDate } from "../../../core/iso-date.js";

export function toReadingGoalView({
  goal,
  progress,
}: {
  goal: ReadingGoalWithList;
  progress: ReadingGoalProgress;
}): ReadingGoalView {
  return {
    completedAt: toNullableIsoDate(progress.completedAt),
    completedCount: progress.completedCount,
    createdAt: goal.createdAt.toISOString(),
    daysLeft: progress.daysLeft,
    deadline: toIsoDate(goal.deadline),
    id: goal.id,
    list: goal.list === null ? null : { id: goal.list.id, name: goal.list.name },
    name: goal.name,
    remainingCount: progress.remainingCount,
    status: progress.status,
    targetCount: goal.targetCount,
  };
}
