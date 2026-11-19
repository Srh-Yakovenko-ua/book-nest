"use client";

import type { Nullable, StatisticsCalendarDay, WeekStartDay } from "@app/shared";
import type { CSSProperties } from "react";

import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { parseIsoDay } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { BooksCalendarJumpTarget } from "../../hooks/use-books-calendar-jump";

import {
  buildMonthSlots,
  isUnknownCalendarDay,
  toSelectableCalendarDay,
  weekdayOrder,
} from "../../model/statistics-calendar";
import { formatDayLong, weekdayLabel } from "../../model/statistics-format";
import { ReadingBooksMonthCellCovers } from "./reading-books-month-cell-covers";

const MONTH_GRID = { dayNumberFormat: "d" } as const;

const MONTH_GRID_CLASS = {
  blank: "min-w-0",
  cell: "relative isolate h-full w-full min-w-0 overflow-hidden rounded-lg border text-left",
  columns: "grid grid-cols-7 gap-1",
  days: "auto-rows-[clamp(3.5rem,calc((100dvh-16.25rem)/var(--month-weeks)-0.25rem),6.25rem)]",
  number: {
    base: "absolute top-1 left-1 z-10 flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs leading-none tabular-nums",
    empty: "font-medium text-foreground",
    future: "font-medium text-muted-foreground/70",
    poster: "bg-card/90 font-semibold text-ink shadow-xs",
    reading: "font-semibold text-ink",
    unknown: "font-medium text-muted-foreground",
  },
  pages: "absolute inset-x-1 bottom-1 z-10 flex",
  pagesBadge:
    "min-w-0 truncate rounded-sm bg-card/90 px-1 py-0.5 text-[0.6875rem] leading-none font-medium text-ink tabular-nums shadow-xs",
  selected: "z-10 ring-2 ring-primary ring-offset-2 ring-offset-card",
  shelfMark: "absolute inset-0 grid place-items-center text-muted-foreground",
  today: "bg-primary font-semibold text-primary-foreground",
  tone: {
    empty: "border-border/70 bg-card",
    future: "border-dashed border-border/60 bg-muted/40",
    poster: "border-border bg-secondary shadow-soft",
    reading: "border-border bg-secondary",
    unknown: "border-border/60 bg-secondary/60",
  },
  trigger:
    "cursor-pointer transition duration-150 ease-out focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-jump-highlight:z-10 data-jump-highlight:ring-4 data-jump-highlight:ring-primary/35 motion-safe:active:translate-y-px",
  triggerIdle: "hover:border-accent-border hover:shadow-card",
  weekday: "text-center text-xs leading-4 font-medium text-muted-foreground",
} as const;

type DayTone = keyof typeof MONTH_GRID_CLASS.tone;

type MonthGridStyle = CSSProperties & { "--month-weeks": number };

export function ReadingBooksMonthGrid({
  days,
  jumpTarget,
  monthKey,
  onSelectDay,
  panelId,
  selectedDate,
  today,
  weekStartDay,
}: {
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
  const weeks = buildMonthSlots({ days, monthKey, today, weekStartDay });
  const order = weekdayOrder(weekStartDay);
  const slots = weeks.flat();
  const daysStyle: MonthGridStyle = { "--month-weeks": weeks.length };

  return (
    <div className="flex flex-col gap-1">
      <div className={MONTH_GRID_CLASS.columns}>
        {order.map((weekday) => (
          <span className={MONTH_GRID_CLASS.weekday} key={weekday}>
            {weekdayLabel({ locale, weekday, width: "short" })}
          </span>
        ))}
      </div>
      <div className={cn(MONTH_GRID_CLASS.columns, MONTH_GRID_CLASS.days)} style={daysStyle}>
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

function DayNumber({ date, isToday, tone }: { date: string; isToday: boolean; tone: DayTone }) {
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

function dayTone(day: StatisticsCalendarDay): DayTone {
  if (day.booksPreview.length > 0) return "poster";
  if (day.booksCount > 0 || day.pagesRead > 0) return "reading";
  return isUnknownCalendarDay(day) ? "unknown" : "empty";
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
  const tone = dayTone(day);
  const summary = t("daySummary", { books: day.booksCount, date, pages: day.pagesRead });
  const cellClass = cn(MONTH_GRID_CLASS.cell, MONTH_GRID_CLASS.tone[tone]);
  const current = isToday ? "date" : undefined;

  const body = (
    <>
      <ReadingBooksMonthCellCovers day={day} />
      {tone === "reading" && day.booksCount > 0 ? (
        <span className={MONTH_GRID_CLASS.shelfMark}>
          <UiIcon name="book" size={16} />
        </span>
      ) : null}
      <DayNumber date={day.date} isToday={isToday} tone={tone} />
      {day.pagesRead > 0 ? (
        <span className={MONTH_GRID_CLASS.pages}>
          <span className={MONTH_GRID_CLASS.pagesBadge}>
            {t("pagesShort", { pages: day.pagesRead })}
          </span>
        </span>
      ) : null}
    </>
  );

  if (toSelectableCalendarDay(day) === null) {
    return (
      <span aria-current={current} className={cellClass}>
        <span className="sr-only">
          {tone === "poster" || tone === "reading"
            ? summary
            : tone === "unknown"
              ? t("dayUnknown", { date })
              : t("dayEmpty", { date })}
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
      aria-current={current}
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
      <span aria-hidden className="contents">
        {body}
      </span>
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
  const tone: DayTone = kind === "future" ? "future" : "unknown";

  return (
    <span
      aria-current={isToday ? "date" : undefined}
      className={cn(MONTH_GRID_CLASS.cell, MONTH_GRID_CLASS.tone[tone])}
    >
      <span className="sr-only">
        {kind === "future"
          ? t("dayFuture", { date: longDate })
          : t("dayUnknown", { date: longDate })}
      </span>
      <span aria-hidden className="contents">
        <DayNumber date={date} isToday={isToday} tone={tone} />
      </span>
    </span>
  );
}
