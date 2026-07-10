import { describe, expect, it } from "vitest";

import {
  computeDeliveryStatistics,
  STATISTICS_TOP_LIMIT,
  type StatisticsRecord,
} from "./delivery-statistics.js";

const utcDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

let sequence = 0;

function compute(records: StatisticsRecord[], includeCancelled = false) {
  return computeDeliveryStatistics({ includeCancelled, records, topLimit: STATISTICS_TOP_LIMIT });
}

function record(overrides: Partial<StatisticsRecord> = {}): StatisticsRecord {
  sequence += 1;
  return {
    bookId: `book-${sequence}`,
    bookTitle: `Title ${sequence}`,
    currency: "UAH",
    orderDate: utcDate("2026-03-15"),
    price: 100,
    status: "received",
    storeName: "Yakaboo",
    ...overrides,
  };
}

describe("computeDeliveryStatistics summary totals", () => {
  it("groups totals per currency without converting across currencies", () => {
    const view = compute([
      record({ currency: "UAH", price: 100 }),
      record({ currency: "USD", price: 50 }),
      record({ currency: "EUR", price: 30 }),
    ]);

    expect(view.summary.totalByCurrency).toEqual([
      { currency: "UAH", total: 100 },
      { currency: "EUR", total: 30 },
      { currency: "USD", total: 50 },
    ]);
  });

  it("defaults a priced record with no currency to UAH", () => {
    const view = compute([
      record({ currency: "UAH", price: 100 }),
      record({ currency: null, price: 40 }),
    ]);

    expect(view.summary.totalByCurrency).toEqual([{ currency: "UAH", total: 140 }]);
  });

  it("averages the price per currency over the main-included priced records", () => {
    const view = compute([
      record({ currency: "UAH", price: 100 }),
      record({ currency: "UAH", price: 200 }),
      record({ currency: "USD", price: 50 }),
    ]);

    expect(view.summary.averageByCurrency).toEqual([
      { average: 150, currency: "UAH" },
      { average: 50, currency: "USD" },
    ]);
  });

  it("counts only priced main-included records in pricedOrdersCount", () => {
    const view = compute([
      record({ price: 100, status: "received" }),
      record({ price: null, status: "received" }),
      record({ price: 50, status: "cancelled" }),
    ]);

    expect(view.summary.pricedOrdersCount).toBe(1);
  });
});

describe("computeDeliveryStatistics cancelled handling", () => {
  const records = (): StatisticsRecord[] => [
    record({
      currency: "UAH",
      orderDate: utcDate("2026-03-10"),
      price: 100,
      status: "received",
      storeName: "Yakaboo",
    }),
    record({
      currency: "UAH",
      orderDate: utcDate("2026-03-11"),
      price: 50,
      status: "cancelled",
      storeName: "Yakaboo",
    }),
  ];

  it("excludes cancelled orders from the summary total when includeCancelled is false", () => {
    const view = compute(records(), false);

    expect(view.summary.totalByCurrency).toEqual([{ currency: "UAH", total: 100 }]);
  });

  it("folds cancelled orders into the summary total when includeCancelled is true", () => {
    const view = compute(records(), true);

    expect(view.summary.totalByCurrency).toEqual([{ currency: "UAH", total: 150 }]);
  });

  it("reports cancelledByCurrency regardless of includeCancelled", () => {
    const excluded = compute(records(), false);
    const included = compute(records(), true);

    expect(excluded.summary.cancelledByCurrency).toEqual([{ currency: "UAH", total: 50 }]);
    expect(included.summary.cancelledByCurrency).toEqual([{ currency: "UAH", total: 50 }]);
  });

  it("keeps cancelled out of monthly, byStore and topOrders when includeCancelled is false", () => {
    const view = compute(records(), false);

    expect(view.monthly).toEqual([
      { month: "2026-03", ordersCount: 1, totalsByCurrency: [{ currency: "UAH", total: 100 }] },
    ]);
    expect(view.byStore).toEqual([
      { ordersCount: 1, store: "Yakaboo", totalsByCurrency: [{ currency: "UAH", total: 100 }] },
    ]);
    expect(view.topOrders.map((order) => order.status)).toEqual(["received"]);
  });

  it("includes cancelled in monthly and topOrders when includeCancelled is true", () => {
    const view = compute(records(), true);

    expect(view.monthly).toEqual([
      { month: "2026-03", ordersCount: 2, totalsByCurrency: [{ currency: "UAH", total: 150 }] },
    ]);
    expect(view.topOrders.map((order) => order.status)).toEqual(["received", "cancelled"]);
  });
});

describe("computeDeliveryStatistics monthly bucketing", () => {
  it("buckets orders by the UTC month of the order date", () => {
    const view = compute([
      record({ orderDate: utcDate("2026-01-31") }),
      record({ orderDate: utcDate("2026-02-28") }),
    ]);

    expect(view.monthly.map((month) => month.month)).toEqual(["2026-01", "2026-02"]);
  });

  it("uses the UTC month for an order placed at UTC midnight on the first of a month", () => {
    const view = compute([record({ orderDate: utcDate("2026-03-01") })]);

    expect(view.monthly.map((month) => month.month)).toEqual(["2026-03"]);
  });

  it("sorts monthly buckets ascending by month", () => {
    const view = compute([
      record({ orderDate: utcDate("2026-05-02") }),
      record({ orderDate: utcDate("2026-01-02") }),
      record({ orderDate: utcDate("2026-03-02") }),
    ]);

    expect(view.monthly.map((month) => month.month)).toEqual(["2026-01", "2026-03", "2026-05"]);
  });

  it("counts an unpriced order in monthly ordersCount but not in the currency totals", () => {
    const view = compute([
      record({ currency: "UAH", orderDate: utcDate("2026-04-10"), price: 100 }),
      record({ orderDate: utcDate("2026-04-20"), price: null }),
    ]);

    expect(view.monthly).toEqual([
      { month: "2026-04", ordersCount: 2, totalsByCurrency: [{ currency: "UAH", total: 100 }] },
    ]);
  });
});

