"use client";

import type { ReadingStatisticsDateRange, StatisticsCalendarDay, WeekStartDay } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import {
  listCalendarQuarters,
  listQuarterMonths,
  quarterOfMonth,
  resolveCalendarQuarter,
} from "../../model/reading-calendar-quarter";
import { formatQuarterKey } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { ReadingHeatmap } from "./reading-heatmap";

const QUARTER_STEP_CLASS = "size-10 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export function ReadingQuarterActivityCard({
  days,
  displayRange,
  month,
  onShowInBooksCalendar,
  today,
  weekStartDay,
}: {
  days: readonly StatisticsCalendarDay[];
  displayRange: ReadingStatisticsDateRange;
  month: string;
  onShowInBooksCalendar: (date: string) => void;
  today: string;
  weekStartDay: WeekStartDay;
}) {
  const locale = useLocale();
  const t = useTranslations("readingCalendar.activity");
  const monthQuarter = quarterOfMonth(month);
  const [picked, setPicked] = useState({ month, quarter: monthQuarter });

  if (picked.month !== month) {
    setPicked({ month, quarter: monthQuarter });
  }

  const quarters = listCalendarQuarters(displayRange);
  const quarter = resolveCalendarQuarter({
    quarters,
    requested: picked.month === month ? picked.quarter : monthQuarter,
  });
  const index = quarters.indexOf(quarter);
  const previous = index > 0 ? quarters[index - 1] : undefined;
  const next = index >= 0 ? quarters[index + 1] : undefined;

  return (
    <StatisticsSection className="gap-2 py-3" contentClassName="gap-2" title={t("title")}>
      <div className="flex items-center justify-between gap-1">
        <Button
          aria-disabled={previous === undefined}
          aria-label={t("previousQuarter")}
          className={QUARTER_STEP_CLASS}
          onClick={() => {
            if (previous !== undefined) setPicked({ month, quarter: previous });
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
          {t("quarterLabel", formatQuarterKey(quarter, locale))}
        </span>
        <Button
          aria-disabled={next === undefined}
          aria-label={t("nextQuarter")}
          className={QUARTER_STEP_CLASS}
          onClick={() => {
            if (next !== undefined) setPicked({ month, quarter: next });
          }}
          size="icon-lg"
          variant="ghost"
        >
          <UiIcon name="chevron-right" size={16} />
        </Button>
      </div>
      <ReadingHeatmap
        days={days}
        months={listQuarterMonths(quarter)}
        onShowInBooksCalendar={onShowInBooksCalendar}
        selectedMonth={month}
        today={today}
        weekStartDay={weekStartDay}
      />
    </StatisticsSection>
  );
}
