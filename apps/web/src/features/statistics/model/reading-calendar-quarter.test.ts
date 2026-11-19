import { describe, expect, it } from "vitest";

import {
  listCalendarQuarters,
  listQuarterMonths,
  quarterOfMonth,
  resolveCalendarQuarter,
} from "./reading-calendar-quarter";

describe("quarterOfMonth", () => {
  it.each([
    ["2026-01", "2026-01"],
    ["2026-03", "2026-01"],
    ["2026-04", "2026-04"],
    ["2026-08", "2026-07"],
    ["2026-12", "2026-10"],
  ])("puts %s in the calendar quarter starting %s", (month, quarter) => {
    expect(quarterOfMonth(month)).toBe(quarter);
  });
});

describe("listCalendarQuarters", () => {
  it("lists the four quarters of a closed year", () => {
    expect(listCalendarQuarters({ from: "2025-01-01", to: "2025-12-31" })).toEqual([
      "2025-01",
      "2025-04",
      "2025-07",
      "2025-10",
    ]);
  });

  it("stops at the quarter of the last shown day, so no future quarter is offered", () => {
    expect(listCalendarQuarters({ from: "2026-01-01", to: "2026-03-20" })).toEqual(["2026-01"]);
    expect(listCalendarQuarters({ from: "2026-01-01", to: "2026-11-19" })).toEqual([
      "2026-01",
      "2026-04",
      "2026-07",
      "2026-10",
    ]);
  });
});

describe("listQuarterMonths", () => {
  it.each([
    ["2026-01", ["2026-01", "2026-02", "2026-03"]],
    ["2026-07", ["2026-07", "2026-08", "2026-09"]],
    ["2026-10", ["2026-10", "2026-11", "2026-12"]],
  ])("lists the three months of the quarter starting %s", (quarter, months) => {
    expect(listQuarterMonths(quarter)).toEqual(months);
  });
});

describe("resolveCalendarQuarter", () => {
  it("keeps a quarter that is on offer", () => {
    expect(resolveCalendarQuarter({ quarters: ["2026-01", "2026-04"], requested: "2026-01" })).toBe(
      "2026-01",
    );
  });

  it("falls back to the latest quarter on offer", () => {
    expect(resolveCalendarQuarter({ quarters: ["2026-01", "2026-04"], requested: "2026-10" })).toBe(
      "2026-04",
    );
  });
});