describe("computeDeliveryStatistics byStore", () => {
  it("groups stores case- and space-insensitively keeping the first-seen label", () => {
    const view = compute([
      record({ currency: "UAH", price: 100, storeName: "Yakaboo" }),
      record({ currency: "UAH", price: 50, storeName: "  yakaboo " }),
      record({ currency: "UAH", price: 30, storeName: "Book Depot" }),
    ]);

    expect(view.byStore).toEqual([
      { ordersCount: 2, store: "Yakaboo", totalsByCurrency: [{ currency: "UAH", total: 150 }] },
      { ordersCount: 1, store: "Book Depot", totalsByCurrency: [{ currency: "UAH", total: 30 }] },
    ]);
  });

  it("sorts stores by order count descending then name ascending", () => {
    const view = compute([
      record({ price: 10, storeName: "Zebra" }),
      record({ price: 20, storeName: "Apple" }),
    ]);

    expect(view.byStore.map((store) => store.store)).toEqual(["Apple", "Zebra"]);
  });

  it("omits any percentage field from store buckets", () => {
    const view = compute([record({ price: 10, storeName: "Yakaboo" })]);

    expect(Object.keys(view.byStore[0] ?? {}).sort()).toEqual([
      "ordersCount",
      "store",
      "totalsByCurrency",
    ]);
  });
});

describe("computeDeliveryStatistics topOrders", () => {
  it("orders top orders by raw price descending", () => {
    const view = compute([record({ price: 10 }), record({ price: 50 }), record({ price: 30 })]);

    expect(view.topOrders.map((order) => order.price)).toEqual([50, 30, 10]);
  });

  it("caps the top orders at the given top limit", () => {
    const view = computeDeliveryStatistics({
      includeCancelled: false,
      records: [record({ price: 10 }), record({ price: 50 }), record({ price: 30 })],
      topLimit: 2,
    });

    expect(view.topOrders.map((order) => order.price)).toEqual([50, 30]);
  });

  it("keeps the raw nullable currency on a top order", () => {
    const view = compute([record({ currency: null, price: 40 })]);

    expect(view.topOrders[0]?.currency).toBeNull();
  });

  it("maps the order date to an ISO date string and null when missing", () => {
    const view = compute([
      record({ orderDate: utcDate("2026-05-10"), price: 200 }),
      record({ orderDate: null, price: 100 }),
    ]);

    expect(view.topOrders.map((order) => order.orderDate)).toEqual(["2026-05-10", null]);
  });

  it("maps the expected fields onto a top order", () => {
    const view = compute([
      record({
        bookId: "book-top",
        bookTitle: "Dune",
        currency: "UAH",
        orderDate: utcDate("2026-05-10"),
        price: 500,
        status: "received",
        storeName: "Yakaboo",
      }),
    ]);

    expect(view.topOrders[0]).toEqual({
      bookId: "book-top",
      bookTitle: "Dune",
      currency: "UAH",
      orderDate: "2026-05-10",
      price: 500,
      status: "received",
      storeName: "Yakaboo",
    });
  });
});

describe("computeDeliveryStatistics statusBreakdown", () => {
  const mixedStatuses = (): StatisticsRecord[] => [
    record({ currency: "UAH", price: 10, status: "ordered" }),
    record({ currency: "UAH", price: 20, status: "in_transit" }),
    record({ currency: "UAH", price: 30, status: "ready_for_pickup" }),
    record({ currency: "UAH", price: 40, status: "received" }),
    record({ currency: "UAH", price: 50, status: "cancelled" }),
  ];

  it("groups priced records into active, received and cancelled with ready_for_pickup counted as active", () => {
    const view = compute(mixedStatuses());

    expect(view.statusBreakdown.active).toEqual({
      count: 3,
      totalsByCurrency: [{ currency: "UAH", total: 60 }],
    });
    expect(view.statusBreakdown.received).toEqual({
      count: 1,
      totalsByCurrency: [{ currency: "UAH", total: 40 }],
    });
    expect(view.statusBreakdown.cancelled).toEqual({
      count: 1,
      totalsByCurrency: [{ currency: "UAH", total: 50 }],
    });
  });

  it("ignores unpriced records in the status breakdown", () => {
    const view = compute([
      record({ currency: "UAH", price: 10, status: "ordered" }),
      record({ price: null, status: "ordered" }),
    ]);

    expect(view.statusBreakdown.active.count).toBe(1);
  });

  it("computes the status breakdown independently of includeCancelled", () => {
    const records = mixedStatuses();

    expect(compute(records, false).statusBreakdown).toEqual(compute(records, true).statusBreakdown);
  });
});

describe("computeDeliveryStatistics empty input", () => {
  it("returns an all-empty view without throwing", () => {
    const view = compute([]);

    expect(view).toEqual({
      byStore: [],
      monthly: [],
      statusBreakdown: {
        active: { count: 0, totalsByCurrency: [] },
        cancelled: { count: 0, totalsByCurrency: [] },
        received: { count: 0, totalsByCurrency: [] },
      },
      summary: {
        activeByCurrency: [],
        averageByCurrency: [],
        cancelledByCurrency: [],
        pricedOrdersCount: 0,
        receivedByCurrency: [],
        totalByCurrency: [],
      },
      topOrders: [],
    });
  });
});
