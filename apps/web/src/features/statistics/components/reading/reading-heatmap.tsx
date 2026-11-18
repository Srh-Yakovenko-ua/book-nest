"use client";

import type { StatisticsCalendarDay, WeekStartDay } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import {
  buildHeatmapWeeks,
  isDateInMonth,
  isUnknownCalendarDay,
  weekdayOrder,
} from "../../model/statistics-calendar";
import { resolveReadingDayTarget } from "../../model/statistics-drilldown";
import { formatDayLong, formatMonthShort, weekdayLabel } from "../../model/statistics-format";
import { ReadingDayDetails } from "../details/reading-day-details";
import { StatisticsDetailSurface } from "../details/statistics-detail-surface";
import { READING_INTENSITY_CLASS } from "./reading-intensity";

const HEATMAP_CELL_CLASS = {
  unknown: "hatched",
} as const;

const VISIBLE_WEEKDAY_ROWS = [0, 2, 4] as const;

export function ReadingHeatmap({
  days,
  focusMonth,
  onShowInBooksCalendar,
  weekStartDay,
}: {
  days: readonly StatisticsCalendarDay[];
  focusMonth?: string;
  onShowInBooksCalendar?: (date: string) => void;
  weekStartDay: WeekStartDay;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.heatmap");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const weeks = buildHeatmapWeeks({ days, weekStartDay });
  const order = weekdayOrder(weekStartDay);
  const hasUnknownDays = days.some(isUnknownCalendarDay);
  const isFocusMonthShown = weeks.some((week) => containsMonth({ month: focusMonth, week }));

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null || !isFocusMonthShown) return;
    revealFocusMonth(scroller);
  }, [focusMonth, isFocusMonthShown]);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto pb-1" ref={scrollerRef}>
        <div className="flex min-w-max gap-2">
          <div className="flex shrink-0 flex-col gap-[3px] pt-4">
            {order.map((weekday, row) => (
              <span
                aria-hidden
                className="flex h-[13px] items-center text-[0.625rem] leading-none text-muted-foreground"
                key={weekday}
              >
                {VISIBLE_WEEKDAY_ROWS.some((visible) => visible === row)
                  ? weekdayLabel({ locale, weekday, width: "short" })
                  : ""}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex gap-[3px]">
              {weeks.map((week, weekIndex) => (
                <span
                  className="w-[13px] text-[0.6875rem] text-muted-foreground"
                  key={firstDate(week) ?? weekIndex}
                >
                  {monthTick(weeks, weekIndex, locale)}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {weeks.map((week, weekIndex) => (
                <div
                  className="flex flex-col gap-[3px]"
                  data-focus-month={containsMonth({ month: focusMonth, week }) ? "" : undefined}
                  key={firstDate(week) ?? weekIndex}
                >
                  {week.map((day, dayIndex) =>
                    day === null ? (
                      <span aria-hidden className="size-[13px]" key={dayIndex} />
                    ) : (
                      <HeatmapCell
                        day={day}
                        key={day.date}
                        onShowInBooksCalendar={onShowInBooksCalendar}
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="w-full">{t("intensityLegend")}</span>
        <span className="flex items-center gap-1.5">
          <span>{t("legendLess")}</span>
          {READING_INTENSITY_CLASS.background.map((className, level) => (
            <span aria-hidden className={cn("size-[13px] rounded-[3px]", className)} key={level} />
          ))}
          <span>{t("legendMore")}</span>
        </span>
        {hasUnknownDays ? (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("size-[13px] rounded-[3px]", HEATMAP_CELL_CLASS.unknown)}
            />
            <span>{t("unknownLegend")}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function containsMonth({
  month,
  week,
}: {
  month?: string;
  week: readonly (null | StatisticsCalendarDay)[];
}): boolean {
  if (month === undefined) return false;
  return week.some((day) => day !== null && isDateInMonth(day.date, month));
}

function firstDate(week: readonly (null | StatisticsCalendarDay)[]): null | string {
  return week.find((day) => day !== null)?.date ?? null;
}

function HeatmapCell({
  day,
  onShowInBooksCalendar,
}: {
  day: StatisticsCalendarDay;
  onShowInBooksCalendar?: (date: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.heatmap");
  const isBooksCalendarRequested = useRef(false);

  const date = formatDayLong(day.date, locale);
  const isUnknown = isUnknownCalendarDay(day);
  const label =
    day.pagesRead === 0
      ? isUnknown
        ? t("dayUnknown", { date })
        : t("dayEmpty", { date })
      : t("daySummary", { books: day.booksCount, date, pages: day.pagesRead });

  const cellClass = cn(
    "size-[13px] rounded-[3px] outline-none",
    isUnknown ? HEATMAP_CELL_CLASS.unknown : READING_INTENSITY_CLASS.background[day.intensity],
  );
  const detailDate = resolveReadingDayTarget(day.drilldown);

  if (day.pagesRead === 0 || detailDate === null) {
    return <span aria-label={label} className={cellClass} role="img" />;
  }

  return (
    <StatisticsDetailSurface
      detail={({ close }) => (
        <ReadingDayDetails
          date={detailDate}
          onShowInBooksCalendar={
            onShowInBooksCalendar === undefined
              ? undefined
              : () => {
                  isBooksCalendarRequested.current = true;
                  close();
                }
          }
        />
      )}
      label={label}
      onCloseAutoFocus={(event) => {
        if (onShowInBooksCalendar === undefined || !isBooksCalendarRequested.current) return;
        isBooksCalendarRequested.current = false;
        event.preventDefault();
        onShowInBooksCalendar(detailDate);
      }}
      title={date}
      triggerClassName={cn(
        cellClass,
        "transition-transform focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:ring-2 data-[state=open]:ring-primary motion-safe:hover:scale-110",
      )}
    >
      <span aria-hidden className="block size-full" />
    </StatisticsDetailSurface>
  );
}

function monthTick(
  weeks: readonly (null | StatisticsCalendarDay)[][],
  weekIndex: number,
  locale: string,
): string {
  const current = firstDate(weeks[weekIndex] ?? []);
  if (current === null) return "";
  const previous = weekIndex === 0 ? null : firstDate(weeks[weekIndex - 1] ?? []);
  if (previous !== null && previous.slice(0, 7) === current.slice(0, 7)) return "";
  return formatMonthShort(current, locale);
}

function revealFocusMonth(scroller: HTMLElement) {
  if (scroller.scrollWidth <= scroller.clientWidth) return;
  const focusColumns = Array.from(scroller.querySelectorAll<HTMLElement>("[data-focus-month]"));
  const firstColumn = focusColumns.at(0);
  const lastColumn = focusColumns.at(-1);
  if (firstColumn === undefined || lastColumn === undefined) return;
  const contentLeft =
    scroller.getBoundingClientRect().left + scroller.clientLeft - scroller.scrollLeft;
  const monthStart = firstColumn.getBoundingClientRect().left - contentLeft;
  const monthEnd = lastColumn.getBoundingClientRect().right - contentLeft;
  scroller.scrollTo({
    behavior: "instant",
    left: Math.max(0, Math.min(monthStart, monthEnd - scroller.clientWidth)),
  });
}
