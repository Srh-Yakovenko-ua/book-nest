import type { BookOrderStatisticsMonth, Currency, Nullable } from "@app/shared";

import { eachMonthOfInterval, format, isAfter, parse, parseISO } from "date-fns";

import { currencyTotalOf } from "./statistics-currency";

export const DYNAMICS_METRICS = ["spend", "orders", "books"] as const;

export type DynamicsMetric = (typeof DYNAMICS_METRICS)[number];

export type DynamicsPoint = {
  comparisonMonth: Nullable<string>;
  comparisonValue: Nullable<number>;
  month: string;
  value: number;
};

const MONTH_KEY_FORMAT = "yyyy-MM";

export function isMoneyMetric(metric: DynamicsMetric): boolean {
  return metric === "spend";
}

export function monthlyPoints({
  comparisonMonths,
  currency,
  metric,
  months,
  range,
}: {
  comparisonMonths: Nullable<readonly BookOrderStatisticsMonth[]>;
  currency: Currency;
  metric: DynamicsMetric;
  months: readonly BookOrderStatisticsMonth[];
  range: { from: Nullable<string>; to: Nullable<string> };
}): DynamicsPoint[] {
  const keys = denseMonthKeys({ months, range });
  const byMonth = new Map(months.map((month) => [month.month, month]));
  const comparisonKeys =
    comparisonMonths === null
      ? []
      : denseMonthKeys({ months: comparisonMonths, range: EMPTY_RANGE });
  const comparisonByMonth = new Map((comparisonMonths ?? []).map((month) => [month.month, month]));
  const offset = keys.length - comparisonKeys.length;

  return keys.map((month, index) => {
    const comparisonMonth = comparisonKeys[index - Math.max(offset, 0)] ?? null;
    return {
      comparisonMonth,
      comparisonValue:
        comparisonMonth === null
          ? null
          : metricValue({ currency, metric, month: comparisonByMonth.get(comparisonMonth) }),
      month,
      value: metricValue({ currency, metric, month: byMonth.get(month) }),
    };
  });
}

const EMPTY_RANGE = { from: null, to: null };

export function monthLabel(monthKey: string, locale: string, long: boolean): string {
  return new Intl.DateTimeFormat(locale, {
    month: long ? "long" : "short",
    year: "numeric",
  }).format(parseISO(`${monthKey}-01`));
}

function denseMonthKeys({
  months,
  range,
}: {
  months: readonly BookOrderStatisticsMonth[];
  range: { from: Nullable<string>; to: Nullable<string> };
}): string[] {
  const present = months.map((month) => month.month).sort();
  const first = range.from === null ? present[0] : range.from.slice(0, MONTH_KEY_FORMAT.length);
  const last = range.to === null ? present.at(-1) : range.to.slice(0, MONTH_KEY_FORMAT.length);
  if (first === undefined || last === undefined) return present;

  const start = monthDate(first);
  const end = monthDate(last);
  if (isAfter(start, end)) return present;

  return eachMonthOfInterval({ end, start }).map((date) => format(date, MONTH_KEY_FORMAT));
}

function metricValue({
  currency,
  metric,
  month,
}: {
  currency: Currency;
  metric: DynamicsMetric;
  month: BookOrderStatisticsMonth | undefined;
}): number {
  if (month === undefined) return 0;
  if (metric === "books") return month.booksCount;
  if (metric === "orders") return month.ordersCount;
  return currencyTotalOf(month.totalsByCurrency, currency) ?? 0;
}

function monthDate(monthKey: string): Date {
  return parse(monthKey, MONTH_KEY_FORMAT, new Date());
}
