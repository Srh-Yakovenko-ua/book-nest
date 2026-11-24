import type { ReadingGoalDetail } from "@app/shared";

import type { GoalBooksScope } from "./goal-detail-query";

export type GoalBooksScopeCounts = Record<GoalBooksScope, number>;

type GoalBooksScopeCountsInput = Pick<ReadingGoalDetail, "completedCount" | "snapshotBookCount">;

export function goalBooksScopeCounts({
  completedCount,
  snapshotBookCount,
}: GoalBooksScopeCountsInput): GoalBooksScopeCounts {
  return {
    all: snapshotBookCount,
    counted: completedCount,
    remaining: Math.max(snapshotBookCount - completedCount, 0),
  };
}
