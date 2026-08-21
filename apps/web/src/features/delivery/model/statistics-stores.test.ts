import type { BookOrderStatisticsStore } from "@app/shared";

import { describe, expect, it } from "vitest";

import { storeRows, storeScatter } from "./statistics-stores";

function store(overrides: Partial<BookOrderStatisticsStore> & { store: string }) {
  return {
    averageBookPriceByCurrency: [],
    averageBooksPerOrder: null,
    averageLandedBookCostByCurrency: [],
    averageOrderAmountByCurrency: [],
    booksCount: 0,
    deliveryTotalByCurrency: [],
    discountTotalByCurrency: [],
    landedCoverageByCurrency: [],
    landedEligibleBooksCountByCurrency: [],
    ordersCount: 0,
    totalsByCurrency: [],
    ...overrides,
  } satisfies BookOrderStatisticsStore;
}

const YAKABOO = store({
  averageBookPriceByCurrency: [{ average: 578, currency: "UAH" }],
  averageLandedBookCostByCurrency: [{ average: 582, currency: "UAH" }],
  averageOrderAmountByCurrency: [{ average: 841, currency: "UAH" }],
  booksCount: 13,
  landedCoverageByCurrency: [
    { countedBooksCount: 13, coveragePercent: 100, currency: "UAH", eligibleBooksCount: 13 },
  ],
  landedEligibleBooksCountByCurrency: [{ count: 13, currency: "UAH" }],
  ordersCount: 9,
  store: "Yakaboo",
  totalsByCurrency: [{ currency: "UAH", total: 7575 }],
});

const VIVAT = store({
  booksCount: 6,
  ordersCount: 4,
  store: "Vivat",
  totalsByCurrency: [{ currency: "UAH", total: 4840 }],
});

describe("storeRows", () => {
  it("ranks by the chosen metric and scales the bar against the leader", () => {
    const rows = storeRows({
      comparisonStores: null,
      currency: "UAH",
      metric: "spend",
      stores: [VIVAT, YAKABOO],
    });

    expect(rows.map((row) => row.store)).toEqual(["Yakaboo", "Vivat"]);
    expect(rows[0]?.share).toBe(1);
    expect(rows[1]?.share).toBeCloseTo(4840 / 7575);
  });

  it("re-ranks when the metric switches to counts", () => {
    const rows = storeRows({
      comparisonStores: null,
      currency: "UAH",
      metric: "orders",
      stores: [VIVAT, YAKABOO],
    });

    expect(rows.map((row) => row.value)).toEqual([9, 4]);
  });

  it("hides a store that has nothing in the chosen currency", () => {
    const rows = storeRows({
      comparisonStores: null,
      currency: "EUR",
      metric: "spend",
      stores: [YAKABOO],
    });

    expect(rows).toEqual([]);
  });

  it("reports the change against the comparison period", () => {
    const rows = storeRows({
      comparisonStores: [{ ...YAKABOO, totalsByCurrency: [{ currency: "UAH", total: 5000 }] }],
      currency: "UAH",
      metric: "spend",
      stores: [YAKABOO],
    });

    expect(rows[0]?.deltaValue).toBe(2575);
    expect(rows[0]?.deltaPercent).toBeCloseTo(51.5);
  });

  it("refuses to invent a percentage when the store had nothing before", () => {
    const rows = storeRows({
      comparisonStores: [],
      currency: "UAH",
      metric: "spend",
      stores: [YAKABOO],
    });

    expect(rows[0]?.deltaValue).toBe(7575);
    expect(rows[0]?.deltaPercent).toBeNull();
  });
});

describe("storeScatter", () => {
  it("plots a store that has enough landed data", () => {
    const { points, withoutLandedData } = storeScatter({ currency: "UAH", stores: [YAKABOO] });

    expect(points).toEqual([
      {
        averageLandedBookCost: 582,
        averageOrderAmount: 841,
        booksCount: 13,
        coveragePercent: 100,
        ordersCount: 9,
        store: "Yakaboo",
      },
    ]);
    expect(withoutLandedData).toEqual([]);
  });

  it("lists rather than plots a store with no landed average", () => {
    const { points, withoutLandedData } = storeScatter({ currency: "UAH", stores: [VIVAT] });

    expect(points).toEqual([]);
    expect(withoutLandedData).toEqual(["Vivat"]);
  });

  it("keeps a single landed book out of the chart", () => {
    const thin = store({
      averageLandedBookCostByCurrency: [{ average: 400, currency: "UAH" }],
      averageOrderAmountByCurrency: [{ average: 400, currency: "UAH" }],
      landedCoverageByCurrency: [
        { countedBooksCount: 1, coveragePercent: 100, currency: "UAH", eligibleBooksCount: 1 },
      ],
      landedEligibleBooksCountByCurrency: [{ count: 1, currency: "UAH" }],
      ordersCount: 1,
      store: "Комора",
    });

    const { points, withoutLandedData } = storeScatter({ currency: "UAH", stores: [thin] });

    expect(points).toEqual([]);
    expect(withoutLandedData).toEqual(["Комора"]);
  });
});
