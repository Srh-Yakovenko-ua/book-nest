import { describe, expect, it } from "vitest";

import {
  canCompareStatisticsPeriod,
  defaultStatisticsCompareMode,
  resolveStatisticsPeriod,
} from "./statistics-period";

const TODAY = "2026-08-21";
const NO_CUSTOM = { from: "", to: "" };

function range(preset: Parameters<typeof resolveStatisticsPeriod>[0]["preset"]) {
  return resolveStatisticsPeriod({ custom: NO_CUSTOM, preset, today: TODAY });
}

describe("resolveStatisticsPeriod", () => {
  it("starts the current month on its first day and ends it today", () => {
    expect(range("this_month")).toEqual({ from: "2026-08-01", to: TODAY });
  });

  it("covers the whole preceding calendar month", () => {
    expect(range("last_month")).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });

  it("counts the rolling window inclusively, so thirty days end today", () => {
    expect(range("last_30_days")).toEqual({ from: "2026-07-23", to: TODAY });
  });

  it("makes a rolling month window span exactly that many months", () => {
    expect(range("last_3_months")).toEqual({ from: "2026-05-22", to: TODAY });
    expect(range("last_12_months")).toEqual({ from: "2025-08-22", to: TODAY });
  });

  it("runs the year to date", () => {
    expect(range("this_year")).toEqual({ from: "2026-01-01", to: TODAY });
  });

  it("leaves both bounds open for all time, so undated orders still count", () => {
    expect(range("all_time")).toEqual({ from: null, to: null });
  });

  it("takes both bounds from the custom range", () => {
    const custom = { from: "2026-03-01", to: "2026-05-31" };
    expect(resolveStatisticsPeriod({ custom, preset: "custom", today: TODAY })).toEqual(custom);
  });

  it("drops a half-typed custom bound instead of guessing one", () => {
    const custom = { from: "2026-03", to: "" };
    expect(resolveStatisticsPeriod({ custom, preset: "custom", today: TODAY })).toEqual({
      from: null,
      to: null,
    });
  });
});

describe("canCompareStatisticsPeriod", () => {
  it("needs both bounds, so all time cannot be compared", () => {
    expect(canCompareStatisticsPeriod(range("all_time"))).toBe(false);
  });

  it("accepts every bounded preset", () => {
    expect(canCompareStatisticsPeriod(range("this_year"))).toBe(true);
    expect(canCompareStatisticsPeriod(range("last_month"))).toBe(true);
  });

  it("refuses an unfinished custom range", () => {
    expect(
      canCompareStatisticsPeriod(
        resolveStatisticsPeriod({
          custom: { from: "2026-03-01", to: "" },
          preset: "custom",
          today: TODAY,
        }),
      ),
    ).toBe(false);
  });
});

describe("defaultStatisticsCompareMode", () => {
  it("compares a year against the same stretch of the previous year", () => {
    expect(defaultStatisticsCompareMode("this_year")).toBe("same_period_last_year");
  });

  it("compares every other preset against the period right before it", () => {
    expect(defaultStatisticsCompareMode("this_month")).toBe("previous_period");
    expect(defaultStatisticsCompareMode("custom")).toBe("previous_period");
  });
});
