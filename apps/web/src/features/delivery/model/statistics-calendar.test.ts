import type { BookOrderStatisticsDay, Nullable, StatisticsPeriod } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { CalendarScope } from "./statistics-calendar";

import {
  calendarGrid,
  calendarHasDatedPurchases,
  calendarScope,
  resolveCalendarYear,
} from "./statistics-calendar";

const TODAY = "2026-08-21";

function day(date: string, orders: number, books = orders): BookOrderStatisticsDay {
  return {
    booksCount: books,
    date,
    drilldown: { targets: [] },
    ordersCount: orders,
    totalsByCurrency: [],
  };
}

const DAILY = [day("2025-06-10", 1), day("2026-03-04", 2), day("2026-08-12", 4)];

const ALL_TIME: StatisticsPeriod = { from: null, to: null };

const ONE_MONTH: StatisticsPeriod = { from: "2026-03-01", to: "2026-03-31" };

const OUTLIER_DAILY = [
  day("2026-03-02", 1),
  day("2026-03-03", 1),
  day("2026-03-04", 2),
  day("2026-03-05", 2),
  day("2026-03-06", 3),
  day("2026-03-09", 3),
  day("2026-03-10", 40),
];

function cellFor(date: string, options: Parameters<typeof gridOf>[0] = {}) {
  return (
    gridOf(options)
      .weeks.flat()
      .find((cell) => cell?.date === date) ?? null
  );
}

function datesOf(weeks: Nullable<{ date: string }>[][]): string[] {
  return weeks.flat().flatMap((cell) => (cell === null ? [] : [cell.date]));
}

function gridOf({
  daily = DAILY,
  metric = "orders" as const,
  period = ALL_TIME,
  year = 2026,
}: {
  daily?: BookOrderStatisticsDay[];
  metric?: "books" | "orders";
  period?: StatisticsPeriod;
  year?: number;
}) {
  return calendarGrid({ daily, metric, scope: scopeOf(period, daily), year });
}

function scopeOf(period: StatisticsPeriod, daily: BookOrderStatisticsDay[] = DAILY): CalendarScope {
  const scope = calendarScope({ daily, period, today: TODAY });
  if (scope === null) throw new Error("expected a calendar scope");
  return scope;
}

describe("calendarScope", () => {
  it("takes its bounds from the resolved period rather than from the rows", () => {
    expect(scopeOf({ from: "2026-05-01", to: "2026-07-31" })).toEqual({
      from: "2026-05-01",
      to: "2026-07-31",
      years: [2026],
    });
  });

  it("stops a period that runs past today at today", () => {
    expect(scopeOf({ from: "2026-01-01", to: "2026-12-31" }).to).toBe(TODAY);
  });

  it("lists every year the period spans, newest first, even one with no purchases", () => {
    expect(scopeOf({ from: "2024-02-01", to: "2026-02-01" }).years).toEqual([2026, 2025, 2024]);
  });

  it("falls back to the earliest row when the period has no lower bound", () => {
    expect(scopeOf(ALL_TIME)).toEqual({ from: "2025-06-10", to: TODAY, years: [2026, 2025] });
  });

  it("falls back to today when there is neither a period nor a row", () => {
    expect(scopeOf(ALL_TIME, [])).toEqual({ from: TODAY, to: TODAY, years: [2026] });
  });

  it("reads the earliest row even when the rows arrive out of order", () => {
    expect(scopeOf(ALL_TIME, [day("2026-03-04", 2), day("2025-06-10", 1)]).from).toBe("2025-06-10");
  });

  it("has no scope at all when the period starts after it ends", () => {
    expect(
      calendarScope({ daily: DAILY, period: { from: "2027-01-01", to: null }, today: TODAY }),
    ).toBeNull();
  });
});

describe("resolveCalendarYear", () => {
  it("opens on the latest year of the scope", () => {
    expect(resolveCalendarYear({ requested: null, scope: scopeOf(ALL_TIME) })).toBe(2026);
  });

  it("keeps the year the reader picked while it is still in the scope", () => {
    expect(resolveCalendarYear({ requested: 2025, scope: scopeOf(ALL_TIME) })).toBe(2025);
  });

  it("drops a year the new period no longer covers instead of showing it empty", () => {
    const scope = scopeOf({ from: "2026-01-01", to: "2026-08-01" });

    expect(resolveCalendarYear({ requested: 2025, scope })).toBe(2026);
  });
});

