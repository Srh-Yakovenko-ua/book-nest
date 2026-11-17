import type { Nullable } from "@app/shared";

import { READING_CALENDAR_PAGE_BOUNDS } from "@app/shared";
import { endOfYear, format, getYear, parseISO } from "date-fns";
import { parseAsString } from "nuqs/server";
import { z } from "zod";

export const READING_CALENDAR_PAGE = {
  monthFormat: "yyyy-MM",
  monthPattern: /^\d{4}-(0[1-9]|1[0-2])$/,
  path: "/reading-calendar",
  yearPattern: /^\d{4}$/,
} as const;

export const readingCalendarParsers = {
  month: parseAsString,
  year: parseAsString,
};

export function defaultReadingCalendarMonth({
  today,
  year,
}: {
  today: string;
  year: number;
}): string {
  if (year === readingCalendarCurrentYear(today)) return toMonthKey(today);
  return format(endOfYear(parseISO(String(year))), READING_CALENDAR_PAGE.monthFormat);
}

export function parseReadingCalendarMonth({
  today,
  value,
  year,
}: {
  today: string;
  value: string;
  year: number;
}): Nullable<string> {
  const result = z
    .string()
    .regex(READING_CALENDAR_PAGE.monthPattern)
    .refine((month) => getYear(parseISO(month)) === year && month <= toMonthKey(today))
    .safeParse(value);
  return result.success ? result.data : null;
}

export function parseReadingCalendarYear({
  currentYear,
  value,
}: {
  currentYear: number;
  value: string;
}): Nullable<number> {
  const result = z
    .string()
    .regex(READING_CALENDAR_PAGE.yearPattern)
    .transform(Number)
    .pipe(z.number().int().min(READING_CALENDAR_PAGE_BOUNDS.earliestYear).max(currentYear))
    .safeParse(value);
  return result.success ? result.data : null;
}

export function readingCalendarCurrentYear(today: string): number {
  return getYear(parseISO(today));
}

function toMonthKey(isoDay: string): string {
  return format(parseISO(isoDay), READING_CALENDAR_PAGE.monthFormat);
}
