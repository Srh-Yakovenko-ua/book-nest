"use client";

import type {
  Nullable,
  ReadingStatisticsActivityPage,
  ReadingStatisticsCalendarSection,
  WeekStartDay,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { CalendarMonthSummary } from "../../model/statistics-calendar";

import { useReadingMonthBooks } from "../../api/use-reading-month-books";
import {
  clipCalendarMonth,
  isDateInMonth,
  listCalendarMonths,
  resolveCalendarMonth,
  summarizeCalendarMonth,
} from "../../model/statistics-calendar";
import { formatMonthKey } from "../../model/statistics-format";
import { StatisticsStat } from "../statistics-stat";
import { StatisticsSectionState } from "../statistics-states";
import { ReadingBooksDiary } from "./reading-books-diary";
import { ReadingBooksMonthGrid } from "./reading-books-month-grid";

export function ReadingBooksCalendar({
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
  const isMobile = useIsMobile();
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");
  const monthLabel = useRef<HTMLSpanElement>(null);
  const months = listCalendarMonths(calendar.displayRange);
  const monthKey = resolveCalendarMonth({ months, requested: month });
  const monthDays =
    monthKey === null ? [] : calendar.days.filter((day) => isDateInMonth(day.date, monthKey));
  const summary = summarizeCalendarMonth(monthDays);
  const monthRange =
    monthKey === null
      ? calendar.displayRange
      : clipCalendarMonth({ monthKey, range: calendar.displayRange });
  const monthBooks = useReadingMonthBooks({
    enabled: monthKey !== null && summary.books.isLowerBound,
    from: monthRange.from,
    to: monthRange.to,
  });

  if (monthKey === null) {
    return <StatisticsSectionState kind="empty" title={t("empty")} />;
  }

  const index = months.indexOf(monthKey);
  const lowerBound = (isLowerBound: boolean, value: number) =>
    isLowerBound
      ? t("atLeast", { value: formatNumber(value, locale) })
      : formatNumber(value, locale);
  const exactMonthBooks = monthBooks.isError ? undefined : monthBooks.data;
  const books = monthBooksCount({ exact: exactMonthBooks, summary });
  const isExactCountMissing = summary.books.isLowerBound && exactMonthBooks === undefined;
  const isMonthBooksStatusShown =
    isExactCountMissing && (monthBooks.isFetching || monthBooks.isError);
  const hasMonthBooksFailed = monthBooks.errorUpdateCount > 0;

  const retryMonthBooks = async () => {
    if (monthBooks.isFetching) return;
    const result = await monthBooks.refetch();
    if (result.isSuccess) monthLabel.current?.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          aria-disabled={index <= 0}
          aria-label={t("previousMonth")}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          onClick={() => {
            if (index > 0) onMonthChange(months[index - 1] ?? monthKey);
          }}
          size="icon-lg"
          variant="ghost"
        >
          <UiIcon name="chevron-left" size={16} />
        </Button>
        <span
          aria-live="polite"
          className="font-heading text-sm font-semibold text-ink outline-none"
          ref={monthLabel}
          tabIndex={-1}
        >
          {formatMonthKey(monthKey, locale)}
        </span>
        <Button
          aria-disabled={index >= months.length - 1}
          aria-label={t("nextMonth")}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          onClick={() => {
            if (index < months.length - 1) onMonthChange(months[index + 1] ?? monthKey);
          }}
          size="icon-lg"
          variant="ghost"
        >
          <UiIcon name="chevron-right" size={16} />
        </Button>
      </div>

      <div>
        <dl className="grid grid-cols-3 gap-2">
          <StatisticsStat
            label={t("monthActiveDays")}
            value={lowerBound(summary.hasUnknownDays, summary.activeDays)}
          />
          <StatisticsStat
            label={t("monthBooks")}
            value={lowerBound(books.isLowerBound, books.count)}
          />
          <StatisticsStat
            label={t("monthPages")}
            value={lowerBound(summary.hasUnknownDays, summary.pagesRead)}
          />
        </dl>
        <div aria-live="polite">
          {isMonthBooksStatusShown ? (
            <p
              className={cn(
                "mt-1.5 flex flex-wrap items-center gap-x-2 text-xs",
                monthBooks.isFetching ? "text-muted-foreground" : "text-destructive",
              )}
            >
              {monthBooks.isFetching ? t("monthBooksLoading") : t("monthBooksError")}
              {hasMonthBooksFailed ? (
                <Button
                  aria-disabled={monthBooks.isFetching}
                  className="underline underline-offset-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                  onClick={() => void retryMonthBooks()}
                  size="sm"
                  variant="link"
                >
                  {t("monthBooksRetry")}
                </Button>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>

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

function monthBooksCount({
  exact,
  summary,
}: {
  exact: ReadingStatisticsActivityPage | undefined;
  summary: CalendarMonthSummary;
}): { count: number; isLowerBound: boolean } {
  if (!summary.books.isLowerBound) {
    return { count: summary.books.count, isLowerBound: summary.hasLegacyHistory };
  }
  if (exact === undefined) {
    return { count: summary.books.count, isLowerBound: true };
  }
  return {
    count: exact.booksCount,
    isLowerBound: summary.hasLegacyHistory || exact.historyQuality === "legacy_observed_only",
  };
}
