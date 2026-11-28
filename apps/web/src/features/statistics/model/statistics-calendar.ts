import type {
  Nullable,
  ReadingStatisticsDateRange,
  StatisticsCalendarDay,
  WeekStartDay,
} from "@app/shared";

import { WEEK_STARTS_ON } from "@app/shared";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  getDay,
  getDaysInMonth,
  isAfter,
  max,
  min,
  startOfMonth,
} from "date-fns";

import { parseIsoDay } from "@/lib/format";

import { isBeforeAccountStart } from "./statistics-account-history";
import { resolveReadingDayTarget } from "./statistics-drilldown";

const ISO_DAY_FORMAT = "yyyy-MM-dd";

const ISO_MONTH_FORMAT = "yyyy-MM";

const DAYS_IN_WEEK = 7;

export type CalendarMonthSlot =
  | { date: string; kind: CalendarUnrecordedSlotKind }
  | { day: StatisticsCalendarDay; kind: "day" }
  | { kind: "blank" };

export type CalendarMonthSummary = {
  activeDays: number;
  books: { count: number; isLowerBound: boolean };
  hasLegacyHistory: boolean;
  hasUnknownDays: boolean;
  pagesRead: number;
};

export type CalendarUnrecordedSlotKind = "before_account" | "future" | "missing";

export type SelectableCalendarDay = { date: string; detailDate: string };

type CalendarWeek = Nullable<StatisticsCalendarDay>[];

