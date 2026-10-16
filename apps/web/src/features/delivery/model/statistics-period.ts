import type { BookOrderStatisticsCompareMode, Nullable } from "@app/shared";

import {
  addDays,
  endOfMonth,
  parseISO,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";

import { dateToIsoDay, isoDayToDate } from "@/lib/iso-day";

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
  earliestCustomDay: "1900-01-01",
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
  return isoDayToDate(value) !== undefined;
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
      return { from: null, to: null };
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
      return { from: dateToIsoDay(subDays(now, STATISTICS_PERIOD.rollingDays - 1)), to: today };
    case "last_month": {
      const previousMonth = subMonths(now, 1);
      return {
        from: dateToIsoDay(startOfMonth(previousMonth)),
        to: dateToIsoDay(endOfMonth(previousMonth)),
      };
    }
    case "this_month":
      return { from: dateToIsoDay(startOfMonth(now)), to: today };
    case "this_year":
      return { from: dateToIsoDay(startOfYear(now)), to: today };
  }
}

export function todayIsoDay(): string {
  return dateToIsoDay(new Date());
}

function rollingStart(now: Date, months: number): string {
  return dateToIsoDay(addDays(subMonths(now, months), 1));
}
