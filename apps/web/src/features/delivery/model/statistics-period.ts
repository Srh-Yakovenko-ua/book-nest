import type { BookOrderStatisticsCompareMode, Nullable } from "@app/shared";

import {
  addDays,
  endOfMonth,
  format,
  isValid,
  parse,
  parseISO,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";

export const STATISTICS_PERIOD_PRESETS = [
  "this_month",
  "last_month",
  "last_30_days",
  "last_3_months",
  "last_12_months",
  "this_year",
  "all_time",
  "custom",
] as const;

export type StatisticsPeriodPreset = (typeof STATISTICS_PERIOD_PRESETS)[number];

export const STATISTICS_PERIOD = {
  defaultPreset: "this_year",
  isoDayFormat: "yyyy-MM-dd",
  rollingDays: 30,
  rollingMonthsLong: 12,
  rollingMonthsShort: 3,
} as const satisfies Record<string, number | string> & { defaultPreset: StatisticsPeriodPreset };

export type StatisticsCustomRange = {
  from: string;
  to: string;
};

export type StatisticsPeriodRange = {
  from: Nullable<string>;
  to: Nullable<string>;
};

export function canCompareStatisticsPeriod(range: StatisticsPeriodRange): boolean {
  return range.from !== null && range.to !== null;
}

export function defaultStatisticsCompareMode(
  preset: StatisticsPeriodPreset,
): BookOrderStatisticsCompareMode {
  return preset === "this_year" ? "same_period_last_year" : "previous_period";
}

export function isStatisticsDay(value: string): boolean {
  return value !== "" && isValid(parse(value, STATISTICS_PERIOD.isoDayFormat, new Date()));
}

export function resolveStatisticsPeriod({
  custom,
  preset,
  today,
}: {
  custom: StatisticsCustomRange;
  preset: StatisticsPeriodPreset;
  today: string;
}): StatisticsPeriodRange {
  const now = parseISO(today);

  switch (preset) {
    case "all_time":
      return { from: null, to: today };
    case "custom":
      return {
        from: isStatisticsDay(custom.from) ? custom.from : null,
        to: isStatisticsDay(custom.to) ? custom.to : null,
      };
    case "last_3_months":
      return { from: rollingStart(now, STATISTICS_PERIOD.rollingMonthsShort), to: today };
    case "last_12_months":
      return { from: rollingStart(now, STATISTICS_PERIOD.rollingMonthsLong), to: today };
    case "last_30_days":
      return { from: toIsoDay(subDays(now, STATISTICS_PERIOD.rollingDays - 1)), to: today };
    case "last_month": {
      const previousMonth = subMonths(now, 1);
      return {
        from: toIsoDay(startOfMonth(previousMonth)),
        to: toIsoDay(endOfMonth(previousMonth)),
      };
    }
    case "this_month":
      return { from: toIsoDay(startOfMonth(now)), to: today };
    case "this_year":
      return { from: toIsoDay(startOfYear(now)), to: today };
  }
}

export function todayIsoDay(): string {
  return toIsoDay(new Date());
}

function rollingStart(now: Date, months: number): string {
  return toIsoDay(addDays(subMonths(now, months), 1));
}

function toIsoDay(date: Date): string {
  return format(date, STATISTICS_PERIOD.isoDayFormat);
}