export function buildMonthGrid({
  days,
  monthKey,
  weekStartDay,
}: {
  days: readonly StatisticsCalendarDay[];
  monthKey: string;
  weekStartDay: WeekStartDay;
}): CalendarWeek[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const monthStart = startOfMonth(parseIsoDay(`${monthKey}-01`));
  const monthEnd = endOfMonth(monthStart);
  const weeks: CalendarWeek[] = [];

  let current: CalendarWeek = padLeadingCells({
    date: format(monthStart, ISO_DAY_FORMAT),
    weekStartDay,
  });

  for (const date of enumerateDays({
    from: format(monthStart, ISO_DAY_FORMAT),
    to: format(monthEnd, ISO_DAY_FORMAT),
  })) {
    current.push(byDate.get(date) ?? null);
    if (current.length === DAYS_IN_WEEK) {
      weeks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    weeks.push(padTrailingCells(current));
  }

  return weeks;
}

export function buildMonthSlots({
  accountStart,
  days,
  monthKey,
  today,
  weekStartDay,
}: {
  accountStart: Nullable<string>;
  days: readonly StatisticsCalendarDay[];
  monthKey: string;
  today: string;
  weekStartDay: WeekStartDay;
}): CalendarMonthSlot[][] {
  const monthStart = parseIsoDay(`${monthKey}-01`);
  const leadingSlots = weekdayColumn({ date: format(monthStart, ISO_DAY_FORMAT), weekStartDay });
  const monthLength = getDaysInMonth(monthStart);
  const todayDate = parseIsoDay(today);

  return buildMonthGrid({ days, monthKey, weekStartDay }).map((week, weekIndex) =>
    week.map((day, weekdayIndex): CalendarMonthSlot => {
      if (day !== null) {
        return isUnreadDay(day) && isBeforeAccountStart({ accountStart, date: day.date })
          ? { date: day.date, kind: "before_account" }
          : { day, kind: "day" };
      }
      const dayOffset = weekIndex * DAYS_IN_WEEK + weekdayIndex - leadingSlots;
      if (dayOffset < 0 || dayOffset >= monthLength) return { kind: "blank" };
      const date = format(addDays(monthStart, dayOffset), ISO_DAY_FORMAT);
      return { date, kind: unrecordedSlotKind({ accountStart, date, todayDate }) };
    }),
  );
}

export function clipCalendarMonth({
  monthKey,
  range,
}: {
  monthKey: string;
  range: ReadingStatisticsDateRange;
}): ReadingStatisticsDateRange {
  const monthStart = startOfMonth(parseIsoDay(`${monthKey}-01`));

  return {
    from: format(max([monthStart, parseIsoDay(range.from)]), ISO_DAY_FORMAT),
    to: format(min([endOfMonth(monthStart), parseIsoDay(range.to)]), ISO_DAY_FORMAT),
  };
}

export function hasDaysBeforeAccountStart({
  accountStart,
  days,
}: {
  accountStart: Nullable<string>;
  days: readonly StatisticsCalendarDay[];
}): boolean {
  return days.some(
    (day) => isUnreadDay(day) && isBeforeAccountStart({ accountStart, date: day.date }),
  );
}

export function isDateInMonth(date: string, monthKey: string): boolean {
  return date.startsWith(monthKey);
}

export function isUnknownCalendarDay(day: StatisticsCalendarDay): boolean {
  return day.pagesRead === 0 && day.historyQuality === "legacy_observed_only";
}

export function listCalendarMonths({ from, to }: { from: string; to: string }): string[] {
  const months: string[] = [];
  let cursor = startOfMonth(parseIsoDay(from));
  const last = startOfMonth(parseIsoDay(to));

  while (format(cursor, ISO_MONTH_FORMAT) <= format(last, ISO_MONTH_FORMAT)) {
    months.push(format(cursor, ISO_MONTH_FORMAT));
    cursor = addMonths(cursor, 1);
  }

  return months;
}

export function resolveCalendarMonth({
  months,
  requested,
}: {
  months: readonly string[];
  requested: Nullable<string>;
}): Nullable<string> {
  if (requested !== null && months.includes(requested)) return requested;
  return months.at(-1) ?? null;
}

export function resolveSelectedCalendarDay({
  days,
  requested,
}: {
  days: readonly StatisticsCalendarDay[];
  requested: Nullable<string>;
}): Nullable<SelectableCalendarDay> {
  const selectable = days.flatMap((day) => toSelectableCalendarDay(day) ?? []);
  const requestedDay = selectable.find((day) => day.date === requested);
  if (requestedDay !== undefined) return requestedDay;
  return selectable.reduce<Nullable<SelectableCalendarDay>>(
    (latest, day) =>
      latest === null || isAfter(parseIsoDay(day.date), parseIsoDay(latest.date)) ? day : latest,
    null,
  );
}

export function summarizeCalendarMonth(
  days: readonly StatisticsCalendarDay[],
): CalendarMonthSummary {
  const activeDays = days.filter((day) => day.pagesRead > 0);
  const bookIds = new Set(activeDays.flatMap((day) => day.booksPreview.map((book) => book.bookId)));

  return {
    activeDays: activeDays.length,
    books: {
      count: bookIds.size,
      isLowerBound: activeDays.some((day) => day.remainingBooksCount > 0),
    },
    hasLegacyHistory: days.some((day) => day.historyQuality === "legacy_observed_only"),
    hasUnknownDays: days.some(isUnknownCalendarDay),
    pagesRead: activeDays.reduce((total, day) => total + day.pagesRead, 0),
  };
}

export function toSelectableCalendarDay(
  day: StatisticsCalendarDay,
): Nullable<SelectableCalendarDay> {
  if (day.booksCount === 0) return null;
  const detailDate = resolveReadingDayTarget(day.drilldown);
  return detailDate === null ? null : { date: day.date, detailDate };
}

export function weekdayOrder(weekStartDay: WeekStartDay): number[] {
  const start = WEEK_STARTS_ON[weekStartDay];
  return Array.from({ length: DAYS_IN_WEEK }, (_unused, index) => (start + index) % DAYS_IN_WEEK);
}

function enumerateDays({ from, to }: { from: string; to: string }): string[] {
  const days: string[] = [];
  let cursor = parseIsoDay(from);

  while (format(cursor, ISO_DAY_FORMAT) <= to) {
    days.push(format(cursor, ISO_DAY_FORMAT));
    cursor = addDays(cursor, 1);
  }

  return days;
}

function isUnreadDay(day: StatisticsCalendarDay): boolean {
  return day.pagesRead === 0 && day.booksCount === 0;
}

function padLeadingCells({
  date,
  weekStartDay,
}: {
  date: string;
  weekStartDay: WeekStartDay;
}): CalendarWeek {
  return Array.from({ length: weekdayColumn({ date, weekStartDay }) }, () => null);
}

function padTrailingCells(week: CalendarWeek): CalendarWeek {
  return [...week, ...Array.from({ length: DAYS_IN_WEEK - week.length }, () => null)];
}

function unrecordedSlotKind({
  accountStart,
  date,
  todayDate,
}: {
  accountStart: Nullable<string>;
  date: string;
  todayDate: Date;
}): CalendarUnrecordedSlotKind {
  if (isAfter(parseIsoDay(date), todayDate)) return "future";
  return isBeforeAccountStart({ accountStart, date }) ? "before_account" : "missing";
}

function weekdayColumn({
  date,
  weekStartDay,
}: {
  date: string;
  weekStartDay: WeekStartDay;
}): number {
  return (getDay(parseIsoDay(date)) - WEEK_STARTS_ON[weekStartDay] + DAYS_IN_WEEK) % DAYS_IN_WEEK;
}
