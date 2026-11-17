import type { Nullable } from "@app/shared";

import { addDays } from "date-fns";

import { formatNumber, parseIsoDay } from "@/lib/format";

const DAY_LONG = { day: "numeric", month: "long", year: "numeric" } as const;

const DAY_NUMERIC = { day: "numeric", month: "numeric" } as const;

const DAY_SHORT = { day: "numeric", month: "short" } as const;

const MONTH_LONG = { month: "long", year: "numeric" } as const;

const MONTH_NARROW = { month: "narrow" } as const;

const MONTH_SHORT = { month: "short" } as const;

const RATING_FRACTION = { maximumFractionDigits: 1, minimumFractionDigits: 1 } as const;

const SHARE_FRACTION = { maximumFractionDigits: 1 } as const;

const WEEKDAY_ANCHOR_SUNDAY = "2026-01-04";

export function formatDayLong(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, DAY_LONG).format(parseIsoDay(day));
}

export function formatDayNumeric(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, DAY_NUMERIC).format(parseIsoDay(day));
}

export function formatDayRange({
  from,
  locale,
  to,
}: {
  from: Nullable<string>;
  locale: string;
  to: string;
}): Nullable<string> {
  if (from === null) return null;
  if (from === to) return formatDayLong(from, locale);
  return new Intl.DateTimeFormat(locale, DAY_LONG).formatRange(parseIsoDay(from), parseIsoDay(to));
}

export function formatDayShort(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, DAY_SHORT).format(parseIsoDay(day));
}

export function formatMonthKey(monthKey: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, MONTH_LONG).format(parseIsoDay(`${monthKey}-01`));
}

export function formatMonthNarrow(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, MONTH_NARROW).format(parseIsoDay(day));
}

export function formatMonthShort(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, MONTH_SHORT).format(parseIsoDay(day));
}

export function formatPercentagePoints(value: number, locale: string): string {
  return formatNumber(Math.abs(value), locale, SHARE_FRACTION);
}

export function formatRatingScore(value: number, locale: string): string {
  return formatNumber(value, locale, RATING_FRACTION);
}

export function formatShare(ratio: number, locale: string): string {
  return formatNumber(ratio * 100, locale, SHARE_FRACTION);
}

export function isZeroAtPercentPrecision(percent: number): boolean {
  return roundsToZero({ fraction: SHARE_FRACTION, value: percent });
}

export function isZeroAtRatingPrecision(score: number): boolean {
  return roundsToZero({ fraction: RATING_FRACTION, value: score });
}

export function weekdayLabel({
  locale,
  weekday,
  width = "long",
}: {
  locale: string;
  weekday: number;
  width?: "long" | "narrow" | "short";
}): string {
  return new Intl.DateTimeFormat(locale, { weekday: width }).format(
    addDays(parseIsoDay(WEEKDAY_ANCHOR_SUNDAY), weekday),
  );
}

function roundsToZero({
  fraction,
  value,
}: {
  fraction: { maximumFractionDigits: number };
  value: number;
}): boolean {
  return Math.round(Math.abs(value) * 10 ** fraction.maximumFractionDigits) === 0;
}
