import { describe, expect, it } from "vitest";

import type { ClassifiedOrder, OrderStatisticsItemRecord } from "./statistics-scope.js";

import { classifyOrder } from "./statistics-scope.js";
import {
  buildBestValueStoreByCurrency,
  buildStoreScorecards,
  buildStoreSpendGrowth,
} from "./statistics-stores.js";

const ORDER_DATE = new Date("2026-03-04T00:00:00.000Z");

let orderSequence = 0;

function makeItem(price: null | number, bookId: string): OrderStatisticsItemRecord {
  return {
    bookId,
    bookTitle: "Book",
    cancelledAt: null,
    id: `item-${bookId}`,
    price,
    receivedAt: null,
    shipmentId: null,
  };
}

function orderOf({
  currency = "UAH",
  prices,
  storeName,
  totalAmount = null,
}: {
  currency?: "EUR" | "UAH" | "USD";
  prices: (null | number)[];
  storeName: string;
  totalAmount?: null | number;
}): ClassifiedOrder {
  orderSequence += 1;
  const id = `order-${orderSequence}`;
  return classifyOrder({
    includeCancelled: false,
    record: {
      currency,
      deliveryPrice: null,
      discount: null,
      id,
      items: prices.map((price, index) => makeItem(price, `${id}-book-${index}`)),
      orderDate: ORDER_DATE,
      orderNumber: null,
      shipments: [],
      storeName,
      totalAmount,
    },
  });
}

describe("buildStoreScorecards", () => {
  it("keeps two currencies of one store on separate scales", () => {
    const [card] = buildStoreScorecards([
      orderOf({ prices: [300], storeName: "Yakaboo" }),
      orderOf({ currency: "USD", prices: [40], storeName: "Yakaboo" }),
    ]);

    expect(card?.totalsByCurrency).toEqual([
      { currency: "UAH", total: 300 },
      { currency: "USD", total: 40 },
    ]);
    expect(card?.averageLandedBookCostByCurrency).toEqual([
      { average: 300, currency: "UAH" },
      { average: 40, currency: "USD" },
    ]);
  });

  it("counts a book whose price was never entered without pretending to know its landed cost", () => {
    const [card] = buildStoreScorecards([
      orderOf({ prices: [300, null], storeName: "Yakaboo", totalAmount: 700 }),
    ]);

    expect({
      booksCount: card?.booksCount,
      coverage: card?.landedCoverageByCurrency,
      landed: card?.averageLandedBookCostByCurrency,
    }).toEqual({
      booksCount: 2,
      coverage: [
        { countedBooksCount: 2, coveragePercent: 0, currency: "UAH", eligibleBooksCount: 0 },
      ],
      landed: [],
    });
  });

  it("averages books per order and leaves a store with no order out entirely", () => {
    const cards = buildStoreScorecards([
      orderOf({ prices: [100, 200, 300], storeName: "Yakaboo" }),
      orderOf({ prices: [100], storeName: "Yakaboo" }),
      orderOf({ prices: [50], storeName: "   " }),
    ]);

    expect(cards.map((card) => ({ avg: card.averageBooksPerOrder, store: card.store }))).toEqual([
      { avg: 2, store: "Yakaboo" },
    ]);
  });
});

describe("buildBestValueStoreByCurrency", () => {
  it("refuses to crown a store on the strength of a single book", () => {
    expect(buildBestValueStoreByCurrency([orderOf({ prices: [100], storeName: "Solo" })])).toEqual(
      [],
    );
  });

  it("picks the cheapest landed cost once a store has a real sample", () => {
    const winners = buildBestValueStoreByCurrency([
      orderOf({ prices: [100, 100], storeName: "Cheap" }),
      orderOf({ prices: [900, 900], storeName: "Pricey" }),
    ]);

    expect(winners).toEqual([
      { averageLandedBookCost: 100, currency: "UAH", eligibleBooksCount: 2, store: "Cheap" },
    ]);
  });

  it("breaks a dead heat by the bigger sample, never by chance", () => {
    const winners = buildBestValueStoreByCurrency([
      orderOf({ prices: [100, 100], storeName: "Small Sample" }),
      orderOf({ prices: [100, 100, 100, 100], storeName: "Big Sample" }),
    ]);

    expect(winners.map((winner) => winner.store)).toEqual(["Big Sample"]);
  });

  it("crowns one winner per currency and never one across them", () => {
    const winners = buildBestValueStoreByCurrency([
      orderOf({ prices: [100, 100], storeName: "Hryvnia Shop" }),
      orderOf({ currency: "USD", prices: [3, 3], storeName: "Dollar Shop" }),
    ]);

    expect(winners.map((winner) => ({ currency: winner.currency, store: winner.store }))).toEqual([
      { currency: "UAH", store: "Hryvnia Shop" },
      { currency: "USD", store: "Dollar Shop" },
    ]);
  });
});

describe("buildStoreSpendGrowth", () => {
  it("ranks the biggest riser first and ignores stores that shrank", () => {
    const growth = buildStoreSpendGrowth({
      current: [
        orderOf({ prices: [1000], storeName: "Riser" }),
        orderOf({ prices: [100], storeName: "Faller" }),
      ],
      previous: [
        orderOf({ prices: [200], storeName: "Riser" }),
        orderOf({ prices: [900], storeName: "Faller" }),
      ],
    });

    expect(growth.map((row) => ({ delta: row.absoluteDelta, store: row.store }))).toEqual([
      { delta: 800, store: "Riser" },
    ]);
  });

  it("stays silent about a brand new store, having nothing to measure its growth against", () => {
    const growth = buildStoreSpendGrowth({
      current: [orderOf({ prices: [500], storeName: "Newcomer" })],
      previous: [],
    });

    expect(growth).toEqual([]);
  });

  it("never reads a jump from hryvnia to dollars as growth", () => {
    const growth = buildStoreSpendGrowth({
      current: [orderOf({ currency: "USD", prices: [50], storeName: "Yakaboo" })],
      previous: [orderOf({ prices: [5000], storeName: "Yakaboo" })],
    });

    expect(growth).toEqual([]);
  });
});
