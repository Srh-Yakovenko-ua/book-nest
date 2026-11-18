"use client";

import type {
  Nullable,
  ReadingStatisticsActivityPage,
  ReadingStatisticsCalendarSection,
  WeekStartDay,
} from "@app/shared";
import type { RefObject } from "react";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { Button } from "@/components/ui/button";
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
  resolveSelectedCalendarDay,
  summarizeCalendarMonth,
} from "../../model/statistics-calendar";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { ReadingBooksDayPanel } from "./reading-books-day-panel";
import { ReadingBooksDiary } from "./reading-books-diary";
import { ReadingBooksMonthGrid } from "./reading-books-month-grid";
import { READING_INTENSITY_CLASS } from "./reading-intensity";
import { ReadingIntensityMeter } from "./reading-intensity-meter";

type MonthKpi = {
  label: "monthActiveDays" | "monthBooks" | "monthPages";
  value: string;
};

export function ReadingBooksCalendar({
  calendar,
  jumpTarget,
  month,
  monthLabelRef,
  onSelectDay,
  selectedDay,
  today,
  weekStartDay,
}: {
  calendar: ReadingStatisticsCalendarSection;
  jumpTarget?: Nullable<BooksCalendarJumpTarget>;
  month: Nullable<string>;
  monthLabelRef?: RefObject<Nullable<HTMLSpanElement>>;
  onSelectDay: (date: string) => void;
  selectedDay: Nullable<string>;
  today: string;
  weekStartDay: WeekStartDay;
}) {
  const isMobile = useIsMobile();
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");
  const panelId = useId();
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
    { label: "monthActiveDays", value: lowerBound(summary.hasUnknownDays, summary.activeDays) },
    { label: "monthBooks", value: lowerBound(books.isLowerBound, books.count) },
    { label: "monthPages", value: lowerBound(summary.hasUnknownDays, summary.pagesRead) },
  ];
  const selected = resolveSelectedCalendarDay({ days: monthDays, requested: selectedDay });

  const retryMonthBooks = async () => {
    if (monthBooks.isFetching) return;
    const result = await monthBooks.refetch();
    if (result.isSuccess) monthLabelRef?.current?.focus();
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div>
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
          {kpis.map((kpi) => (
            <div className="flex items-baseline gap-1.5" key={kpi.label}>
              <dt className="text-muted-foreground">{t(kpi.label)}</dt>
              <dd className="font-semibold text-ink tabular-nums">{kpi.value}</dd>
            </div>
          ))}
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
        <ReadingBooksDiary
          days={monthDays}
          isHistoryUncertain={isHistoryUncertain}
          jumpTarget={jumpTarget}
        />
      ) : (
        <>
          <MonthGridLegend summary={summary} />
          <div className="grid gap-4 lg:grid-cols-5">
            <ReadingBooksMonthGrid
              className="lg:col-span-3"
              days={monthDays}
              jumpTarget={jumpTarget}
              monthKey={monthKey}
              onSelectDay={onSelectDay}
              panelId={panelId}
              selectedDate={selected?.date ?? null}
              today={today}
              weekStartDay={weekStartDay}
            />
            <ReadingBooksDayPanel
              className="lg:col-span-2"
              id={panelId}
              isHistoryUncertain={isHistoryUncertain}
              selected={selected}
            />
          </div>
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
  const tHeatmap = useTranslations("statistics.calendar.heatmap");

  if (summary.hasUnknownDays) {
    return (
      <p className="flex items-center gap-2">
        <span aria-hidden className={READING_INTENSITY_CLASS.unknown} />
        <span>{tHeatmap("unknownLegend")}</span>
      </p>
    );
  }

  if (summary.hasLegacyHistory) {
    return <StatisticsNote>{t("legacyMonthNote")}</StatisticsNote>;
  }

  return null;
}

function MonthGridLegend({ summary }: { summary: CalendarMonthSummary }) {
  const t = useTranslations("statistics.calendar.books");
  const tHeatmap = useTranslations("statistics.calendar.heatmap");

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
      <p className="flex items-center gap-2">
        <span>{t("pagesPerDayLegend")}</span>
        <span className="flex items-center gap-1.5">
          <span>{tHeatmap("legendLess")}</span>
          {READING_INTENSITY_CLASS.meter.fillWidth.map((fillWidth, level) =>
            level === 0 ? null : <ReadingIntensityMeter key={fillWidth} level={level} />,
          )}
          <span>{tHeatmap("legendMore")}</span>
        </span>
      </p>
      <MonthGridHistoryNote summary={summary} />
    </div>
  );
}
