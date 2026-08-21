import type { BookOrderStatisticsDay } from "@app/shared";

import { describe, expect, it } from "vitest";

import { calendarGrid, calendarYears } from "./statistics-calendar";

const TODAY = "2026-08-21";

function day(date: string, orders: number, books = orders): BookOrderStatisticsDay {
  return { booksCount: books, date, ordersCount: orders, totalsByCurrency: [] };
}

const DAILY = [day("2025-06-10", 1), day("2026-03-04", 2), day("2026-08-12", 4)];

function cellFor(date: string) {
  const grid = calendarGrid({ daily: DAILY, metric: "orders", today: TODAY, year: 2026 });
  return grid.weeks.flat().find((cell) => cell?.date === date) ?? null;
}

describe("calendarYears", () => {
  it("lists the years that carry data, newest first", () => {
    expect(calendarYears(DAILY)).toEqual([2026, 2025]);
  });
});

describe("calendarGrid", () => {
  it("scales the level against the busiest day of the year", () => {
    expect(cellFor("2026-08-12")?.level).toBe(4);
    expect(cellFor("2026-03-04")?.level).toBe(2);
  });

  it("gives a day with no orders the lowest level rather than dropping it", () => {
    expect(cellFor("2026-03-05")).toEqual({
      booksCount: 0,
      date: "2026-03-05",
      level: 0,
      ordersCount: 0,
      totalsByCurrency: [],
      value: 0,
    });
  });

  it("leaves days after today blank", () => {
    expect(cellFor("2026-08-22")).toBeNull();
    expect(cellFor("2026-12-31")).toBeNull();
  });

  it("ignores days from another year", () => {
    expect(cellFor("2025-06-10")).toBeNull();
  });

  it("marks where each month starts so the columns can be labelled", () => {
    const grid = calendarGrid({ daily: DAILY, metric: "orders", today: TODAY, year: 2026 });

    expect(grid.monthLabels.map((label) => label.monthStart)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
      "2026-12-01",
    ]);
  });

  it("switches the intensity to the book count", () => {
    const grid = calendarGrid({
      daily: [day("2026-03-04", 1, 10), day("2026-08-12", 4, 2)],
      metric: "books",
      today: TODAY,
      year: 2026,
    });
    const busiest = grid.weeks.flat().find((cell) => cell?.date === "2026-03-04");

    expect(grid.peak).toBe(10);
    expect(busiest?.level).toBe(4);
  });

  it("lays every week out as seven slots", () => {
    const grid = calendarGrid({ daily: DAILY, metric: "orders", today: TODAY, year: 2026 });

    expect(grid.weeks.every((week) => week.length === 7)).toBe(true);
  });
});
