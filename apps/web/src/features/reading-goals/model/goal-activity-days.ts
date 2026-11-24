import type { ReadingGoalActivityView } from "@app/shared";

import { instantToIsoDay } from "@/lib/iso-day";

export type GoalActivityDay = {
  day: string;
  items: ReadingGoalActivityView[];
};

type GroupGoalActivityByDayInput = {
  items: readonly ReadingGoalActivityView[];
  timeZone: string;
};

export function groupGoalActivityByDay({
  items,
  timeZone,
}: GroupGoalActivityByDayInput): GoalActivityDay[] {
  const days = new Map<string, ReadingGoalActivityView[]>();
  for (const item of items) {
    const day = instantToIsoDay({ instant: item.createdAt, timeZone });
    const dayItems = days.get(day);
    if (dayItems === undefined) {
      days.set(day, [item]);
      continue;
    }
    dayItems.push(item);
  }
  return Array.from(days, ([day, dayItems]) => ({ day, items: dayItems }));
}
