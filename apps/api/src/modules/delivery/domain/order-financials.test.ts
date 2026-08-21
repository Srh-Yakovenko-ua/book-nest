import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { OrderFinancials, OrderFinancialsItem } from "./order-financials.js";

import { resolveOrderFinancials } from "./order-financials.js";

type FinancialsCase = {
  countedItems: OrderFinancialsItem[];
  deliveryPrice: Nullable<number>;
  discount: Nullable<number>;
  expected: OrderFinancials;
  name: string;
  totalAmount: Nullable<number>;
};

const LIVE_BOOK_PRICE = 300;
const CANCELLED_BOOK_PRICE = 200;
const DELIVERY_PRICE = 50;

function priced(prices: Nullable<number>[]): OrderFinancialsItem[] {
  return prices.map((price) => ({ price }));
}

const ITEMS_INCLUDING_CANCELLED = priced([LIVE_BOOK_PRICE, CANCELLED_BOOK_PRICE]);
const ITEMS_EXCLUDING_CANCELLED = priced([LIVE_BOOK_PRICE]);
const ITEMS_LEFT_AFTER_EXCLUDING_EVERY_CANCELLED_BOOK = priced([]);

const FINANCIALS_CASES: FinancialsCase[] = [
  {
    countedItems: priced([300, 200]),
    deliveryPrice: 50,
    discount: null,
    expected: {
      componentSubtotal: 500,
      effectiveTotalAmount: 550,
      reconciliationAdjustment: 0,
      source: "manual",
    },
    name: "an explicit total that matches its components reconciles to zero",
    totalAmount: 550,
  },
  {
    countedItems: priced([300, null]),
    deliveryPrice: 50,
    discount: null,
    expected: {
      componentSubtotal: null,
      effectiveTotalAmount: 550,
      reconciliationAdjustment: null,
      source: "manual",
    },
    name: "an explicit total stands even when one book has no price, and the subtotal stays unknown",
    totalAmount: 550,
  },
  {
    countedItems: priced([300, 200]),
    deliveryPrice: 50,
    discount: null,
    expected: {
      componentSubtotal: 500,
      effectiveTotalAmount: 550,
      reconciliationAdjustment: 0,
      source: "calculated",
    },
    name: "without an explicit total the books and the delivery add up to the calculated total",
    totalAmount: null,
  },
  {
    countedItems: priced([300, null]),
    deliveryPrice: 50,
    discount: null,
    expected: {
      componentSubtotal: null,
      effectiveTotalAmount: null,
      reconciliationAdjustment: null,
      source: "unknown",
    },
    name: "without an explicit total a single unpriced book leaves the whole order unknown",
    totalAmount: null,
  },
  {
    countedItems: priced([300, 200]),
    deliveryPrice: null,
    discount: null,
    expected: {
      componentSubtotal: 500,
      effectiveTotalAmount: 0,
      reconciliationAdjustment: -500,
      source: "free",
    },
    name: "an explicit zero reads as a free order and records the priced books it overrode",
    totalAmount: 0,
  },
  {
    countedItems: priced([300]),
    deliveryPrice: null,
    discount: 300,
    expected: {
      componentSubtotal: 300,
      effectiveTotalAmount: 0,
      reconciliationAdjustment: 0,
      source: "free",
    },
    name: "an order discounted down to nothing reads as free just like an explicit zero",
    totalAmount: null,
  },
  {
    countedItems: priced([0]),
    deliveryPrice: 50,
    discount: null,
    expected: {
      componentSubtotal: 0,
      effectiveTotalAmount: 50,
      reconciliationAdjustment: 0,
      source: "calculated",
    },
    name: "an order of free books still costs its delivery",
    totalAmount: null,
  },
  {
    countedItems: priced([300, 200]),
    deliveryPrice: 50,
    discount: 120,
    expected: {
      componentSubtotal: 500,
      effectiveTotalAmount: 430,
      reconciliationAdjustment: 0,
      source: "calculated",
    },
    name: "a discount comes off the total after the delivery is added",
    totalAmount: null,
  },
  {
    countedItems: priced([0.1, 0.2]),
    deliveryPrice: null,
    discount: null,
    expected: {
      componentSubtotal: 0.3,
      effectiveTotalAmount: 0.3,
      reconciliationAdjustment: 0,
      source: "calculated",
    },
    name: "two cent amounts add up in minor units instead of drifting by a fraction",
    totalAmount: null,
  },
];

