import type { ActiveMoneyAgeBucket } from "@app/shared";

import { subDays } from "date-fns";
import { describe, expect, it } from "vitest";

import type { OrderStatisticsItemRecord, OrderStatisticsRecord } from "./statistics-scope.js";

import { buildActiveMoneyAge } from "./active-age.js";
import { classifyOrder } from "./statistics-scope.js";

const NOW = new Date("2026-08-20T09:15:00.000Z");

function bucketOfAge(ageInDays: number): ActiveMoneyAgeBucket[] {
  return bucketsOf([makeOrder({ orderDate: subDays(NOW, ageInDays) })]);
}

function bucketsOf(records: OrderStatisticsRecord[]): ActiveMoneyAgeBucket[] {
  return buildActiveMoneyAge({
    now: NOW,
    orders: records.map((record) => classifyOrder({ includeCancelled: false, record })),
  }).buckets.map((bucket) => bucket.key);
}

function makeItem(overrides: Partial<OrderStatisticsItemRecord> = {}): OrderStatisticsItemRecord {
  const bookId = overrides.bookId ?? "book-1";
  return {
    bookId,
    bookTitle: "Book",
    cancelledAt: null,
    id: `item-${bookId}`,
    price: null,
    receivedAt: null,
    shipmentId: null,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderStatisticsRecord> = {}): OrderStatisticsRecord {
  return {
    currency: "UAH",
    deliveryPrice: null,
    discount: null,
    id: "order-1",
    items: [makeItem({ price: 100 })],
    orderDate: subDays(NOW, 1),
    orderNumber: null,
    shipments: [],
    storeName: "Yakaboo",
    totalAmount: null,
    ...overrides,
  };
}

describe("buildActiveMoneyAge boundaries", () => {
  it.each([
    { ageInDays: 0, expected: "0_7" },
    { ageInDays: 7, expected: "0_7" },
    { ageInDays: 8, expected: "8_14" },
    { ageInDays: 14, expected: "8_14" },
    { ageInDays: 15, expected: "15_30" },
    { ageInDays: 30, expected: "15_30" },
    { ageInDays: 31, expected: "31_plus" },
    { ageInDays: 400, expected: "31_plus" },
  ])("files an order $ageInDays days old under $expected", ({ ageInDays, expected }) => {
    expect(bucketOfAge(ageInDays)).toEqual([expected]);
  });

  it("files an order with no date under unknown_date rather than guessing an age", () => {
    expect(bucketsOf([makeOrder({ orderDate: null })])).toEqual(["unknown_date"]);
  });

  it("treats a legacy order dated in the future as brand new instead of going negative", () => {
    expect(bucketsOf([makeOrder({ orderDate: subDays(NOW, -5) })])).toEqual(["0_7"]);
  });
});

describe("buildActiveMoneyAge scope", () => {
  it("counts only the money still in flight, leaving received and cancelled books out", () => {
    const snapshot = buildActiveMoneyAge({
      now: NOW,
      orders: [
        makeOrder({ id: "order-active", items: [makeItem({ bookId: "a", price: 200 })] }),
        makeOrder({
          id: "order-received",
          items: [makeItem({ bookId: "b", price: 500, receivedAt: NOW })],
        }),
        makeOrder({
          id: "order-cancelled",
          items: [makeItem({ bookId: "c", cancelledAt: NOW, price: 900 })],
        }),
      ].map((record) => classifyOrder({ includeCancelled: false, record })),
    });

    expect(snapshot.buckets).toEqual([
      {
        booksCount: 1,
        key: "0_7",
        ordersCount: 1,
        shipmentsCount: 0,
        totalsByCurrency: [{ currency: "UAH", total: 200 }],
      },
    ]);
  });

  it("keeps each currency separate and never adds them together", () => {
    const snapshot = buildActiveMoneyAge({
      now: NOW,
      orders: [
        makeOrder({ id: "uah", items: [makeItem({ bookId: "a", price: 900 })] }),
        makeOrder({ currency: "USD", id: "usd", items: [makeItem({ bookId: "b", price: 30 })] }),
      ].map((record) => classifyOrder({ includeCancelled: false, record })),
    });

    expect(snapshot.buckets.at(0)?.totalsByCurrency).toEqual([
      { currency: "UAH", total: 900 },
      { currency: "USD", total: 30 },
    ]);
  });

  it("counts an active shipment only while it still carries an active book", () => {
    const snapshot = buildActiveMoneyAge({
      now: NOW,
      orders: [
        makeOrder({
          items: [makeItem({ bookId: "a", price: 200, shipmentId: "s-1" })],
          shipments: [{ cancelledAt: null, id: "s-1", receivedAt: null, status: "in_transit" }],
        }),
      ].map((record) => classifyOrder({ includeCancelled: false, record })),
    });

    expect(snapshot.buckets.at(0)?.shipmentsCount).toBe(1);
  });

  it("reports the injected clock as asOf so the snapshot is reproducible", () => {
    const snapshot = buildActiveMoneyAge({ now: NOW, orders: [] });

    expect(snapshot).toEqual({ asOf: "2026-08-20T09:15:00.000Z", buckets: [] });
  });

  it("orders buckets youngest first so the frontend renders them without sorting", () => {
    expect(
      bucketsOf([
        makeOrder({ id: "old", orderDate: subDays(NOW, 40) }),
        makeOrder({ id: "young", orderDate: subDays(NOW, 2) }),
        makeOrder({ id: "middle", orderDate: subDays(NOW, 20) }),
      ]),
    ).toEqual(["0_7", "15_30", "31_plus"]);
  });
});
