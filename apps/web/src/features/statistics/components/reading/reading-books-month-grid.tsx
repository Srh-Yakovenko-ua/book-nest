"use client";

import type { Nullable, StatisticsCalendarDay, WeekStartDay } from "@app/shared";

import { addDays, format, getDay, getDaysInMonth, isAfter } from "date-fns";
import { useLocale, useTranslations } from "next-intl";

import { formatNumber, parseIsoDay } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { BooksCalendarJumpTarget } from "../../hooks/use-books-calendar-jump";
import type { CalendarWeek } from "../../model/statistics-calendar";

import {
  buildMonthGrid,
  isUnknownCalendarDay,
  weekdayOrder,
} from "../../model/statistics-calendar";
import { resolveReadingDayTarget } from "../../model/statistics-drilldown";
import { formatDayLong, weekdayLabel } from "../../model/statistics-format";
import { ReadingDayDetails } from "../details/reading-day-details";
import { StatisticsDetailSurface } from "../details/statistics-detail-surface";
import { ReadingDayPreview } from "./reading-day-preview";

const MONTH_GRID = { coverLimit: 2, daysPerWeek: 7, isoDayFormat: "yyyy-MM-dd" } as const;

const MONTH_GRID_CLASS = {
  blank: "min-h-20 xl:min-h-22",
  cell: "flex min-h-20 w-full min-w-0 flex-col gap-1.5 rounded-lg border p-2 xl:min-h-22",
  columns: "grid grid-cols-7 gap-2",
  cover: "w-7 shrink-0",
  dayNumber: "text-xs font-medium text-foreground tabular-nums",
  futureDayNumber: "text-xs font-medium text-muted-foreground tabular-nums",
  pages: "text-[0.625rem] text-muted-foreground tabular-nums",
  trigger:
    "transition-colors outline-none hover:border-accent-border hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50 data-jump-highlight:ring-2 data-jump-highlight:ring-primary",
  unknown: "border-dashed border-muted-foreground/40",
  unknownMark: "m-auto text-sm font-medium text-muted-foreground",
} as const;

type MonthGridSlot =
  | { date: string; kind: "future" | "missing" }
  | { day: StatisticsCalendarDay; kind: "day" }
  | { kind: "blank" };

export function ReadingBooksMonthGrid({
  days,
  jumpTarget,
  monthKey,
  today,
  weekStartDay,
}: {
  days: readonly StatisticsCalendarDay[];
  jumpTarget?: Nullable<BooksCalendarJumpTarget>;
  monthKey: string;
  today: string;
  weekStartDay: WeekStartDay;
}) {
  const locale = useLocale();
  const weeks = buildMonthGrid({ days, monthKey, weekStartDay });
  const order = weekdayOrder(weekStartDay);
  const slots = toMonthGridSlots({ monthKey, order, today, weeks });

  return (
    <div className="flex flex-col gap-2">
      <div className={MONTH_GRID_CLASS.columns}>
        {order.map((weekday) => (
          <span
            className="text-center text-[0.6875rem] font-medium text-muted-foreground"
            key={weekday}
          >
            {weekdayLabel({ locale, weekday, width: "short" })}
          </span>
        ))}
      </div>
      <div className={MONTH_GRID_CLASS.columns}>
        {slots.map((slot, index) => {
          switch (slot.kind) {
            case "blank":
              return <span aria-hidden className={MONTH_GRID_CLASS.blank} key={`blank-${index}`} />;
            case "day":
              return (
                <MonthDayCell
                  day={slot.day}
                  jumpTarget={jumpTarget?.date === slot.day.date ? jumpTarget : null}
                  key={slot.day.date}
                />
              );
            case "future":
            case "missing":
              return <MonthUnrecordedCell date={slot.date} key={slot.date} kind={slot.kind} />;
          }
        })}
      </div>
    </div>
  );
}

