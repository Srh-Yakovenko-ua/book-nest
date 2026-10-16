"use client";

import type { ReadingStatisticsCalendarSection, WeekStartDay } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatNumber } from "@/lib/format";

import {
  isDateInMonth,
  listCalendarMonths,
  summarizeCalendarMonth,
} from "../../model/statistics-calendar";
import { formatMonthKey } from "../../model/statistics-format";
import { StatisticsStat } from "../statistics-stat";
import { StatisticsSectionState } from "../statistics-states";
import { ReadingBooksDiary } from "./reading-books-diary";
import { ReadingBooksMonthGrid } from "./reading-books-month-grid";

export function ReadingBooksCalendar({
  calendar,
  weekStartDay,
}: {
  calendar: ReadingStatisticsCalendarSection;
  weekStartDay: WeekStartDay;
}) {
  const isMobile = useIsMobile();
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");
  const months = listCalendarMonths(calendar.displayRange);
  const [requestedMonth, setRequestedMonth] = useState<null | string>(null);

  const monthKey = resolveMonth({ months, requested: requestedMonth });
  if (monthKey === null) {
    return <StatisticsSectionState kind="empty" title={t("empty")} />;
  }

  const index = months.indexOf(monthKey);
  const monthDays = calendar.days.filter((day) => isDateInMonth(day.date, monthKey));
  const summary = summarizeCalendarMonth(monthDays);
  const lowerBound = (isLowerBound: boolean, value: number) =>
    isLowerBound
      ? t("atLeast", { value: formatNumber(value, locale) })
      : formatNumber(value, locale);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          aria-disabled={index <= 0}
          aria-label={t("previousMonth")}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          onClick={() => {
            if (index > 0) setRequestedMonth(months[index - 1] ?? monthKey);
          }}
          size="icon-lg"
          variant="ghost"
        >
          <UiIcon name="chevron-left" size={16} />
        </Button>
        <span aria-live="polite" className="font-heading text-sm font-semibold text-ink">
          {formatMonthKey(monthKey, locale)}
        </span>
        <Button
          aria-disabled={index >= months.length - 1}
          aria-label={t("nextMonth")}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          onClick={() => {
            if (index < months.length - 1) setRequestedMonth(months[index + 1] ?? monthKey);
          }}
          size="icon-lg"
          variant="ghost"
        >
          <UiIcon name="chevron-right" size={16} />
        </Button>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        <StatisticsStat
          label={t("monthActiveDays")}
          value={lowerBound(summary.hasUnknownDays, summary.activeDays)}
        />
        <StatisticsStat
          label={t("monthBooks")}
          value={lowerBound(
            summary.hasUnknownDays || summary.books.isLowerBound,
            summary.books.count,
          )}
        />
        <StatisticsStat
          label={t("monthPages")}
          value={lowerBound(summary.hasUnknownDays, summary.pagesRead)}
        />
      </dl>

      {isMobile ? (
        <ReadingBooksDiary days={monthDays} />
      ) : (
        <ReadingBooksMonthGrid days={monthDays} monthKey={monthKey} weekStartDay={weekStartDay} />
      )}

      {summary.hasUnknownDays ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-dashed border-muted-foreground/40 text-[0.625rem] font-medium"
          >
            ?
          </span>
          {t("unknownLegend")}
        </p>
      ) : null}
    </div>
  );
}

function resolveMonth({
  months,
  requested,
}: {
  months: readonly string[];
  requested: null | string;
}): null | string {
  if (requested !== null && months.includes(requested)) return requested;
  return months.at(-1) ?? null;
}
