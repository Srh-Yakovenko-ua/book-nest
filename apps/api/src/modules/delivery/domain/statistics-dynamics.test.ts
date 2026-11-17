import type { Currency, Nullable, StatisticsPeriod, WeekStartDay } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { ClassifiedOrder, OrderStatisticsRecord } from "./statistics-scope.js";

import { buildStatisticsDynamics } from "./statistics-dynamics.js";
import { classifyOrder } from "./statistics-scope.js";

const ALL_TIME: StatisticsPeriod = { from: null, to: null };

function dynamicsOf({
  comparisonOrders = null,
  comparisonPeriod = null,
  currentPeriod = ALL_TIME,
  orders,
  weekStartDay = "monday",
}: {
  comparisonOrders?: Nullable<ClassifiedOrder[]>;
  comparisonPeriod?: Nullable<StatisticsPeriod>;
  currentPeriod?: StatisticsPeriod;
  orders: ClassifiedOrder[];
  weekStartDay?: WeekStartDay;
}) {
  return buildStatisticsDynamics({
    comparisonOrders,
    comparisonPeriod,
    currentPeriod,
    orders,
    weekStartDay,
  });
}

function orderOf({
  amount = 100,
  books = 1,
  currency = "UAH",
  id = "order",
  orderedOn,
  received = false,
}: {
  amount?: Nullable<number>;
  books?: number;
  currency?: Currency;
  id?: string;
  orderedOn: Nullable<string>;
  received?: boolean;
}): ClassifiedOrder {
  const record: OrderStatisticsRecord = {
    currency,
    deliveryPrice: null,
    discount: null,
    id,
    isFree: false,
    items: Array.from({ length: books }, (_unused, index) => ({
      bookId: `${id}-book-${index}`,
      bookTitle: "Book",
      cancelledAt: null,
      id: `${id}-item-${index}`,
      price: null,
      receivedAt: received ? new Date("2026-03-20T00:00:00.000Z") : null,
      shipmentId: null,
    })),
    orderDate: orderedOn === null ? null : new Date(`${orderedOn}T00:00:00.000Z`),
    orderNumber: null,
    shipments: [],
    storeName: "Yakaboo",
    totalAmount: amount,
  };

  return classifyOrder({ includeCancelled: false, record });
}

describe("buildStatisticsDynamics granularity", () => {
  it("splits a short period into weeks so one month is not a single column", () => {
    const dynamics = dynamicsOf({
      currentPeriod: { from: "2026-07-01", to: "2026-07-31" },
      orders: [orderOf({ orderedOn: "2026-07-08" })],
    });

    expect(dynamics.granularity).toBe("week");
    expect(dynamics.buckets.length).toBeGreaterThan(1);
  });

  it("falls back to months once the period outgrows the weekly window", () => {
    const dynamics = dynamicsOf({
      currentPeriod: { from: "2026-01-01", to: "2026-06-30" },
      orders: [orderOf({ orderedOn: "2026-03-04" })],
    });

    expect({ buckets: dynamics.buckets.length, granularity: dynamics.granularity }).toEqual({
      buckets: 6,
      granularity: "month",
    });
  });

  it("keeps a period of exactly the weekly limit on weeks", () => {
    const dynamics = dynamicsOf({
      currentPeriod: { from: "2026-01-01", to: "2026-02-14" },
      orders: [orderOf({ orderedOn: "2026-01-04" })],
    });

    expect(dynamics.granularity).toBe("week");
  });
});

describe("buildStatisticsDynamics bucket bounds", () => {
  it("clips the first bucket to the day the period really starts", () => {
    const dynamics = dynamicsOf({
      currentPeriod: { from: "2026-08-05", to: "2026-12-31" },
      orders: [orderOf({ orderedOn: "2026-08-11" })],
    });

    expect(dynamics.buckets.at(0)?.current).toMatchObject({ from: "2026-08-05", to: "2026-08-31" });
  });

  it("clips the last bucket to the day the period really ends", () => {
    const dynamics = dynamicsOf({
      currentPeriod: { from: "2026-01-01", to: "2026-08-24" },
      orders: [orderOf({ orderedOn: "2026-08-11" })],
    });

    expect(dynamics.buckets.at(-1)?.current).toMatchObject({
      from: "2026-08-01",
      to: "2026-08-24",
    });
  });

  it("keeps a bucket with no purchases in the series instead of dropping it", () => {
    const dynamics = dynamicsOf({
      currentPeriod: { from: "2026-01-01", to: "2026-03-31" },
      orders: [orderOf({ orderedOn: "2026-03-04" })],
    });

    expect(dynamics.buckets.map((bucket) => bucket.current.ordersCount)).toEqual([0, 0, 1]);
  });

  it("derives the bounds from the orders themselves when the period is open ended", () => {
    const dynamics = dynamicsOf({
      orders: [
        orderOf({ id: "first", orderedOn: "2026-01-15" }),
        orderOf({ id: "last", orderedOn: "2026-05-20" }),
      ],
    });

    expect({
      first: dynamics.buckets.at(0)?.current.from,
      last: dynamics.buckets.at(-1)?.current.to,
    }).toEqual({ first: "2026-01-15", last: "2026-05-20" });
  });

  it("returns no buckets at all when nothing carries an order date", () => {
    expect(dynamicsOf({ orders: [orderOf({ orderedOn: null })] }).buckets).toEqual([]);
  });
});

