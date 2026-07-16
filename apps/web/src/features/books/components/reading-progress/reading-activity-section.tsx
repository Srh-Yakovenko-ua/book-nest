"use client";

import type { ReadingActivityRange, ReadingActivityView } from "@app/shared";

import { useTranslations } from "next-intl";

import { ReadingActivityChart } from "../reading/reading-activity-chart";
import { ReadingActivityRangeControl } from "../reading/reading-activity-range-control";

type ReadingActivitySectionProps = {
  activity: ReadingActivityView;
  chartClassName?: string;
  isRefetching?: boolean;
  onRangeChange: (value: ReadingActivityRange) => void;
  range: ReadingActivityRange;
};

export function ReadingActivitySection({
  activity,
  chartClassName = "h-40",
  isRefetching = false,
  onRangeChange,
  range,
}: ReadingActivitySectionProps) {
  const t = useTranslations("books.details.reading");
  const hasActivity = activity.summary.activeDaysCount > 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("activityTitle")}</h3>
        <ReadingActivityRangeControl onValueChange={onRangeChange} value={range} />
      </div>
      {hasActivity ? (
        <ReadingActivityChart
          activity={activity}
          className={chartClassName}
          isRefetching={isRefetching}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {range === "all" ? t("noActivityAll") : t("noActivityInRange")}
        </p>
      )}
    </section>
  );
}
