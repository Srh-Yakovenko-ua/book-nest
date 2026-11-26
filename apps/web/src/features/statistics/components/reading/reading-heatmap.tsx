"use client";

import type { StatisticsCalendarDay, WeekStartDay } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";

import { cn } from "@/lib/utils";

import type { CalendarMonthSlot } from "../../model/statistics-calendar";

import {
  buildMonthSlots,
  isUnknownCalendarDay,
  weekdayOrder,
} from "../../model/statistics-calendar";
import { resolveReadingDayTarget } from "../../model/statistics-drilldown";
import { formatDayLong, formatMonthName, weekdayLabel } from "../../model/statistics-format";
import { ReadingDayDetails } from "../details/reading-day-details";
import { StatisticsDetailSurface } from "../details/statistics-detail-surface";
import { READING_INTENSITY_CLASS } from "./reading-intensity";

const HEATMAP_CLASS = {
  cell: "size-(--quarter-cell) rounded-[3px] outline-none",
  future: "bg-muted/40",
  grid: "flex gap-1 [--quarter-cell:clamp(0.625rem,calc((100cqi-var(--quarter-labels)-3.375rem)/18),1.125rem)] [--quarter-gap:2px] [--quarter-labels:0rem] @xs/quarter:[--quarter-labels:1.25rem]",
  legend: "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
  legendItem: "flex items-center gap-1.5",
  legendSwatch: "size-3 shrink-0 rounded-[3px]",
  month: "flex min-w-0 flex-col gap-1",
  monthHeader: "h-3 min-w-0",
  monthLabel: {
    base: "block truncate text-xs leading-3 font-medium",
    idle: "text-muted-foreground",
    selected: "font-semibold text-primary",
  },
  months: "flex min-w-0 flex-1 justify-between gap-3",
  root: "@container/quarter flex flex-col gap-2",
  unknown: "bg-secondary/45 ring-1 ring-border/60 ring-inset",
  week: "flex flex-col gap-(--quarter-gap)",
  weekday:
    "flex h-(--quarter-cell) items-center text-[0.625rem] leading-none text-muted-foreground",
  weekdays: "hidden w-4 shrink-0 flex-col gap-(--quarter-gap) pt-4 @xs/quarter:flex",
  weeks: "flex gap-(--quarter-gap)",
} as const;

const VISIBLE_WEEKDAY_ROWS = [0, 2, 4] as const;

export function ReadingHeatmap({
  days,
  months,
  onShowInBooksCalendar,
  selectedMonth,
  today,
  weekStartDay,
}: {
  days: readonly StatisticsCalendarDay[];
  months: readonly string[];
  onShowInBooksCalendar?: (date: string) => void;
  selectedMonth: string;
  today: string;
  weekStartDay: WeekStartDay;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.heatmap");
  const order = weekdayOrder(weekStartDay);
  const monthSlots = months.map((monthKey) => ({
    monthKey,
    weeks: buildMonthSlots({ days, monthKey, today, weekStartDay }),
  }));
  const slots = monthSlots.flatMap(({ weeks }) => weeks.flat());
  const hasUnknownDays = slots.some(isUnknownSlot);
  const hasFutureDays = slots.some((slot) => slot.kind === "future");

  return (
    <div className={HEATMAP_CLASS.root}>
      <div className={HEATMAP_CLASS.grid}>
        <div aria-hidden className={HEATMAP_CLASS.weekdays}>
          {order.map((weekday, row) => (
            <span className={HEATMAP_CLASS.weekday} key={weekday}>
              {VISIBLE_WEEKDAY_ROWS.some((visible) => visible === row)
                ? weekdayLabel({ locale, weekday, width: "short" })
                : ""}
            </span>
          ))}
        </div>
        <div className={HEATMAP_CLASS.months}>
          {monthSlots.map(({ monthKey, weeks }) => (
            <div className={HEATMAP_CLASS.month} key={monthKey}>
              <span className={HEATMAP_CLASS.monthHeader}>
                <span
                  className={cn(
                    HEATMAP_CLASS.monthLabel.base,
                    monthKey === selectedMonth
                      ? HEATMAP_CLASS.monthLabel.selected
                      : HEATMAP_CLASS.monthLabel.idle,
                  )}
                >
                  {formatMonthName(monthKey, locale)}
                </span>
              </span>
              <div className={HEATMAP_CLASS.weeks}>
                {weeks.map((week, weekIndex) => (
                  <div className={HEATMAP_CLASS.week} key={`${monthKey}-${weekIndex}`}>
                    {week.map((slot, weekdayIndex) => (
                      <HeatmapSlot
                        key={weekdayIndex}
                        onShowInBooksCalendar={onShowInBooksCalendar}
                        slot={slot}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={HEATMAP_CLASS.legend}>
        <span className="flex items-center gap-1">
          <span>{t("legendLess")}</span>
          {READING_INTENSITY_CLASS.background.map((className, level) => (
            <span aria-hidden className={cn(HEATMAP_CLASS.legendSwatch, className)} key={level} />
          ))}
          <span>{t("legendMore")}</span>
        </span>
        {hasUnknownDays ? (
          <span className={HEATMAP_CLASS.legendItem}>
            <span aria-hidden className={cn(HEATMAP_CLASS.legendSwatch, HEATMAP_CLASS.unknown)} />
            <span>{t("unknownLegend")}</span>
          </span>
        ) : null}
        {hasFutureDays ? (
          <span className={HEATMAP_CLASS.legendItem}>
            <span aria-hidden className={cn(HEATMAP_CLASS.legendSwatch, HEATMAP_CLASS.future)} />
            <span>{t("futureLegend")}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
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
  const tDay = useTranslations("statistics.details.day");
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
    HEATMAP_CLASS.cell,
    isUnknown ? HEATMAP_CLASS.unknown : READING_INTENSITY_CLASS.background[day.intensity],
  );
  const detailDate = resolveReadingDayTarget(day.drilldown);

  if (day.pagesRead === 0 || detailDate === null) {
    return <span aria-label={label} className={cellClass} role="img" />;
  }

  return (
    <StatisticsDetailSurface
      compact={{ closeLabel: tDay("close"), eyebrow: tDay("eyebrow") }}
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
          variant="compact"
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

function HeatmapSlot({
  onShowInBooksCalendar,
  slot,
}: {
  onShowInBooksCalendar?: (date: string) => void;
  slot: CalendarMonthSlot;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.heatmap");
  const tBooks = useTranslations("statistics.calendar.books");

  switch (slot.kind) {
    case "blank":
      return <span aria-hidden className={HEATMAP_CLASS.cell} />;
    case "day":
      return <HeatmapCell day={slot.day} onShowInBooksCalendar={onShowInBooksCalendar} />;
    case "future":
      return (
        <span
          aria-label={tBooks("dayFuture", { date: formatDayLong(slot.date, locale) })}
          className={cn(HEATMAP_CLASS.cell, HEATMAP_CLASS.future)}
          role="img"
        />
      );
    case "missing":
      return (
        <span
          aria-label={t("dayUnknown", { date: formatDayLong(slot.date, locale) })}
          className={cn(HEATMAP_CLASS.cell, HEATMAP_CLASS.unknown)}
          role="img"
        />
      );
  }
}

function isUnknownSlot(slot: CalendarMonthSlot): boolean {
  if (slot.kind === "missing") return true;
  return slot.kind === "day" && isUnknownCalendarDay(slot.day);
}