function MonthDayCell({
  day,
  jumpTarget,
}: {
  day: StatisticsCalendarDay;
  jumpTarget: Nullable<BooksCalendarJumpTarget>;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");

  const date = formatDayLong(day.date, locale);
  const isUnknown = isUnknownCalendarDay(day);
  const hasReading = day.booksCount > 0 || day.pagesRead > 0;
  const cellClass = cn(
    MONTH_GRID_CLASS.cell,
    hasReading
      ? "border-border bg-card"
      : isUnknown
        ? MONTH_GRID_CLASS.unknown
        : "border-transparent",
  );
  const summary = t("daySummary", { books: day.booksCount, date, pages: day.pagesRead });
  const detailDate = resolveReadingDayTarget(day.drilldown);

  const body = (
    <>
      <span className="flex items-baseline justify-between gap-1">
        <span className={MONTH_GRID_CLASS.dayNumber}>{day.date.slice(8)}</span>
        {day.pagesRead === 0 ? null : (
          <span className={MONTH_GRID_CLASS.pages}>{formatNumber(day.pagesRead, locale)}</span>
        )}
      </span>
      {isUnknown ? (
        <span aria-hidden className={MONTH_GRID_CLASS.unknownMark}>
          ?
        </span>
      ) : (
        <ReadingDayPreview
          className="flex-wrap"
          coverClassName={MONTH_GRID_CLASS.cover}
          coverLimit={MONTH_GRID.coverLimit}
          day={day}
        />
      )}
    </>
  );

  if (day.booksCount === 0 || detailDate === null) {
    return (
      <span className={cellClass}>
        <span className="sr-only">
          {hasReading ? summary : isUnknown ? t("dayUnknown", { date }) : t("dayEmpty", { date })}
        </span>
        <span aria-hidden className="contents">
          {body}
        </span>
      </span>
    );
  }

  return (
    <StatisticsDetailSurface
      detail={() => <ReadingDayDetails date={detailDate} />}
      label={summary}
      title={date}
      triggerClassName={cn(cellClass, MONTH_GRID_CLASS.trigger)}
      triggerRef={jumpTarget?.ref}
    >
      {body}
    </StatisticsDetailSurface>
  );
}

function MonthUnrecordedCell({ date, kind }: { date: string; kind: "future" | "missing" }) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");
  const longDate = formatDayLong(date, locale);

  if (kind === "future") {
    return (
      <span className={cn(MONTH_GRID_CLASS.cell, "border-transparent")}>
        <span className="sr-only">{t("dayFuture", { date: longDate })}</span>
        <span aria-hidden className={MONTH_GRID_CLASS.futureDayNumber}>
          {date.slice(8)}
        </span>
      </span>
    );
  }

  return (
    <span className={cn(MONTH_GRID_CLASS.cell, MONTH_GRID_CLASS.unknown)}>
      <span className="sr-only">{t("dayUnknown", { date: longDate })}</span>
      <span aria-hidden className={MONTH_GRID_CLASS.dayNumber}>
        {date.slice(8)}
      </span>
      <span aria-hidden className={MONTH_GRID_CLASS.unknownMark}>
        ?
      </span>
    </span>
  );
}

function toMonthGridSlots({
  monthKey,
  order,
  today,
  weeks,
}: {
  monthKey: string;
  order: readonly number[];
  today: string;
  weeks: readonly CalendarWeek[];
}): MonthGridSlot[] {
  const monthStart = parseIsoDay(`${monthKey}-01`);
  const leadingSlots = order.indexOf(getDay(monthStart));
  const monthLength = getDaysInMonth(monthStart);
  const todayDate = parseIsoDay(today);

  return weeks.flatMap((week, weekIndex) =>
    week.map((day, weekdayIndex): MonthGridSlot => {
      if (day !== null) return { day, kind: "day" };
      const dayOffset = weekIndex * MONTH_GRID.daysPerWeek + weekdayIndex - leadingSlots;
      if (dayOffset < 0 || dayOffset >= monthLength) return { kind: "blank" };
      const date = addDays(monthStart, dayOffset);
      return {
        date: format(date, MONTH_GRID.isoDayFormat),
        kind: isAfter(date, todayDate) ? "future" : "missing",
      };
    }),
  );
}
