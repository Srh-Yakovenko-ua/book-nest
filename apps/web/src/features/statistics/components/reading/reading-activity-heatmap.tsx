"use client";

import type { Nullable, ReadingStatisticsCalendarSection, WeekStartDay } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import {
  HEATMAP_WINDOW,
  heatmapWindowRange,
  isDateInMonth,
  listHeatmapWindows,
  resolveHeatmapWindowIndex,
} from "../../model/statistics-calendar";
import { formatDayRange } from "../../model/statistics-format";
import { ReadingHeatmap } from "./reading-heatmap";

export function ReadingActivityHeatmap({
  calendar,
  month,
  onMonthChange,
  weekStartDay,
}: {
  calendar: ReadingStatisticsCalendarSection;
  month: Nullable<string>;
  onMonthChange: (month: string) => void;
  weekStartDay: WeekStartDay;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.heatmap");
  const windows = listHeatmapWindows(calendar.displayRange);
  const index = resolveHeatmapWindowIndex({ requested: month, windows });
  const visibleMonths = windows[index] ?? [];
  const visibleRange = heatmapWindowRange({ months: visibleMonths, range: calendar.displayRange });

  if (calendar.days.length <= HEATMAP_WINDOW.maxDays || visibleRange === null) {
    return <ReadingHeatmap days={calendar.days} weekStartDay={weekStartDay} />;
  }

  const visibleDays = calendar.days.filter((day) =>
    visibleMonths.some((monthKey) => isDateInMonth(day.date, monthKey)),
  );
  const previousWindowEnd = windows[index - 1]?.at(-1);
  const nextWindowEnd = windows[index + 1]?.at(-1);
  const rangeLabel = formatDayRange({ ...visibleRange, locale }) ?? visibleRange.from;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          aria-disabled={previousWindowEnd === undefined}
          aria-label={t("previousWindow")}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          onClick={() => {
            if (previousWindowEnd !== undefined) onMonthChange(previousWindowEnd);
          }}
          size="icon-lg"
          variant="ghost"
        >
          <UiIcon name="chevron-left" size={16} />
        </Button>
        <span
          aria-live="polite"
          className="min-w-0 text-center font-heading text-sm font-semibold text-ink"
        >
          {t("windowRange", { range: rangeLabel })}
        </span>
        <Button
          aria-disabled={nextWindowEnd === undefined}
          aria-label={t("nextWindow")}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          onClick={() => {
            if (nextWindowEnd !== undefined) onMonthChange(nextWindowEnd);
          }}
          size="icon-lg"
          variant="ghost"
        >
          <UiIcon name="chevron-right" size={16} />
        </Button>
      </div>

      <ReadingHeatmap days={visibleDays} weekStartDay={weekStartDay} />
    </div>
  );
}
