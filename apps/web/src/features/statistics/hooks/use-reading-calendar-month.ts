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
  hasDaysBeforeAccountStart,
  isDateInMonth,
  listCalendarMonths,
  resolveCalendarMonth,
  resolveSelectedCalendarDay,
  summarizeCalendarMonth,
  toSelectableCalendarDay,
} from "../model/statistics-calendar";

export type ReadingCalendarMonth = ReturnType<typeof useReadingCalendarMonth>;

export function useReadingCalendarMonth({
  accountStart,
  calendar,
  month,
  selectedDay,
}: {
  accountStart: Nullable<string>;
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
    accountStart,
    books: monthBooksCount({
      exact: exactMonthBooks,
      isHistoryComplete: accountStart !== null,
      summary,
    }),
    days,
    hasDaysBeforeAccount: hasDaysBeforeAccountStart({ accountStart, days }),
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
  isHistoryComplete,
  summary,
}: {
  exact: ReadingStatisticsActivityPage | undefined;
  isHistoryComplete: boolean;
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
    isLowerBound:
      !isHistoryComplete &&
      (summary.hasLegacyHistory || exact.historyQuality === "legacy_observed_only"),
  };
}
