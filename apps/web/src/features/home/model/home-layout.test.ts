import { describe, expect, it } from "vitest";

import type { HomeLayoutRow, HomeRowKey, HomeZonePresence } from "./home-layout";

import { homeLayoutRows } from "./home-layout";

const ALL_PRESENT: HomeZonePresence = {
  attention: true,
  criticalBanner: true,
  currentlyReading: true,
  memory: true,
  nextRead: true,
  readingGoal: true,
  readingWeek: true,
  recentBooks: true,
};

function rowOf(rows: readonly HomeLayoutRow[], key: HomeRowKey) {
  return rows.find((row) => row.key === key);
}

function widestColumnCount(className: string): number {
  const counts = className
    .split(" ")
    .filter((token) => token.includes("grid-cols-"))
    .map((token) => Number(token.split("grid-cols-")[1]));
  return Math.max(...counts);
}

describe("homeLayoutRows", () => {
  it("lays out the banner, primary, middle and lower rows in that order", () => {
    expect(homeLayoutRows(ALL_PRESENT).map(({ key }) => key)).toEqual([
      "banner",
      "primary",
      "middle",
      "lower",
    ]);
  });

  it.each([
    [true, true, true, 3, ["attention", "recentBooks"]],
    [true, true, false, 3, ["attention"]],
    [true, false, true, 3, ["recentBooks"]],
    [true, false, false, 3, null],
    [false, true, true, 2, ["attention", "recentBooks"]],
    [false, true, false, 2, ["attention"]],
    [false, false, true, 2, ["recentBooks"]],
    [false, false, false, 2, null],
  ] as const)(
    "memory %s, attention %s, recent %s: middle row of %i columns, lower zones %j",
    (memory, attention, recentBooks, middleColumns, lowerZones) => {
      const rows = homeLayoutRows({ ...ALL_PRESENT, attention, memory, recentBooks });
      const middle = rowOf(rows, "middle");
      const lower = rowOf(rows, "lower");

      expect(middle && widestColumnCount(middle.className)).toBe(middleColumns);
      expect(lower?.cells.map(({ zone }) => zone) ?? null).toEqual(lowerZones);
    },
  );

  it("drops the memory cell from the middle row when the memory is absent", () => {
    const middle = rowOf(homeLayoutRows({ ...ALL_PRESENT, memory: false }), "middle");

    expect(middle?.cells.map(({ zone }) => zone)).toEqual(["readingGoal", "nextRead"]);
  });

  it.each([
    ["attention", { attention: true, recentBooks: false }],
    ["recent books", { attention: false, recentBooks: true }],
  ] as const)("stretches a lone %s card over the full lower row", (_card, lowerPresence) => {
    const lower = rowOf(homeLayoutRows({ ...ALL_PRESENT, ...lowerPresence }), "lower");

    expect(lower && widestColumnCount(lower.className)).toBe(1);
    expect(lower?.cells[0]?.className).not.toMatch(/col-span-/);
  });

  it("puts attention and recent books side by side when both are present", () => {
    const lower = rowOf(homeLayoutRows(ALL_PRESENT), "lower");

    expect(lower && widestColumnCount(lower.className)).toBeGreaterThan(1);
  });

  it("omits the lower row when neither attention nor recent books is present", () => {
    const rows = homeLayoutRows({ ...ALL_PRESENT, attention: false, recentBooks: false });

    expect(rows.map(({ key }) => key)).not.toContain("lower");
  });

  it("omits the banner row when there is no critical banner", () => {
    const rows = homeLayoutRows({ ...ALL_PRESENT, criticalBanner: false });

    expect(rows.map(({ key }) => key)).toEqual(["primary", "middle", "lower"]);
  });
});
