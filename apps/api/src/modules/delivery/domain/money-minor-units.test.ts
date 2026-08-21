import { describe, expect, it } from "vitest";

import { distributeMinorUnits, fromMinorUnits, toMinorUnits } from "./money-minor-units.js";

type DistributionCase = {
  expected: number[];
  name: string;
  totalMinorUnits: number;
  weights: number[];
};

type RoundTripCase = {
  majorUnits: number;
  minorUnits: number;
  name: string;
};

const ROUND_TRIP_CASES: RoundTripCase[] = [
  { majorUnits: 0, minorUnits: 0, name: "nothing stays nothing" },
  { majorUnits: 19.99, minorUnits: 1999, name: "a shop price keeps both decimals" },
  { majorUnits: 1250, minorUnits: 125000, name: "a whole amount gains two zeroes" },
  { majorUnits: -19.99, minorUnits: -1999, name: "a refund keeps its sign" },
  { majorUnits: 99999999.99, minorUnits: 9999999999, name: "the largest storable amount survives" },
];

const DISTRIBUTION_CASES: DistributionCase[] = [
  {
    expected: [38, 62],
    name: "splits by weight and hands the tied cent to the earlier position",
    totalMinorUnits: 100,
    weights: [300, 500],
  },
  {
    expected: [34, 33, 33],
    name: "gives the indivisible cent of an equal three-way split to the first position",
    totalMinorUnits: 100,
    weights: [1, 1, 1],
  },
  {
    expected: [34, 33, 33],
    name: "spreads evenly by index when every weight is zero",
    totalMinorUnits: 100,
    weights: [0, 0, 0],
  },
  {
    expected: [3, 2],
    name: "spreads an odd amount over two zero weights",
    totalMinorUnits: 5,
    weights: [0, 0],
  },
  {
    expected: [100],
    name: "hands the whole total to a single weight",
    totalMinorUnits: 100,
    weights: [7],
  },
  {
    expected: [100],
    name: "hands the whole total to a single zero weight",
    totalMinorUnits: 100,
    weights: [0],
  },
  {
    expected: [0, 0],
    name: "allocates nothing when there is nothing to allocate",
    totalMinorUnits: 0,
    weights: [300, 500],
  },
  {
    expected: [-33, -33, -34],
    name: "spreads a negative adjustment and still lands exactly on the total",
    totalMinorUnits: -100,
    weights: [1, 1, 1],
  },
  {
    expected: [-37, -63],
    name: "splits a negative adjustment by weight",
    totalMinorUnits: -100,
    weights: [300, 500],
  },
  {
    expected: [556, 1111, 1667, 2777, 3888],
    name: "walks the tied remainders from the earliest position onward",
    totalMinorUnits: 9999,
    weights: [1, 2, 3, 5, 7],
  },
  {
    expected: [1, 0, 0, 0],
    name: "gives a lone cent to the first of four equal weights",
    totalMinorUnits: 1,
    weights: [1, 1, 1, 1],
  },
];

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

describe("toMinorUnits", () => {
  it.each(ROUND_TRIP_CASES)("$name", ({ majorUnits, minorUnits }) => {
    expect(toMinorUnits(majorUnits)).toBe(minorUnits);
  });

  it.each(ROUND_TRIP_CASES)("$name, and back again", ({ majorUnits, minorUnits }) => {
    expect(fromMinorUnits(minorUnits)).toBe(majorUnits);
  });

  it("absorbs the float drift of an added price", () => {
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
  });

  it("rounds a half cent away from zero", () => {
    expect(toMinorUnits(0.005)).toBe(1);
  });

  it("rounds a half cent that floats just below the midpoint away from zero", () => {
    expect(toMinorUnits(1.005)).toBe(101);
  });

  it("rounds a negative half cent away from zero", () => {
    expect(toMinorUnits(-0.005)).toBe(-1);
  });

  it("drops a fraction of a cent that cannot be stored", () => {
    expect(toMinorUnits(0.004)).toBe(0);
  });
});

describe("fromMinorUnits", () => {
  it("reads a cent amount back as two decimals", () => {
    expect(fromMinorUnits(1)).toBe(0.01);
  });

  it("reads a negative cent amount back as two decimals", () => {
    expect(fromMinorUnits(-1)).toBe(-0.01);
  });
});

describe("distributeMinorUnits", () => {
  it.each(DISTRIBUTION_CASES)("$name", ({ expected, totalMinorUnits, weights }) => {
    expect(distributeMinorUnits({ totalMinorUnits, weights })).toEqual(expected);
  });

  it.each(DISTRIBUTION_CASES)("$name, summing to the total exactly", (distributionCase) => {
    const { totalMinorUnits, weights } = distributionCase;

    expect(sum(distributeMinorUnits({ totalMinorUnits, weights }))).toBe(totalMinorUnits);
  });

  it("allocates nothing when there is nobody to allocate to", () => {
    expect(distributeMinorUnits({ totalMinorUnits: 100, weights: [] })).toEqual([]);
  });

  it("leaves the caller's weights untouched and answers in the same order", () => {
    const weights = [500, 300, 200];

    const allocated = distributeMinorUnits({ totalMinorUnits: 101, weights });

    expect(weights).toEqual([500, 300, 200]);
    expect(allocated).toEqual([51, 30, 20]);
  });
});
