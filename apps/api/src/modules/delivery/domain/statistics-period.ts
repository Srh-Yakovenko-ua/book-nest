import type {
  BookOrderStatisticsCompareMode,
  Nullable,
  StatisticsComparisonPeriod,
  StatisticsPeriod,
} from "@app/shared";

import { BookOrderStatisticsCompareModeSchema } from "@app/shared";
import {
  compareAsc,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subMonths,
  subYears,
} from "date-fns";

import { assertNever } from "../../../core/assert-never.js";
import { addDaysToIsoDate, daysBetweenIsoDates, toIsoDate } from "../../../core/iso-date.js";

const COMPARE_MODE = BookOrderStatisticsCompareModeSchema.enum;

const STATISTICS_PERIOD = Object.freeze({
  isoDayFormat: "yyyy-MM-dd",
  monthsBack: 1,
  yearsBack: 1,
});

export type RequestedStatisticsPeriod = {
  from: string | undefined;
  to: string | undefined;
};

export type ResolvedStatisticsPeriods = {
  comparisonPeriod: Nullable<StatisticsComparisonPeriod>;
  currentPeriod: StatisticsPeriod;
  requestedPeriod: RequestedStatisticsPeriod;
};

type BoundedPeriod = {
  from: string;
  to: string;
};

export function resolveStatisticsPeriods({
  compare,
  from,
  now,
  to,
}: {
  compare?: BookOrderStatisticsCompareMode;
  from?: string;
  now: Date;
  to?: string;
}): ResolvedStatisticsPeriods {
  const today = toIsoDate(now);
  const currentPeriod: StatisticsPeriod = { from: from ?? null, to: to ?? today };
  const requestedPeriod: RequestedStatisticsPeriod = { from, to };

  if (compare === undefined) {
    return { comparisonPeriod: null, currentPeriod, requestedPeriod };
  }

  const boundedPeriod = toBoundedPeriod(currentPeriod);
  if (boundedPeriod === null) {
    return { comparisonPeriod: null, currentPeriod, requestedPeriod };
  }

  const shifted = shiftForCompareMode({ mode: compare, period: boundedPeriod, today });

  return {
    comparisonPeriod: { from: shifted.from, mode: compare, to: shifted.to },
    currentPeriod,
    requestedPeriod,
  };
}

function endOfIsoMonth(isoDay: string): string {
  return toIsoDayString(endOfMonth(parseISO(isoDay)));
}

function isCurrentMonthToDate({
  period,
  today,
}: {
  period: BoundedPeriod;
  today: string;
}): boolean {
  return (
    period.from === startOfIsoMonth(today) && isOnOrBefore({ candidate: period.to, limit: today })
  );
}

function isFullCalendarMonth({ from, to }: BoundedPeriod): boolean {
  return from === startOfIsoMonth(from) && to === endOfIsoMonth(from);
}

function isOnOrBefore({ candidate, limit }: { candidate: string; limit: string }): boolean {
  return compareAsc(parseISO(candidate), parseISO(limit)) <= 0;
}

function precedingCalendarMonth({ from }: BoundedPeriod): BoundedPeriod {
  const dayInPrecedingMonth = previousMonthSameDay(from);
  return { from: startOfIsoMonth(dayInPrecedingMonth), to: endOfIsoMonth(dayInPrecedingMonth) };
}

function precedingMonthToSameDay({ from, to }: BoundedPeriod): BoundedPeriod {
  return { from: previousMonthSameDay(from), to: previousMonthSameDay(to) };
}

function precedingRangeOfEqualLength({ from, to }: BoundedPeriod): BoundedPeriod {
  const inclusiveDays = daysBetweenIsoDates({ endIsoDate: to, startIsoDate: from }) + 1;
  return { from: addDaysToIsoDate(from, -inclusiveDays), to: addDaysToIsoDate(from, -1) };
}

function previousMonthSameDay(isoDay: string): string {
  return toIsoDayString(subMonths(parseISO(isoDay), STATISTICS_PERIOD.monthsBack));
}

function previousPeriod({
  period,
  today,
}: {
  period: BoundedPeriod;
  today: string;
}): BoundedPeriod {
  if (isFullCalendarMonth(period)) {
    return precedingCalendarMonth(period);
  }

  if (isCurrentMonthToDate({ period, today })) {
    return precedingMonthToSameDay(period);
  }

  return precedingRangeOfEqualLength(period);
}

function previousYearSameDay(isoDay: string): string {
  return toIsoDayString(subYears(parseISO(isoDay), STATISTICS_PERIOD.yearsBack));
}

function samePeriodLastYear({ from, to }: BoundedPeriod): BoundedPeriod {
  return { from: previousYearSameDay(from), to: previousYearSameDay(to) };
}

function shiftForCompareMode({
  mode,
  period,
  today,
}: {
  mode: BookOrderStatisticsCompareMode;
  period: BoundedPeriod;
  today: string;
}): BoundedPeriod {
  switch (mode) {
    case COMPARE_MODE.previous_period:
      return previousPeriod({ period, today });
    case COMPARE_MODE.same_period_last_year:
      return samePeriodLastYear(period);
    default:
      return assertNever(mode);
  }
}

function startOfIsoMonth(isoDay: string): string {
  return toIsoDayString(startOfMonth(parseISO(isoDay)));
}

function toBoundedPeriod({ from, to }: StatisticsPeriod): Nullable<BoundedPeriod> {
  if (from === null || to === null) {
    return null;
  }

  return { from, to };
}

function toIsoDayString(date: Date): string {
  return format(date, STATISTICS_PERIOD.isoDayFormat);
}
