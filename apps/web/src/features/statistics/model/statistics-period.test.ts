import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canCompareStatisticsPeriod,
  customRangeIssue,
  defaultStatisticsCompareMode,
  isPeriodIncludingDay,
  selectableYearBounds,
  todayIsoDay,
  toOverviewParams,
} from "./statistics-period";

const TODAY = "2026-03-31";

const BASE_STATE = {
  compare: null,
  from: "",
  period: "year",
  to: "",
  year: null,
} as const;

describe("customRangeIssue", () => {
  it("accepts a one-day range", () => {
    expect(customRangeIssue({ from: "2026-03-02", to: "2026-03-02", today: TODAY })).toBeNull();
  });

  it("reports a reversed range instead of swapping it", () => {
    expect(customRangeIssue({ from: "2026-03-10", to: "2026-03-02", today: TODAY })).toBe(
      "reversed",
    );
  });

  it("reports a future bound instead of clamping it", () => {
    expect(customRangeIssue({ from: "2026-03-02", to: "2026-12-31", today: TODAY })).toBe("future");
  });

  it("reports an incomplete range", () => {
    expect(customRangeIssue({ from: "2026-03-02", to: "", today: TODAY })).toBe("incomplete");
  });

  it("reports a malformed date", () => {
    expect(customRangeIssue({ from: "2026-13-40", to: "2026-03-02", today: TODAY })).toBe(
      "invalid",
    );
  });

  it("reports a start before the earliest supported day", () => {
    expect(customRangeIssue({ from: "1899-12-31", to: "1900-02-01", today: TODAY })).toBe(
      "tooEarly",
    );
    expect(customRangeIssue({ from: "1900-01-01", to: "1900-02-01", today: TODAY })).toBeNull();
  });

  it("accepts exactly 1830 days and rejects one day more", () => {
    expect(customRangeIssue({ from: "2021-03-28", to: TODAY, today: TODAY })).toBeNull();
    expect(customRangeIssue({ from: "2021-03-27", to: TODAY, today: TODAY })).toBe("tooLong");
  });
});

describe("todayIsoDay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads today in the profile time zone rather than the device one", () => {
    vi.useFakeTimers({ now: new Date("2026-03-31T22:30:00.000Z") });

    expect(todayIsoDay("Europe/Kyiv")).toBe("2026-04-01");
    expect(todayIsoDay("America/New_York")).toBe("2026-03-31");
  });
});

describe("canCompareStatisticsPeriod", () => {
  it("allows comparison for every period except all time", () => {
    expect(canCompareStatisticsPeriod("year")).toBe(true);
    expect(canCompareStatisticsPeriod("last_12_months")).toBe(true);
    expect(canCompareStatisticsPeriod("custom")).toBe(true);
    expect(canCompareStatisticsPeriod("all_time")).toBe(false);
  });

  it("defaults a calendar year to the same period last year", () => {
    expect(defaultStatisticsCompareMode("year")).toBe("same_period_last_year");
    expect(defaultStatisticsCompareMode("custom")).toBe("previous_period");
  });
});

describe("toOverviewParams", () => {
  it("sends the current year when no year was picked", () => {
    expect(toOverviewParams({ ...BASE_STATE }, TODAY)).toEqual({ period: "year", year: 2026 });
  });

  it("sends the picked year", () => {
    expect(toOverviewParams({ ...BASE_STATE, year: 2024 }, TODAY)).toEqual({
      period: "year",
      year: 2024,
    });
  });

  it("sends both custom bounds and no year", () => {
    expect(
      toOverviewParams(
        { ...BASE_STATE, from: "2026-01-05", period: "custom", to: "2026-02-05" },
        TODAY,
      ),
    ).toEqual({ from: "2026-01-05", period: "custom", to: "2026-02-05" });
  });

  it("drops a comparison that all time cannot support", () => {
    expect(
      toOverviewParams({ ...BASE_STATE, compare: "previous_period", period: "all_time" }, TODAY),
    ).toEqual({ period: "all_time" });
  });

  it("keeps a supported comparison", () => {
    expect(toOverviewParams({ ...BASE_STATE, compare: "same_period_last_year" }, TODAY)).toEqual({
      compare: "same_period_last_year",
      period: "year",
      year: 2026,
    });
  });
});

describe("selectableYearBounds", () => {
  it("never offers a future year", () => {
    const bounds = selectableYearBounds(TODAY);

    expect(bounds.max).toBe(2026);
    expect(bounds.min).toBeLessThan(bounds.max);
  });
});

describe("isPeriodIncludingDay", () => {
  it.each([
    ["a calendar year still running", { from: "2026-01-01", kind: "year", to: TODAY }, true],
    ["the last 12 months", { from: "2025-04-01", kind: "last_12_months", to: TODAY }, true],
    ["a custom range ending today", { from: "2026-03-31", kind: "custom", to: TODAY }, true],
    ["all time", { from: null, kind: "all_time", to: TODAY }, true],
    ["a past calendar year", { from: "2025-01-01", kind: "year", to: "2025-12-31" }, false],
    [
      "a custom range ending yesterday",
      { from: "2026-03-01", kind: "custom", to: "2026-03-30" },
      false,
    ],
  ] as const)("answers for %s", (_, period, expected) => {
    expect(isPeriodIncludingDay({ day: TODAY, period: { ...period, granularity: "month" } })).toBe(
      expected,
    );
  });
});
