"use client";

import type { Nullable, StatisticsCalendarDay, WeekStartDay } from "@app/shared";

import { addDays, format, getDay, getDaysInMonth, isAfter } from "date-fns";
import { useLocale, useTranslations } from "next-intl";

import { parseIsoDay } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { BooksCalendarJumpTarget } from "../../hooks/use-books-calendar-jump";
import type { CalendarWeek } from "../../model/statistics-calendar";

import {
  buildMonthGrid,
  isUnknownCalendarDay,
  toSelectableCalendarDay,
  weekdayOrder,
} from "../../model/statistics-calendar";
import { formatDayLong, weekdayLabel } from "../../model/statistics-format";
import { ReadingBooksMonthCellCovers } from "./reading-books-month-cell-covers";
import { READING_INTENSITY_CLASS } from "./reading-intensity";
import { ReadingIntensityMeter } from "./reading-intensity-meter";

const MONTH_GRID = { dayNumberFormat: "d", daysPerWeek: 7, isoDayFormat: "yyyy-MM-dd" } as const;

const MONTH_GRID_CLASS = {
  blank: "h-16",
  cell: "flex h-16 w-full min-w-0 gap-1 rounded-md border border-transparent p-1 text-left text-xs",
  columns: "grid grid-cols-7 gap-1",
  dayColumn: "flex shrink-0 flex-col items-start justify-between",
  indicator: "mx-0.5 mb-0.5",
  number: {
    base: "self-start px-0.5 tabular-nums",
    empty: "font-medium text-foreground",
    future: "font-medium text-muted-foreground",
    reading: "font-semibold text-ink",
    unknown: "font-medium text-muted-foreground",
  },
  readingTile: "border-border bg-card shadow-soft",
  selected: "border-primary ring-1 ring-primary",
  today: "font-bold text-ink underline decoration-primary decoration-2 underline-offset-2",
  trigger:
    "cursor-pointer transition duration-150 ease-out active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-jump-highlight:ring-4 data-jump-highlight:ring-primary/35",
  triggerIdle: "hover:border-accent-border hover:shadow-card",
  weekday: "text-center text-xs font-medium text-muted-foreground",
} as const;

type DayNumberTone = keyof Omit<typeof MONTH_GRID_CLASS.number, "base">;

type MonthGridSlot =
  | { date: string; kind: "future" | "missing" }
  | { day: StatisticsCalendarDay; kind: "day" }
  | { kind: "blank" };

export function ReadingBooksMonthGrid({
  className,
  days,
  jumpTarget,
  monthKey,
  onSelectDay,
  panelId,
  selectedDate,
  today,
  weekStartDay,
}: {
  className?: string;
  days: readonly StatisticsCalendarDay[];
  jumpTarget?: Nullable<BooksCalendarJumpTarget>;
  monthKey: string;
  onSelectDay: (date: string) => void;
  panelId: string;
  selectedDate: Nullable<string>;
  today: string;
  weekStartDay: WeekStartDay;
}) {
  const locale = useLocale();
  const weeks = buildMonthGrid({ days, monthKey, weekStartDay });
  const order = weekdayOrder(weekStartDay);
  const slots = toMonthGridSlots({ monthKey, order, today, weeks });

  return (
    <div className={cn("@container/month-grid flex flex-col gap-1", className)}>
      <div className={MONTH_GRID_CLASS.columns}>
        {order.map((weekday) => (
          <span className={MONTH_GRID_CLASS.weekday} key={weekday}>
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
                  isSelected={slot.day.date === selectedDate}
                  isToday={slot.day.date === today}
                  jumpTarget={jumpTarget?.date === slot.day.date ? jumpTarget : null}
                  key={slot.day.date}
                  onSelect={onSelectDay}
                  panelId={panelId}
                />
              );
            case "future":
            case "missing":
              return (
                <MonthUnrecordedCell
                  date={slot.date}
                  isToday={slot.date === today}
                  key={slot.date}
                  kind={slot.kind}
                />
              );
          }
        })}
      </div>
    </div>
  );
}

function DayNumber({
  date,
  isToday,
  tone,
}: {
  date: string;
  isToday: boolean;
  tone: DayNumberTone;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        MONTH_GRID_CLASS.number.base,
        MONTH_GRID_CLASS.number[tone],
        isToday && MONTH_GRID_CLASS.today,
      )}
    >
      {format(parseIsoDay(date), MONTH_GRID.dayNumberFormat)}
    </span>
  );
}

function MonthDayCell({
  day,
  isSelected,
  isToday,
  jumpTarget,
  onSelect,
  panelId,
}: {
  day: StatisticsCalendarDay;
  isSelected: boolean;
  isToday: boolean;
  jumpTarget: Nullable<BooksCalendarJumpTarget>;
  onSelect: (date: string) => void;
  panelId: string;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");

  const date = formatDayLong(day.date, locale);
  const isUnknown = isUnknownCalendarDay(day);
  const hasReading = day.booksCount > 0 || day.pagesRead > 0;
  const summary = t("daySummary", { books: day.booksCount, date, pages: day.pagesRead });
  const tone: DayNumberTone = hasReading ? "reading" : isUnknown ? "unknown" : "empty";
  const cellClass = cn(MONTH_GRID_CLASS.cell, hasReading && MONTH_GRID_CLASS.readingTile);

  const body = (
    <>
      <span className={MONTH_GRID_CLASS.dayColumn}>
        <DayNumber date={day.date} isToday={isToday} tone={tone} />
        {isUnknown ? (
          <UnknownHistoryMark />
        ) : hasReading ? (
          <ReadingIntensityMeter className={MONTH_GRID_CLASS.indicator} level={day.intensity} />
        ) : null}
      </span>
      <ReadingBooksMonthCellCovers day={day} />
    </>
  );

  if (toSelectableCalendarDay(day) === null) {
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
    <button
      aria-controls={panelId}
      aria-label={summary}
      aria-pressed={isSelected}
      className={cn(
        cellClass,
        MONTH_GRID_CLASS.trigger,
        isSelected ? MONTH_GRID_CLASS.selected : MONTH_GRID_CLASS.triggerIdle,
      )}
      onClick={() => onSelect(day.date)}
      ref={jumpTarget?.ref}
      type="button"
    >
      {body}
    </button>
  );
}

function MonthUnrecordedCell({
  date,
  isToday,
  kind,
}: {
  date: string;
  isToday: boolean;
  kind: "future" | "missing";
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");
  const longDate = formatDayLong(date, locale);

  if (kind === "future") {
    return (
      <span className={MONTH_GRID_CLASS.cell}>
        <span className="sr-only">{t("dayFuture", { date: longDate })}</span>
        <DayNumber date={date} isToday={false} tone="future" />
      </span>
    );
  }

  return (
    <span className={MONTH_GRID_CLASS.cell}>
      <span className="sr-only">{t("dayUnknown", { date: longDate })}</span>
      <span className={MONTH_GRID_CLASS.dayColumn}>
        <DayNumber date={date} isToday={isToday} tone="unknown" />
        <UnknownHistoryMark />
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

function UnknownHistoryMark() {
  return (
    <span aria-hidden className={cn(MONTH_GRID_CLASS.indicator, READING_INTENSITY_CLASS.unknown)} />
  );
}
