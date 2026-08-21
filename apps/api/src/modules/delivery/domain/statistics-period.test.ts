import type {
  BookOrderStatisticsCompareMode,
  Nullable,
  StatisticsComparisonPeriod,
  StatisticsPeriod,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import { daysBetweenIsoDates } from "../../../core/iso-date.js";
import { resolveStatisticsPeriods } from "./statistics-period.js";

type PeriodCase = {
  compare?: BookOrderStatisticsCompareMode;
  expectedComparison: Nullable<StatisticsComparisonPeriod>;
  expectedCurrent: StatisticsPeriod;
  from?: string;
  name: string;
  now: Date;
  to?: string;
};

type PeriodInput = Parameters<typeof resolveStatisticsPeriods>[0];

const AUGUST_20_2026 = new Date("2026-08-20T10:15:00.000Z");
const MARCH_30_2026 = new Date("2026-03-30T06:00:00.000Z");
const LEAP_DAY_2024 = new Date("2024-02-29T08:00:00.000Z");
const FEBRUARY_28_2025 = new Date("2025-02-28T08:00:00.000Z");
const LAST_UTC_INSTANT_OF_AUGUST_20_2026 = new Date("2026-08-20T23:59:59.999Z");

const PERIOD_CASES: PeriodCase[] = [
  {
    compare: "previous_period",
    expectedComparison: { from: "2026-07-01", mode: "previous_period", to: "2026-07-20" },
    expectedCurrent: { from: "2026-08-01", to: "2026-08-20" },
    from: "2026-08-01",
    name: "a partial current month compares against the same slice of the previous month",
    now: AUGUST_20_2026,
    to: "2026-08-20",
  },
  {
    compare: "previous_period",
    expectedComparison: { from: "2026-06-01", mode: "previous_period", to: "2026-06-30" },
    expectedCurrent: { from: "2026-07-01", to: "2026-07-31" },
    from: "2026-07-01",
    name: "a full calendar month compares against the whole preceding calendar month",
    now: AUGUST_20_2026,
    to: "2026-07-31",
  },
  {
    compare: "previous_period",
    expectedComparison: { from: "2026-02-01", mode: "previous_period", to: "2026-02-28" },
    expectedCurrent: { from: "2026-03-01", to: "2026-03-30" },
    from: "2026-03-01",
    name: "a month-to-date window clamps to the last day of a shorter previous month",
    now: MARCH_30_2026,
    to: "2026-03-30",
  },
  {
    compare: "previous_period",
    expectedComparison: { from: "2026-06-22", mode: "previous_period", to: "2026-07-21" },
    expectedCurrent: { from: "2026-07-22", to: "2026-08-20" },
    from: "2026-07-22",
    name: "a rolling thirty-day window compares against the thirty days before it",
    now: AUGUST_20_2026,
    to: "2026-08-20",
  },
  {
    compare: "previous_period",
    expectedComparison: { from: "2026-02-18", mode: "previous_period", to: "2026-05-20" },
    expectedCurrent: { from: "2026-05-21", to: "2026-08-20" },
    from: "2026-05-21",
    name: "a rolling three-month window compares against an equally long window before it",
    now: AUGUST_20_2026,
    to: "2026-08-20",
  },
  {
    compare: "previous_period",
    expectedComparison: { from: "2025-05-14", mode: "previous_period", to: "2025-12-31" },
    expectedCurrent: { from: "2026-01-01", to: "2026-08-20" },
    from: "2026-01-01",
    name: "a year-to-date range falls back to an equally long window instead of guessing a preset",
    now: AUGUST_20_2026,
    to: "2026-08-20",
  },
  {
    compare: "previous_period",
    expectedComparison: { from: "2026-07-20", mode: "previous_period", to: "2026-08-04" },
    expectedCurrent: { from: "2026-08-05", to: "2026-08-20" },
    from: "2026-08-05",
    name: "a custom range inside one month compares against the equally long window before it",
    now: AUGUST_20_2026,
    to: "2026-08-20",
  },
  {
    compare: "previous_period",
    expectedComparison: { from: "2026-08-19", mode: "previous_period", to: "2026-08-19" },
    expectedCurrent: { from: "2026-08-20", to: "2026-08-20" },
    from: "2026-08-20",
    name: "a single day compares against the single day before it, which may hold nothing at all",
    now: AUGUST_20_2026,
    to: "2026-08-20",
  },
  {
    compare: "previous_period",
    expectedComparison: { from: "2024-01-01", mode: "previous_period", to: "2024-01-31" },
    expectedCurrent: { from: "2024-02-01", to: "2024-02-29" },
    from: "2024-02-01",
    name: "a full leap February compares against the whole of January",
    now: LEAP_DAY_2024,
    to: "2024-02-29",
  },
  {
    compare: "same_period_last_year",
    expectedComparison: { from: "2025-08-01", mode: "same_period_last_year", to: "2025-08-20" },
    expectedCurrent: { from: "2026-08-01", to: "2026-08-20" },
    from: "2026-08-01",
    name: "same_period_last_year keeps the month and day and steps the year back",
    now: AUGUST_20_2026,
    to: "2026-08-20",
  },
  {
    compare: "same_period_last_year",
    expectedComparison: { from: "2023-02-01", mode: "same_period_last_year", to: "2023-02-28" },
    expectedCurrent: { from: "2024-02-01", to: "2024-02-29" },
    from: "2024-02-01",
    name: "a 29 February landing on a non-leap year steps back to 28 February",
    now: LEAP_DAY_2024,
    to: "2024-02-29",
  },
  {
    compare: "same_period_last_year",
    expectedComparison: { from: "2024-02-01", mode: "same_period_last_year", to: "2024-02-28" },
    expectedCurrent: { from: "2025-02-01", to: "2025-02-28" },
    from: "2025-02-01",
    name: "a 28 February stays on the 28th even when the target year is leap",
    now: FEBRUARY_28_2025,
    to: "2025-02-28",
  },
  {
    expectedComparison: null,
    expectedCurrent: { from: "2026-08-01", to: "2026-08-20" },
    from: "2026-08-01",
    name: "no compare mode leaves the comparison period out entirely",
    now: AUGUST_20_2026,
    to: "2026-08-20",
  },
  {
    compare: "previous_period",
    expectedComparison: { from: "2026-07-01", mode: "previous_period", to: "2026-07-20" },
    expectedCurrent: { from: "2026-08-01", to: "2026-08-20" },
    from: "2026-08-01",
    name: "an open end resolves to today before the comparison window is derived",
    now: AUGUST_20_2026,
  },
  {
    compare: "previous_period",
    expectedComparison: null,
    expectedCurrent: { from: null, to: "2026-08-20" },
    name: "an open start stays open and leaves nothing to compare against",
    now: AUGUST_20_2026,
  },
];

function comparisonOf(input: PeriodInput): StatisticsComparisonPeriod {
  const { comparisonPeriod } = resolveStatisticsPeriods(input);
  if (comparisonPeriod === null) {
    throw new Error("expected a comparison period");
  }

  return comparisonPeriod;
}

function inclusiveDays({ from, to }: { from: string; to: string }): number {
  return daysBetweenIsoDates({ endIsoDate: to, startIsoDate: from }) + 1;
}

describe("resolveStatisticsPeriods", () => {
  it.each(PERIOD_CASES)(
    "$name",
    ({ compare, expectedComparison, expectedCurrent, from, now, to }) => {
      const { comparisonPeriod, currentPeriod } = resolveStatisticsPeriods({
        compare,
        from,
        now,
        to,
      });

      expect({ comparisonPeriod, currentPeriod }).toEqual({
        comparisonPeriod: expectedComparison,
        currentPeriod: expectedCurrent,
      });
    },
  );

  it("gives a thirty-one day July the whole of June, thirty days rather than thirty-one", () => {
    const comparison = comparisonOf({
      compare: "previous_period",
      from: "2026-07-01",
      now: AUGUST_20_2026,
      to: "2026-07-31",
    });

    expect([
      inclusiveDays({ from: "2026-07-01", to: "2026-07-31" }),
      inclusiveDays(comparison),
    ]).toEqual([31, 30]);
  });

  it("keeps an arbitrary range and its previous window the same inclusive length", () => {
    const arbitraryRanges = [
      { from: "2026-05-21", to: "2026-08-20" },
      { from: "2026-07-22", to: "2026-08-20" },
      { from: "2026-08-05", to: "2026-08-20" },
      { from: "2026-01-01", to: "2026-08-20" },
    ];

    const lengths = arbitraryRanges.map((range) => [
      inclusiveDays(range),
      inclusiveDays(comparisonOf({ compare: "previous_period", now: AUGUST_20_2026, ...range })),
    ]);

    expect(lengths).toEqual([
      [92, 92],
      [30, 30],
      [16, 16],
      [232, 232],
    ]);
  });

  it("leaves no gap and no overlap between an arbitrary range and its previous window", () => {
    const comparison = comparisonOf({
      compare: "previous_period",
      from: "2026-08-05",
      now: AUGUST_20_2026,
      to: "2026-08-20",
    });

    expect(daysBetweenIsoDates({ endIsoDate: "2026-08-05", startIsoDate: comparison.to })).toBe(1);
  });

  it("reads the last UTC instant of a day as that same day rather than the next one", () => {
    const { currentPeriod } = resolveStatisticsPeriods({
      now: LAST_UTC_INSTANT_OF_AUGUST_20_2026,
    });

    expect(currentPeriod).toEqual({ from: null, to: "2026-08-20" });
  });

  it("hands back empty bounds when the reader asked for no period", () => {
    const { currentPeriod, requestedPeriod } = resolveStatisticsPeriods({ now: AUGUST_20_2026 });

    expect(requestedPeriod).toEqual({ from: undefined, to: undefined });
    expect(currentPeriod.to).toBe("2026-08-20");
  });

  it("repeats the asked-for bounds without filling either of them in", () => {
    const { requestedPeriod } = resolveStatisticsPeriods({
      from: "2026-08-01",
      now: AUGUST_20_2026,
    });

    expect(requestedPeriod).toEqual({ from: "2026-08-01", to: undefined });
  });

  it("keeps the asked-for bounds untouched when a comparison is requested", () => {
    const { requestedPeriod } = resolveStatisticsPeriods({
      compare: "previous_period",
      from: "2026-08-01",
      now: AUGUST_20_2026,
      to: "2026-08-20",
    });

    expect(requestedPeriod).toEqual({ from: "2026-08-01", to: "2026-08-20" });
  });
});
