import type { Nullable } from "@app/shared";

import { parseISO } from "date-fns";

const PERCENT_FORMAT = { maximumFractionDigits: 1 } as const;

const DAY_RANGE_FORMAT = { day: "numeric", month: "long", year: "numeric" } as const;

export function formatDayLong(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, DAY_RANGE_FORMAT).format(parseISO(day));
}

export function formatPercentValue(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, PERCENT_FORMAT).format(value)}%`;
}

export function formatPeriodRange({
  from,
  locale,
  to,
}: {
  from: Nullable<string>;
  locale: string;
  to: Nullable<string>;
}): Nullable<string> {
  if (to === null) return null;
  if (from === null) return null;
  if (from === to) return formatDayLong(from, locale);

  return new Intl.DateTimeFormat(locale, DAY_RANGE_FORMAT).formatRange(
    parseISO(from),
    parseISO(to),
  );
}
