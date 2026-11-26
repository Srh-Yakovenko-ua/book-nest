"use client";

import type { ReadingGoalActivityView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileTimeZone } from "@/features/settings";
import { formatDateLong, formatTimeInZone } from "@/lib/format";

import type { GoalActivityDay } from "../model/goal-activity-days";

import { groupGoalActivityByDay } from "../model/goal-activity-days";
import { GoalActivityIcon, GoalActivitySummary } from "./goal-activity-row";

const GOAL_ACTIVITY_TIMELINE = {
  dayHeading:
    "inline-flex w-fit items-center gap-2 rounded-full bg-accent px-3 py-1 font-heading text-sm font-semibold text-ink",
  line: "relative flex flex-col gap-2 before:absolute before:inset-y-0 before:left-4 before:w-px before:-translate-x-1/2 before:bg-border",
  skeletonCount: 6,
} as const;

type GoalActivityDayGroupProps = GoalActivityDay & {
  timeZone: string;
};

type GoalActivityTimelineItemProps = {
  item: ReadingGoalActivityView;
  timeZone: string;
};

type GoalActivityTimelineProps = {
  items: ReadingGoalActivityView[];
};

export function GoalActivityTimeline({ items }: GoalActivityTimelineProps) {
  const timeZone = useProfileTimeZone();

  return (
    <div className="flex flex-col gap-5">
      {groupGoalActivityByDay({ items, timeZone }).map((group) => (
        <GoalActivityDayGroup
          day={group.day}
          items={group.items}
          key={group.day}
          timeZone={timeZone}
        />
      ))}
    </div>
  );
}

export function GoalActivityTimelineSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <Skeleton className="h-7 w-44 rounded-full" />
      <ul className={GOAL_ACTIVITY_TIMELINE.line}>
        {Array.from({ length: GOAL_ACTIVITY_TIMELINE.skeletonCount }, (_, index) => (
          <li className="relative flex items-start gap-3" key={index}>
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
              <Skeleton className="h-4 w-1/3 rounded-md" />
              <Skeleton className="h-3 w-2/3 rounded-md" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GoalActivityDayGroup({ day, items, timeZone }: GoalActivityDayGroupProps) {
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-3">
      <h2 className={GOAL_ACTIVITY_TIMELINE.dayHeading}>
        <UiIcon aria-hidden className="text-icon" name="calendar" size={14} />
        <time dateTime={day}>{formatDateLong(day, locale)}</time>
      </h2>
      <ol className={GOAL_ACTIVITY_TIMELINE.line}>
        {items.map((item) => (
          <GoalActivityTimelineItem item={item} key={item.id} timeZone={timeZone} />
        ))}
      </ol>
    </div>
  );
}

function GoalActivityTimelineItem({ item, timeZone }: GoalActivityTimelineItemProps) {
  const t = useTranslations("goals.detail.activity");
  const locale = useLocale();
  const time = formatTimeInZone({ instant: item.createdAt, locale, timeZone });

  return (
    <li className="relative flex items-start gap-3">
      <GoalActivityIcon className="relative" type={item.type} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <GoalActivitySummary item={item} />
        <time
          className="shrink-0 text-xs text-muted-foreground tabular-nums"
          dateTime={item.createdAt}
        >
          <span aria-hidden>{time}</span>
          <span className="sr-only">{t("recordedAt", { time })}</span>
        </time>
      </div>
    </li>
  );
}
