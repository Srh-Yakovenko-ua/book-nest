import type {
  BookOrderStatisticsComparison,
  BookOrderStatisticsCosts,
  BookOrderStatisticsRecordScope,
  CurrencyDelta,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import { buildSpendingPulse, PULSE_RULES } from "./statistics-pulse.js";

const QUIET_SCOPE: BookOrderStatisticsRecordScope = {
  isPeriodFiltered: false,
  isTruncated: false,
  period: { from: null, to: null },
};

const NO_DELTA: CurrencyDelta = {
  absoluteDelta: null,
  currency: "UAH",
  current: null,
  percentDelta: null,
  previous: null,
};

function costsOf(
  overrides: Partial<BookOrderStatisticsCosts[number]> = {},
): BookOrderStatisticsCosts {
  return [
    {
      currency: "UAH",
      deliveryCostPerBook: 0,
      deliveryShareOfSpendPercent: 0,
      deliveryTotal: 0,
      discountShareOfRawSubtotalPercent: null,
      discountTotal: 0,
      ordersWithDeliveryCount: 0,
      ordersWithDiscountCount: 0,
      ...overrides,
    },
  ];
}

function delta(percentDelta: null | number, overrides: Partial<CurrencyDelta> = {}): CurrencyDelta {
  return {
    absoluteDelta: 100,
    currency: "UAH",
    current: 1100,
    percentDelta,
    previous: 1000,
    ...overrides,
  };
}

function emptyComparison(): BookOrderStatisticsComparison {
  const noNumeric = { absoluteDelta: null, current: null, percentDelta: null, previous: null };
  return {
    averageBookPriceByCurrency: [],
    averageBooksPerOrder: noNumeric,
    averageOrderAmountByCurrency: [],
    booksCount: noNumeric,
    ordersCount: noNumeric,
    receivedBooksCount: noNumeric,
    shipmentsCount: noNumeric,
    totalsByCurrency: [],
  };
}

function pulseOf({
  comparison = null,
  costs = [],
  landedCostDeltas = [],
  landedCoverage = [],
  recordMonthByCurrency = [],
  scope = QUIET_SCOPE,
  storeGrowth = [],
}: Partial<Parameters<typeof buildSpendingPulse>[0]> = {}) {
  return buildSpendingPulse({
    comparison,
    costs,
    landedCostDeltas,
    landedCoverage,
    recordMonthByCurrency,
    scope,
    storeGrowth,
  });
}

describe("buildSpendingPulse with no comparison", () => {
  it("says nothing at all when there is nothing to say", () => {
    expect(pulseOf({})).toEqual([]);
  });

  it("emits no comparison-derived insight while compare is off", () => {
    const pulse = pulseOf({ costs: costsOf(), landedCostDeltas: [delta(50)] });

    expect(pulse.filter((signal) => signal.code === "spend_change")).toEqual([]);
  });
});

describe("buildSpendingPulse significance gates", () => {
  it("ignores a spend change too small to be worth a sentence", () => {
    const comparison = emptyComparison();
    comparison.totalsByCurrency = [delta(PULSE_RULES.spendChangePercent - 1)];

    expect(pulseOf({ comparison })).toEqual([]);
  });

  it("speaks up once the spend change clears the threshold", () => {
    const comparison = emptyComparison();
    comparison.totalsByCurrency = [delta(PULSE_RULES.spendChangePercent)];

    expect(pulseOf({ comparison }).map((signal) => signal.code)).toEqual(["spend_change"]);
  });

  it("stays quiet when the previous period was zero, rather than inventing a percent", () => {
    const comparison = emptyComparison();
    comparison.totalsByCurrency = [NO_DELTA];

    expect(pulseOf({ comparison })).toEqual([]);
  });

  it("withholds a landed-cost verdict while coverage is too thin to support one", () => {
    const thin = pulseOf({
      landedCostDeltas: [delta(40)],
      landedCoverage: [
        { coveragePercent: PULSE_RULES.minLandedCoveragePercent - 1, currency: "UAH" },
      ],
    });
    const solid = pulseOf({
      landedCostDeltas: [delta(40)],
      landedCoverage: [{ coveragePercent: PULSE_RULES.minLandedCoveragePercent, currency: "UAH" }],
    });

    expect({ solid: solid.map((signal) => signal.code), thin }).toEqual({
      solid: ["avg_landed_cost_change"],
      thin: [],
    });
  });

  it("flags delivery only once it eats a real share of the spend", () => {
    const quiet = pulseOf({
      costs: costsOf({ deliveryShareOfSpendPercent: PULSE_RULES.deliverySharePercent - 1 }),
    });
    const loud = pulseOf({
      costs: costsOf({
        deliveryShareOfSpendPercent: PULSE_RULES.deliverySharePercent,
        deliveryTotal: 500,
      }),
    });

    expect({ loud: loud.map((signal) => signal.code), quiet }).toEqual({
      loud: ["delivery_share"],
      quiet: [],
    });
  });

  it("celebrates a discount only when something was actually saved", () => {
    const nothing = pulseOf({ costs: costsOf({ discountTotal: 0 }) });
    const saved = pulseOf({
      costs: costsOf({ discountShareOfRawSubtotalPercent: 20, discountTotal: 300 }),
    });

    expect({ nothing, saved: saved.map((signal) => signal.code) }).toEqual({
      nothing: [],
      saved: ["discount_savings"],
    });
  });
});

describe("buildSpendingPulse ranking", () => {
  it("keeps each currency's spend change as its own signal", () => {
    const comparison = emptyComparison();
    comparison.totalsByCurrency = [delta(30), delta(30, { currency: "USD" })];

    expect(pulseOf({ comparison }).map((signal) => signal.currency)).toEqual(["UAH", "USD"]);
  });

  it("leads with the spend change and drops the least useful signal at the cap", () => {
    const comparison = emptyComparison();
    comparison.totalsByCurrency = [delta(30)];
    comparison.averageBookPriceByCurrency = [delta(30)];

    const pulse = pulseOf({
      comparison,
      costs: costsOf({
        deliveryShareOfSpendPercent: 40,
        deliveryTotal: 900,
        discountShareOfRawSubtotalPercent: 30,
        discountTotal: 400,
      }),
      landedCostDeltas: [delta(30)],
      landedCoverage: [{ coveragePercent: 100, currency: "UAH" }],
      storeGrowth: [{ ...delta(30), store: "Yakaboo" }],
    });

    expect(pulse).toHaveLength(PULSE_RULES.maxSignals);
    expect(pulse.map((signal) => signal.code)).toEqual([
      "spend_change",
      "avg_book_price_change",
      "avg_landed_cost_change",
      "store_growth",
    ]);
  });

  it("hands the record month the scope so the wording can stay honest under truncation", () => {
    const scope: BookOrderStatisticsRecordScope = {
      isPeriodFiltered: true,
      isTruncated: true,
      period: { from: "2026-03-01", to: "2026-03-31" },
    };
    const [signal] = pulseOf({
      recordMonthByCurrency: [
        { booksCount: 3, currency: "UAH", month: "2026-03", ordersCount: 2, total: 900 },
      ],
      scope,
    });

    expect(signal?.code === "record_month" ? signal.scope : null).toEqual(scope);
  });
});
