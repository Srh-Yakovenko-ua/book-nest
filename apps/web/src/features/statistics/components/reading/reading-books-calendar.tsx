"use client";

import type {
  Nullable,
  ReadingStatisticsActivityPage,
  ReadingStatisticsCalendarSection,
  WeekStartDay,
} from "@app/shared";
import type { RefObject } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";
import type { StatCardIconTone } from "@/components/ui/stat-card";

import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { BooksCalendarJumpTarget } from "../../hooks/use-books-calendar-jump";
import type { CalendarMonthSummary } from "../../model/statistics-calendar";

import { useReadingMonthBooks } from "../../api/use-reading-month-books";
import {
  clipCalendarMonth,
  isDateInMonth,
  listCalendarMonths,
  resolveCalendarMonth,
  summarizeCalendarMonth,
} from "../../model/statistics-calendar";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { ReadingBooksDiary } from "./reading-books-diary";
import { ReadingBooksMonthGrid } from "./reading-books-month-grid";

const MONTH_KPI_LAYOUT = {
  grid: "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3",
  tile: "px-3 py-2.5 sm:px-3 sm:py-2.5",
} as const;

type MonthKpi = {
  icon: UiIconName;
  label: "monthActiveDays" | "monthBooks" | "monthPages";
  tone: StatCardIconTone;
  value: string;
};

export function ReadingBooksCalendar({
  calendar,
  jumpTarget,
  month,
  monthLabelRef,
  today,
  weekStartDay,
}: {
  calendar: ReadingStatisticsCalendarSection;
  jumpTarget?: Nullable<BooksCalendarJumpTarget>;
  month: Nullable<string>;
  monthLabelRef?: RefObject<Nullable<HTMLSpanElement>>;
  today: string;
  weekStartDay: WeekStartDay;
}) {
  const isMobile = useIsMobile();
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");
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
  const isHistoryUncertain = summary.hasUnknownDays || summary.hasLegacyHistory;
  const kpis: MonthKpi[] = [
    {
      icon: "calendar",
      label: "monthActiveDays",
      tone: "primary",
      value: lowerBound(summary.hasUnknownDays, summary.activeDays),
    },
    {
      icon: "book-copy",
      label: "monthBooks",
      tone: "genre",
      value: lowerBound(books.isLowerBound, books.count),
    },
    {
      icon: "book-open-text",
      label: "monthPages",
      tone: "info",
      value: lowerBound(summary.hasUnknownDays, summary.pagesRead),
    },
  ];

  const retryMonthBooks = async () => {
    if (monthBooks.isFetching) return;
    const result = await monthBooks.refetch();
    if (result.isSuccess) monthLabelRef?.current?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-250 flex-col gap-3">
      <div>
        <div className={MONTH_KPI_LAYOUT.grid}>
          {kpis.map((kpi) => (
            <StatCard
              className={MONTH_KPI_LAYOUT.tile}
              icon={kpi.icon}
              iconBadgeSize="md"
              iconTone={kpi.tone}
              key={kpi.label}
              label={t(kpi.label)}
              labelOverflow="wrap"
              size="compact"
              value={kpi.value}
            />
          ))}
        </div>
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
        <ReadingBooksDiary
          days={monthDays}
          isHistoryUncertain={isHistoryUncertain}
          jumpTarget={jumpTarget}
        />
      ) : (
        <>
          <ReadingBooksMonthGrid
            days={monthDays}
            jumpTarget={jumpTarget}
            monthKey={monthKey}
            today={today}
            weekStartDay={weekStartDay}
          />
          <MonthGridHistoryNote summary={summary} />
        </>
      )}
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

function MonthGridHistoryNote({ summary }: { summary: CalendarMonthSummary }) {
  const t = useTranslations("statistics.calendar.books");

  if (summary.hasUnknownDays) {
    return (
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-dashed border-muted-foreground/40 text-[0.625rem] font-medium"
        >
          ?
        </span>
        {t("unknownLegend")}
      </p>
    );
  }

  if (summary.hasLegacyHistory) {
    return <StatisticsNote>{t("legacyMonthNote")}</StatisticsNote>;
  }

  return null;
}
