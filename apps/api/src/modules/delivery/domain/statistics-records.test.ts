import type {
  BookOrderStatisticsMonth,
  BookOrderStatisticsRecordScope,
  BookOrderStatisticsTopOrder,
  BookOrderStatisticsTopOrdersByCurrency,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import { buildPurchaseRecords } from "./statistics-records.js";
import { classifyOrder } from "./statistics-scope.js";
import { buildStoreScorecards } from "./statistics-stores.js";

const UNFILTERED_SCOPE: BookOrderStatisticsRecordScope = {
  isPeriodFiltered: false,
  isTruncated: false,
  period: { from: null, to: null },
};

function month(overrides: Partial<BookOrderStatisticsMonth> = {}): BookOrderStatisticsMonth {
  return {
    booksCount: 1,
    month: "2026-03",
    ordersCount: 1,
    totalsByCurrency: [{ currency: "UAH", total: 100 }],
    ...overrides,
  };
}

function recordsOf({
  byStore = [],
  monthly = [],
  scope = UNFILTERED_SCOPE,
  topOrdersByCurrency = [],
}: {
  byStore?: ReturnType<typeof buildStoreScorecards>;
  monthly?: BookOrderStatisticsMonth[];
  scope?: BookOrderStatisticsRecordScope;
  topOrdersByCurrency?: BookOrderStatisticsTopOrdersByCurrency;
}) {
  return buildPurchaseRecords({
    byStore,
    includedOrders: [],
    monthly,
    scope,
    topOrdersByCurrency,
  });
}

function storesOf(entries: { prices: number[]; storeName: string }[]) {
  return buildStoreScorecards(
    entries.map((entry, index) =>
      classifyOrder({
        includeCancelled: false,
        record: {
          currency: "UAH",
          deliveryPrice: null,
          discount: null,
          id: `order-${index}`,
          isFree: false,
          items: entry.prices.map((price, itemIndex) => ({
            bookId: `book-${index}-${itemIndex}`,
            bookTitle: "Book",
            cancelledAt: null,
            id: `item-${index}-${itemIndex}`,
            price,
            receivedAt: null,
            shipmentId: null,
          })),
          orderDate: new Date("2026-03-04T00:00:00.000Z"),
          orderNumber: null,
          shipments: [],
          storeName: entry.storeName,
          totalAmount: null,
        },
      }),
    ),
  );
}

function topOrder(
  overrides: Partial<BookOrderStatisticsTopOrder> = {},
): BookOrderStatisticsTopOrder {
  return {
    booksCount: 1,
    currency: "UAH",
    derivedStatus: "active",
    id: "order-1",
    orderDate: "2026-03-04",
    orderNumber: null,
    storeName: "Yakaboo",
    totalAmount: 100,
    ...overrides,
  };
}

describe("buildPurchaseRecords", () => {
  it("finds the priciest month of each currency without ever comparing the two", () => {
    const records = recordsOf({
      monthly: [
        month({
          month: "2026-03",
          totalsByCurrency: [
            { currency: "UAH", total: 900 },
            { currency: "USD", total: 20 },
          ],
        }),
        month({
          month: "2026-04",
          totalsByCurrency: [
            { currency: "UAH", total: 400 },
            { currency: "USD", total: 50 },
          ],
        }),
      ],
    });

    expect(
      records.recordMonthByCurrency.map((record) => ({
        currency: record.currency,
        month: record.month,
        total: record.total,
      })),
    ).toEqual([
      { currency: "UAH", month: "2026-03", total: 900 },
      { currency: "USD", month: "2026-04", total: 50 },
    ]);
  });

  it("settles a tie between two months on the later one, not on iteration order", () => {
    const records = recordsOf({
      monthly: [
        month({ month: "2026-03", totalsByCurrency: [{ currency: "UAH", total: 500 }] }),
        month({ month: "2026-04", totalsByCurrency: [{ currency: "UAH", total: 500 }] }),
      ],
    });

    expect(records.recordMonthByCurrency.map((record) => record.month)).toEqual(["2026-04"]);
  });

  it("takes the largest order of each currency straight off the ranked list", () => {
    const records = recordsOf({
      topOrdersByCurrency: [
        {
          currency: "UAH",
          orders: [
            topOrder({ id: "uah-big", totalAmount: 9000 }),
            topOrder({ id: "uah-small", totalAmount: 100 }),
          ],
        },
        { currency: "USD", orders: [topOrder({ currency: "USD", id: "usd", totalAmount: 40 })] },
      ],
    });

    expect(
      records.largestOrderByCurrency.map((entry) => ({
        currency: entry.currency,
        id: entry.order.id,
      })),
    ).toEqual([
      { currency: "UAH", id: "uah-big" },
      { currency: "USD", id: "usd" },
    ]);
  });

  it("crowns the fullest order across currencies by book count, which carries no money", () => {
    const records = recordsOf({
      topOrdersByCurrency: [
        { currency: "UAH", orders: [topOrder({ booksCount: 2, id: "uah" })] },
        {
          currency: "USD",
          orders: [topOrder({ booksCount: 7, currency: "USD", id: "usd" })],
        },
      ],
    });

    expect(records.mostBooksInOrder?.id).toBe("usd");
  });

  it("reports the busiest store by orders and by books as two separate answers", () => {
    const records = recordsOf({
      byStore: storesOf([
        { prices: [100, 100, 100, 100, 100], storeName: "Bulk Buyer" },
        { prices: [100], storeName: "Frequent" },
        { prices: [100], storeName: "Frequent" },
      ]),
    });

    expect({
      byBooks: records.mostActiveStore.byBooks?.store,
      byOrders: records.mostActiveStore.byOrders?.store,
    }).toEqual({ byBooks: "Bulk Buyer", byOrders: "Frequent" });
  });

  it("has no busiest store to report when nothing was bought", () => {
    const records = recordsOf({});

    expect(records.mostActiveStore).toEqual({ byBooks: null, byOrders: null });
  });

  it("names no best-value store while no book has a landed cost", () => {
    expect(recordsOf({}).bestValueStoreByCurrency).toEqual([]);
  });

  it("carries the truncation and filter scope so nothing can be called an all-time record", () => {
    const scope: BookOrderStatisticsRecordScope = {
      isPeriodFiltered: true,
      isTruncated: true,
      period: { from: "2026-03-01", to: "2026-03-31" },
    };

    expect(recordsOf({ scope }).scope).toEqual(scope);
  });
});
