import type { ReadingStatisticsDateRange } from "@app/shared";

import { addMonths, format, startOfQuarter } from "date-fns";

import { parseIsoDay } from "@/lib/format";

import { listCalendarMonths } from "./statistics-calendar";

const QUARTER = { keyFormat: "yyyy-MM", months: 3 } as const;

export function listCalendarQuarters(range: ReadingStatisticsDateRange): string[] {
  return [...new Set(listCalendarMonths(range).map(quarterOfMonth))];
}

export function listQuarterMonths(quarterKey: string): string[] {
  const start = parseIsoDay(`${quarterKey}-01`);
  return Array.from({ length: QUARTER.months }, (_unused, index) =>
    format(addMonths(start, index), QUARTER.keyFormat),
  );
}

export function quarterOfMonth(monthKey: string): string {
  return format(startOfQuarter(parseIsoDay(`${monthKey}-01`)), QUARTER.keyFormat);
}

export function resolveCalendarQuarter({
  quarters,
  requested,
}: {
  quarters: readonly string[];
  requested: string;
}): string {
  if (quarters.includes(requested)) return requested;
  return quarters.at(-1) ?? requested;
}
