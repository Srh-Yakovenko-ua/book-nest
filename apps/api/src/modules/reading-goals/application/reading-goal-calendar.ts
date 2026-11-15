import type { Nullable } from "@app/shared";

import type { ReadingGoalCalculationGoal } from "../domain/reading-goal-metrics.js";

import { toZonedCalendarDay } from "../../../core/iso-date.js";

type ReadingGoalInstants = {
  archivedAt: Nullable<Date>;
  createdAt: Date;
  deadline: Date;
  targetCount: number;
};

export function toReadingGoalCalculationGoal({
  goal,
  timeZone,
}: {
  goal: ReadingGoalInstants;
  timeZone: string;
}): ReadingGoalCalculationGoal {
  return {
    archivedDay:
      goal.archivedAt === null ? null : toZonedCalendarDay({ instant: goal.archivedAt, timeZone }),
    createdDay: toZonedCalendarDay({ instant: goal.createdAt, timeZone }),
    deadline: goal.deadline,
    targetCount: goal.targetCount,
  };
}
