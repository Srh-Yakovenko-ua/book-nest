"use client";

import type {
  Nullable,
  ReadingStatisticsActivityPage,
  ReadingStatisticsCalendarSection,
} from "@app/shared";

import type { CalendarMonthSummary } from "../model/statistics-calendar";

import { useReadingMonthBooks } from "../api/use-reading-month-books";
import {
  clipCalendarMonth,
  isDateInMonth,
  listCalendarMonths,
  resolveCalendarMonth,
  resolveSelectedCalendarDay,
  summarizeCalendarMonth,
  toSelectableCalendarDay,
} from "../model/statistics-calendar";

export type ReadingCalendarMonth = ReturnType<typeof useReadingCalendarMonth>;

export function useReadingCalendarMonth({
  calendar,
  month,
  selectedDay,
}: {
  calendar: ReadingStatisticsCalendarSection;
  month: Nullable<string>;
  selectedDay: Nullable<string>;
}) {
  const months = listCalendarMonths(calendar.displayRange);
  const monthKey = resolveCalendarMonth({ months, requested: month });
  const days =
    monthKey === null ? [] : calendar.days.filter((day) => isDateInMonth(day.date, monthKey));
  const summary = summarizeCalendarMonth(days);
  const range =
    monthKey === null
      ? calendar.displayRange
      : clipCalendarMonth({ monthKey, range: calendar.displayRange });
  const monthBooks = useReadingMonthBooks({
    enabled: monthKey !== null && summary.books.isLowerBound,
    from: range.from,
    to: range.to,
  });
  const exactMonthBooks = monthBooks.isError ? undefined : monthBooks.data;
  const isExactCountMissing = summary.books.isLowerBound && exactMonthBooks === undefined;

  return {
    books: monthBooksCount({ exact: exactMonthBooks, summary }),
    days,
    isHistoryUncertain: summary.hasUnknownDays || summary.hasLegacyHistory,
    monthBooksStatus:
      isExactCountMissing && (monthBooks.isFetching || monthBooks.isError)
        ? {
            hasFailed: monthBooks.errorUpdateCount > 0,
            isFetching: monthBooks.isFetching,
            retry: monthBooks.refetch,
          }
        : null,
    monthKey,
    selectableDays: days.flatMap((day) => toSelectableCalendarDay(day) ?? []),
    selected: resolveSelectedCalendarDay({ days, requested: selectedDay }),
    summary,
  };
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