describe("buildStatisticsDynamics week start", () => {
  const JULY: StatisticsPeriod = { from: "2026-07-01", to: "2026-07-31" };
  const SUNDAY_ORDER = orderOf({ orderedOn: "2026-07-12" });

  it("opens weekly buckets on Sundays for a reader whose week starts on Sunday", () => {
    const dynamics = dynamicsOf({
      currentPeriod: JULY,
      orders: [SUNDAY_ORDER],
      weekStartDay: "sunday",
    });

    expect(
      dynamics.buckets.map((bucket) => ({
        key: bucket.key,
        ordersCount: bucket.current.ordersCount,
        to: bucket.current.to,
      })),
    ).toEqual([
      { key: "2026-07-01", ordersCount: 0, to: "2026-07-04" },
      { key: "2026-07-05", ordersCount: 0, to: "2026-07-11" },
      { key: "2026-07-12", ordersCount: 1, to: "2026-07-18" },
      { key: "2026-07-19", ordersCount: 0, to: "2026-07-25" },
      { key: "2026-07-26", ordersCount: 0, to: "2026-07-31" },
    ]);
  });

  it("opens weekly buckets on Mondays, closing the week on that same Sunday order", () => {
    const dynamics = dynamicsOf({
      currentPeriod: JULY,
      orders: [SUNDAY_ORDER],
      weekStartDay: "monday",
    });

    expect(
      dynamics.buckets.map((bucket) => ({
        key: bucket.key,
        ordersCount: bucket.current.ordersCount,
        to: bucket.current.to,
      })),
    ).toEqual([
      { key: "2026-07-01", ordersCount: 0, to: "2026-07-05" },
      { key: "2026-07-06", ordersCount: 1, to: "2026-07-12" },
      { key: "2026-07-13", ordersCount: 0, to: "2026-07-19" },
      { key: "2026-07-20", ordersCount: 0, to: "2026-07-26" },
      { key: "2026-07-27", ordersCount: 0, to: "2026-07-31" },
    ]);
  });
});

describe("buildStatisticsDynamics facts", () => {
  it("keeps each currency of a bucket apart rather than summing them", () => {
    const dynamics = dynamicsOf({
      currentPeriod: { from: "2026-03-01", to: "2026-08-31" },
      orders: [
        orderOf({ amount: 500, id: "uah", orderedOn: "2026-03-04" }),
        orderOf({ amount: 40, currency: "USD", id: "usd", orderedOn: "2026-03-06" }),
      ],
    });

    expect(dynamics.buckets.at(0)?.current.totalsByCurrency).toEqual([
      { currency: "UAH", total: 500 },
      { currency: "USD", total: 40 },
    ]);
  });

  it("reports books per order as missing rather than as zero for an empty bucket", () => {
    const dynamics = dynamicsOf({
      currentPeriod: { from: "2026-01-01", to: "2026-03-31" },
      orders: [orderOf({ orderedOn: "2026-03-04" })],
    });

    expect(dynamics.buckets.at(0)?.current.booksPerOrder).toBeNull();
  });

  it("carries the destinations of the orders that made the bucket", () => {
    const dynamics = dynamicsOf({
      currentPeriod: { from: "2026-03-01", to: "2026-08-31" },
      orders: [
        orderOf({ id: "moving", orderedOn: "2026-03-04" }),
        orderOf({ id: "home", orderedOn: "2026-03-06", received: true }),
      ],
    });

    expect(dynamics.buckets.at(0)?.drilldown.targets).toEqual([
      { booksCount: 1, destination: "in_transit", ordersCount: 1 },
      { booksCount: 1, destination: "history_received", ordersCount: 1 },
    ]);
  });
});

describe("buildStatisticsDynamics comparison", () => {
  it("pairs each current bucket with the comparison bucket at the same position", () => {
    const dynamics = dynamicsOf({
      comparisonOrders: [orderOf({ amount: 200, id: "before", orderedOn: "2025-02-10" })],
      comparisonPeriod: { from: "2025-01-01", to: "2025-03-31" },
      currentPeriod: { from: "2026-01-01", to: "2026-03-31" },
      orders: [orderOf({ amount: 500, id: "now", orderedOn: "2026-03-04" })],
    });

    expect(
      dynamics.buckets.map((bucket) => ({
        comparison: bucket.comparison?.from ?? null,
        current: bucket.current.from,
      })),
    ).toEqual([
      { comparison: "2025-01-01", current: "2026-01-01" },
      { comparison: "2025-02-01", current: "2026-02-01" },
      { comparison: "2025-03-01", current: "2026-03-01" },
    ]);
  });

  it("keeps a comparison bucket that saw nothing instead of shifting the series", () => {
    const dynamics = dynamicsOf({
      comparisonOrders: [orderOf({ amount: 200, id: "before", orderedOn: "2025-03-10" })],
      comparisonPeriod: { from: "2025-01-01", to: "2025-03-31" },
      currentPeriod: { from: "2026-01-01", to: "2026-03-31" },
      orders: [orderOf({ amount: 500, id: "now", orderedOn: "2026-01-04" })],
    });

    expect(dynamics.buckets.map((bucket) => bucket.comparison?.ordersCount ?? null)).toEqual([
      0, 0, 1,
    ]);
  });

  it("leaves a current bucket unpaired when the comparison period is shorter", () => {
    const dynamics = dynamicsOf({
      comparisonOrders: [],
      comparisonPeriod: { from: "2025-01-01", to: "2025-02-28" },
      currentPeriod: { from: "2026-01-01", to: "2026-03-31" },
      orders: [orderOf({ orderedOn: "2026-01-04" })],
    });

    expect(dynamics.buckets.at(-1)?.comparison).toBeNull();
  });

  it("leaves every bucket unpaired while no comparison was asked for", () => {
    const dynamics = dynamicsOf({
      currentPeriod: { from: "2026-01-01", to: "2026-03-31" },
      orders: [orderOf({ orderedOn: "2026-01-04" })],
    });

    expect(dynamics.buckets.every((bucket) => bucket.comparison === null)).toBe(true);
  });
});