describe("resolveOrderFinancials", () => {
  it.each(FINANCIALS_CASES)(
    "$name",
    ({ countedItems, deliveryPrice, discount, expected, totalAmount }) => {
      expect(
        resolveOrderFinancials({ countedItems, deliveryPrice, discount, totalAmount }),
      ).toEqual(expected);
    },
  );

  it("keeps an explicit total that disagrees with its components and reports the gap instead of failing", () => {
    const resolve = (): OrderFinancials =>
      resolveOrderFinancials({
        countedItems: priced([300, 200]),
        deliveryPrice: 50,
        discount: null,
        totalAmount: 600,
      });

    expect(resolve).not.toThrow();
    expect(resolve()).toEqual({
      componentSubtotal: 500,
      effectiveTotalAmount: 600,
      reconciliationAdjustment: 50,
      source: "manual",
    });
  });

  it("drops a cancelled book out of the calculated total once its caller stops counting it", () => {
    const withCancelled = resolveOrderFinancials({
      countedItems: ITEMS_INCLUDING_CANCELLED,
      deliveryPrice: DELIVERY_PRICE,
      discount: null,
      totalAmount: null,
    });
    const withoutCancelled = resolveOrderFinancials({
      countedItems: ITEMS_EXCLUDING_CANCELLED,
      deliveryPrice: DELIVERY_PRICE,
      discount: null,
      totalAmount: null,
    });

    expect(withCancelled).toEqual({
      componentSubtotal: 500,
      effectiveTotalAmount: 550,
      reconciliationAdjustment: 0,
      source: "calculated",
    });
    expect(withoutCancelled).toEqual({
      componentSubtotal: 300,
      effectiveTotalAmount: 350,
      reconciliationAdjustment: 0,
      source: "calculated",
    });
  });

  it("treats a manual total as order level truth: dropping a cancelled book infers no refund and only widens the reconciliation gap", () => {
    const withCancelled = resolveOrderFinancials({
      countedItems: ITEMS_INCLUDING_CANCELLED,
      deliveryPrice: DELIVERY_PRICE,
      discount: null,
      totalAmount: 550,
    });
    const withoutCancelled = resolveOrderFinancials({
      countedItems: ITEMS_EXCLUDING_CANCELLED,
      deliveryPrice: DELIVERY_PRICE,
      discount: null,
      totalAmount: 550,
    });

    expect(withCancelled).toEqual({
      componentSubtotal: 500,
      effectiveTotalAmount: 550,
      reconciliationAdjustment: 0,
      source: "manual",
    });
    expect(withoutCancelled).toEqual({
      componentSubtotal: 300,
      effectiveTotalAmount: 550,
      reconciliationAdjustment: 200,
      source: "manual",
    });
  });

  it("counts every book of a fully cancelled order while its caller still includes cancelled books", () => {
    expect(
      resolveOrderFinancials({
        countedItems: ITEMS_INCLUDING_CANCELLED,
        deliveryPrice: DELIVERY_PRICE,
        discount: null,
        totalAmount: null,
      }),
    ).toEqual({
      componentSubtotal: 500,
      effectiveTotalAmount: 550,
      reconciliationAdjustment: 0,
      source: "calculated",
    });
  });

  it("resolves a fully cancelled order down to its delivery alone once its caller excludes every book", () => {
    expect(
      resolveOrderFinancials({
        countedItems: ITEMS_LEFT_AFTER_EXCLUDING_EVERY_CANCELLED_BOOK,
        deliveryPrice: DELIVERY_PRICE,
        discount: null,
        totalAmount: null,
      }),
    ).toEqual({
      componentSubtotal: 0,
      effectiveTotalAmount: 50,
      reconciliationAdjustment: 0,
      source: "calculated",
    });
  });
});