describe("calendarGrid", () => {
  it("draws only the days the period covers", () => {
    const dates = datesOf(gridOf({ period: { from: "2026-03-02", to: "2026-03-08" } }).weeks);

    expect(dates).toEqual([
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
    ]);
  });

  it("leaves the slots outside the period blank rather than as quiet days", () => {
    const [week] = gridOf({ period: { from: "2026-03-04", to: "2026-03-06" } }).weeks;

    expect(week).toEqual([
      null,
      null,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      null,
      null,
    ]);
  });

  it("puts Monday in the first row of the week", () => {
    const [week] = gridOf({ period: { from: "2026-03-02", to: "2026-03-08" } }).weeks;

    expect(week?.at(0)?.date).toBe("2026-03-02");
  });

  it("stops the running year at today instead of drawing the months ahead", () => {
    const grid = gridOf({ period: { from: "2026-01-01", to: "2026-12-31" } });

    expect(grid.to).toBe(TODAY);
    expect(cellFor("2026-08-22", { period: { from: "2026-01-01", to: "2026-12-31" } })).toBeNull();
    expect(grid.monthLabels.map((label) => label.monthStart.slice(0, 7))).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("labels a partial first month at the day the period starts", () => {
    const grid = gridOf({ period: { from: "2026-03-04", to: "2026-04-10" } });

    expect(grid.monthLabels.map((label) => label.monthStart)).toEqual(["2026-03-04", "2026-04-01"]);
  });

  it("draws a single-month period as that month alone, without padding it out to a neighbour", () => {
    const dates = datesOf(gridOf({ period: ONE_MONTH }).weeks);

    expect(dates).toHaveLength(31);
    expect(dates.at(0)).toBe("2026-03-01");
    expect(dates.at(-1)).toBe("2026-03-31");
    expect(dates.every((date) => date.startsWith("2026-03"))).toBe(true);
  });

  it("labels no month the period never reaches, even when a padding week runs into it", () => {
    const grid = gridOf({ period: { from: "2026-04-02", to: "2026-04-28" } });
    const dates = datesOf(grid.weeks);

    expect(dates).toContain("2026-04-02");
    expect(dates).not.toContain("2026-05-01");
    expect(grid.monthLabels.map((label) => label.monthStart)).toEqual(["2026-04-02"]);
  });

  it("keeps a quiet day inside the period as a real zero cell", () => {
    expect(cellFor("2026-03-05")).toEqual({
      booksCount: 0,
      date: "2026-03-05",
      drilldown: { targets: [] },
      level: 0,
      ordersCount: 0,
      totalsByCurrency: [],
      value: 0,
    });
  });

  it("scales the level against the busiest day drawn, not the busiest of all time", () => {
    expect(cellFor("2026-08-12")?.level).toBe(4);
    expect(cellFor("2026-03-04")?.level).toBe(2);
  });

  it("reads the same day as the darkest one in a year where nothing outranks it", () => {
    expect(cellFor("2025-06-10", { year: 2025 })?.level).toBe(4);
  });

  it("keeps two close days close in tone rather than sending the lower one to the lightest", () => {
    const period = { from: "2026-03-01", to: "2026-03-31" };
    const daily = [day("2026-03-04", 99), day("2026-03-05", 100)];

    expect(cellFor("2026-03-05", { daily, period })?.level).toBe(4);
    expect(cellFor("2026-03-04", { daily, period })?.level).toBe(4);
  });

  it("spreads the ordinary days across levels instead of flattening them under one outlier", () => {
    expect(cellFor("2026-03-02", { daily: OUTLIER_DAILY, period: ONE_MONTH })?.level).toBe(1);
    expect(cellFor("2026-03-04", { daily: OUTLIER_DAILY, period: ONE_MONTH })?.level).toBe(2);
    expect(cellFor("2026-03-06", { daily: OUTLIER_DAILY, period: ONE_MONTH })?.level).toBe(3);
  });

  it("still hands the outlier day the darkest level", () => {
    const grid = gridOf({ daily: OUTLIER_DAILY, period: ONE_MONTH });

    expect(grid.peak).toBe(40);
    expect(cellFor("2026-03-10", { daily: OUTLIER_DAILY, period: ONE_MONTH })?.level).toBe(4);
  });

  it("switches the intensity to the book count", () => {
    const grid = gridOf({
      daily: [day("2026-03-04", 1, 10), day("2026-08-12", 4, 2)],
      metric: "books",
    });

    expect(grid.peak).toBe(10);
    expect(grid.weeks.flat().find((cell) => cell?.date === "2026-03-04")?.level).toBe(4);
  });

  it("gives every day of a single-purchase period the top level and says so", () => {
    const grid = gridOf({
      daily: [day("2026-03-04", 1)],
      period: { from: "2026-03-01", to: "2026-03-31" },
    });

    expect(grid.peak).toBe(1);
    expect(grid.weeks.flat().find((cell) => cell?.date === "2026-03-04")?.level).toBe(4);
  });

  it("reports a year with no purchases instead of dividing by a zero peak", () => {
    const grid = gridOf({
      daily: [day("2026-03-04", 2)],
      period: { from: "2025-01-01", to: "2026-12-31" },
      year: 2025,
    });

    expect(grid.peak).toBe(0);
    expect(grid.hasValues).toBe(false);
    expect(grid.weeks.flat().every((cell) => cell === null || cell.level === 0)).toBe(true);
  });

  it("still counts a year that only its own rows fill", () => {
    const grid = gridOf({ period: { from: "2025-01-01", to: "2026-12-31" }, year: 2025 });

    expect(grid.peak).toBe(1);
    expect(grid.hasValues).toBe(true);
  });

  it("lays every week out as seven slots", () => {
    expect(gridOf({}).weeks.every((week) => week.length === 7)).toBe(true);
  });
});

describe("calendarHasDatedPurchases", () => {
  it("finds the dated day the calendar would draw", () => {
    expect(
      calendarHasDatedPurchases({ daily: DAILY, metric: "orders", scope: scopeOf(ALL_TIME) }),
    ).toBe(true);
  });

  it("looks past a dated day the period leaves out", () => {
    expect(
      calendarHasDatedPurchases({
        daily: [day("2024-01-05", 3)],
        metric: "orders",
        scope: scopeOf({ from: "2026-01-01", to: "2026-08-01" }),
      }),
    ).toBe(false);
  });

  it("asks the metric on show, so an order that carried no book leaves the books view empty", () => {
    const daily = [day("2026-03-04", 1, 0)];
    const scope = scopeOf({ from: "2026-01-01", to: "2026-08-01" }, daily);

    expect(calendarHasDatedPurchases({ daily, metric: "orders", scope })).toBe(true);
    expect(calendarHasDatedPurchases({ daily, metric: "books", scope })).toBe(false);
  });
});
