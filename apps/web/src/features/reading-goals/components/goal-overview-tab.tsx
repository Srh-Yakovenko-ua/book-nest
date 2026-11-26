"use client";

import type { ReadingGoalDetail } from "@app/shared";

import { GoalActivityPreview } from "./goal-activity-preview";
import { GoalCheckpointList } from "./goal-checkpoint-list";
import { GoalPaceForecastCard } from "./goal-pace-forecast-card";
import { GoalStateCard } from "./goal-state-card";

type GoalOverviewTabProps = {
  goal: ReadingGoalDetail;
  onShowActivity: () => void;
  onShowRemainingBooks: () => void;
};

export function GoalOverviewTab({
  goal,
  onShowActivity,
  onShowRemainingBooks,
}: GoalOverviewTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 md:*:only:col-span-2">
        <GoalPaceForecastCard goal={goal} />
        <GoalStateCard goal={goal} onShowRemainingBooks={onShowRemainingBooks} />
      </div>
      <GoalCheckpointList checkpoints={goal.checkpoints} />
      <GoalActivityPreview items={goal.activityPreview} onShowAll={onShowActivity} />
    </div>
  );
}
