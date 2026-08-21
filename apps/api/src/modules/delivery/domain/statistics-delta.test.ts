import type { CurrencyTotal, NumericDelta } from "@app/shared";

import { describe, expect, it } from "vitest";

import { toCurrencyDeltas, toNumericDelta } from "./statistics-delta.js";

type NumericDeltaCase = {
  current: NumericDelta["current"];
  expected: NumericDelta;
  name: string;
  previous: NumericDelta["previous"];
};

const NUMERIC_DELTA_CASES: NumericDeltaCase[] = [
  {
    current: 150,
    expected: { absoluteDelta: 50, current: 150, percentDelta: 50, previous: 100 },
    name: "growth reports both the absolute step and the percentage of the previous value",
    previous: 100,
  },
  {
    current: 50,
    expected: { absoluteDelta: -50, current: 50, percentDelta: -50, previous: 100 },
    name: "a decline reports negative numbers rather than an absolute magnitude",
    previous: 100,
  },
  {
    current: 5,
    expected: { absoluteDelta: 5, current: 5, percentDelta: null, previous: 0 },
    name: "a previous value of zero leaves the percentage undefined instead of infinite",
    previous: 0,
  },
  {
    current: 0,
    expected: { absoluteDelta: 0, current: 0, percentDelta: null, previous: 0 },
    name: "zero against zero leaves the percentage undefined instead of not-a-number",
    previous: 0,
  },
  {
    current: 5,
    expected: { absoluteDelta: null, current: 5, percentDelta: null, previous: null },
    name: "a missing previous value leaves both the step and the percentage undefined",
    previous: null,
  },
  {
    current: null,
    expected: { absoluteDelta: null, current: null, percentDelta: null, previous: 100 },
    name: "a missing current value leaves both the step and the percentage undefined",
    previous: 100,
  },
];

const CURRENT_TOTALS: CurrencyTotal[] = [
  { currency: "UAH", total: 1000 },
  { currency: "USD", total: 40 },
];

const PREVIOUS_TOTALS: CurrencyTotal[] = [
  { currency: "UAH", total: 800 },
  { currency: "EUR", total: 25 },
];

describe("toNumericDelta", () => {
  it.each(NUMERIC_DELTA_CASES)("$name", ({ current, expected, previous }) => {
    expect(toNumericDelta({ current, previous })).toEqual(expected);
  });

  it("never reports an infinite or not-a-number percentage for a zero denominator", () => {
    const percentages = [
      toNumericDelta({ current: 5, previous: 0 }).percentDelta,
      toNumericDelta({ current: 0, previous: 0 }).percentDelta,
      toNumericDelta({ current: -5, previous: 0 }).percentDelta,
    ];

    expect(percentages).toEqual([null, null, null]);
  });
});

describe("toCurrencyDeltas", () => {
  it("pairs strictly by currency and never folds one currency into another", () => {
    expect(toCurrencyDeltas({ current: CURRENT_TOTALS, previous: PREVIOUS_TOTALS })).toEqual([
      { absoluteDelta: 200, currency: "UAH", current: 1000, percentDelta: 25, previous: 800 },
      { absoluteDelta: null, currency: "EUR", current: null, percentDelta: null, previous: 25 },
      { absoluteDelta: null, currency: "USD", current: 40, percentDelta: null, previous: null },
    ]);
  });

  it("gives a currency seen only in the current period a null previous and no percentage", () => {
    const deltas = toCurrencyDeltas({
      current: [{ currency: "USD", total: 40 }],
      previous: [{ currency: "UAH", total: 800 }],
    });

    expect(deltas).toContainEqual({
      absoluteDelta: null,
      currency: "USD",
      current: 40,
      percentDelta: null,
      previous: null,
    });
  });

  it("gives a currency seen only in the previous period a null current and no percentage", () => {
    const deltas = toCurrencyDeltas({
      current: [],
      previous: [{ currency: "EUR", total: 25 }],
    });

    expect(deltas).toEqual([
      { absoluteDelta: null, currency: "EUR", current: null, percentDelta: null, previous: 25 },
    ]);
  });

  it("leaves out a currency that neither period mentions", () => {
    const deltas = toCurrencyDeltas({
      current: [{ currency: "UAH", total: 1000 }],
      previous: [{ currency: "UAH", total: 800 }],
    });

    expect(deltas.map((delta) => delta.currency)).toEqual(["UAH"]);
  });

  it("returns nothing at all when neither period carries a total", () => {
    expect(toCurrencyDeltas({ current: [], previous: [] })).toEqual([]);
  });
});
