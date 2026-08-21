import type { BookOrderStatisticsDay, CurrencyTotal, Nullable } from "@app/shared";

import {
  eachDayOfInterval,
  endOfWeek,
  format,
  getDate,
  getYear,
  isAfter,
  parseISO,
  startOfWeek,
} from "date-fns";

import { STATISTICS_PERIOD } from "./statistics-period";

export const CALENDAR_METRICS = ["orders", "books"] as const;

export type CalendarMetric = (typeof CALENDAR_METRICS)[number];

export const CALENDAR = {
  levels: 4,
  weekStartsOn: 1,
} as const;

export type CalendarCell = {
  booksCount: number;
  date: string;
  level: number;
  ordersCount: number;
  totalsByCurrency: CurrencyTotal[];
  value: number;
};

export type CalendarGrid = {
  monthLabels: CalendarMonthLabel[];
  peak: number;
  weeks: Nullable<CalendarCell>[][];
};

export type CalendarMonthLabel = {
  monthStart: string;
  weekIndex: number;
};

export function calendarGrid({
  daily,
  metric,
  today,
  year,
}: {
  daily: readonly BookOrderStatisticsDay[];
  metric: CalendarMetric;
  today: string;
  year: number;
}): CalendarGrid {
  const byDate = new Map(daily.map((day) => [day.date, day]));
  const yearDays = daily.filter((day) => getYear(parseISO(day.date)) === year);
  const peak = Math.max(...yearDays.map((day) => cellValue(day, metric)), 0);

  const start = startOfWeek(parseISO(`${year}-01-01`), { weekStartsOn: CALENDAR.weekStartsOn });
  const end = endOfWeek(parseISO(`${year}-12-31`), { weekStartsOn: CALENDAR.weekStartsOn });
  const todayDate = parseISO(today);

  const weeks: Nullable<CalendarCell>[][] = [];
  const monthLabels: CalendarMonthLabel[] = [];
  let week: Nullable<CalendarCell>[] = [];

  for (const date of eachDayOfInterval({ end, start })) {
    const iso = format(date, STATISTICS_PERIOD.isoDayFormat);
    const isOutside = getYear(date) !== year || isAfter(date, todayDate);
    week.push(isOutside ? null : toCell({ day: byDate.get(iso), iso, metric, peak }));

    if (getYear(date) === year && getDate(date) === 1) {
      monthLabels.push({ monthStart: iso, weekIndex: weeks.length });
    }

    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  if (week.length > 0) weeks.push(week);

  return { monthLabels, peak, weeks };
}

export function calendarYears(daily: readonly BookOrderStatisticsDay[]): number[] {
  const years = new Set(daily.map((day) => getYear(parseISO(day.date))));
  return [...years].sort((left, right) => right - left);
}

function cellValue(day: BookOrderStatisticsDay, metric: CalendarMetric): number {
  return metric === "books" ? day.booksCount : day.ordersCount;
}

function toCell({
  day,
  iso,
  metric,
  peak,
}: {
  day: BookOrderStatisticsDay | undefined;
  iso: string;
  metric: CalendarMetric;
  peak: number;
}): CalendarCell {
  if (day === undefined) {
    return { booksCount: 0, date: iso, level: 0, ordersCount: 0, totalsByCurrency: [], value: 0 };
  }

  const value = cellValue(day, metric);

  return {
    booksCount: day.booksCount,
    date: iso,
    level: toLevel({ peak, value }),
    ordersCount: day.ordersCount,
    totalsByCurrency: day.totalsByCurrency,
    value,
  };
}

function toLevel({ peak, value }: { peak: number; value: number }): number {
  if (value <= 0 || peak <= 0) return 0;
  return Math.max(1, Math.ceil((value / peak) * CALENDAR.levels));
}
