import {
  CreateBookOrderInputSchema,
  ORDER_FINANCIAL_MESSAGES,
  resolveOrderFinancials,
  validateOrderInvariant,
} from "@app/shared";
import { describe, expect, it } from "vitest";

const BOOK_ID = "11111111-1111-4111-8111-111111111111";

function parseOrder(overrides: Record<string, unknown>) {
  return CreateBookOrderInputSchema.safeParse({
    currency: "UAH",
    items: [{ bookId: BOOK_ID, price: 500 }],
    storeName: "Yakaboo",
    ...overrides,
  });
}

describe("resolveOrderFinancials", () => {
  it("calculates a complete item breakdown", () => {
    expect(resolveOrderFinancials({ itemPrices: [500, 600, 800] })).toMatchObject({
      effectiveTotalAmount: 1900,
      isItemBreakdownComplete: true,
      itemsSubtotal: 1900,
      totalSource: "calculated",
    });
  });

  it("includes delivery and subtracts discount using money precision", () => {
    expect(
      resolveOrderFinancials({ deliveryPrice: 100, discount: 200, itemPrices: [500, 600, 800] }),
    ).toMatchObject({ effectiveTotalAmount: 1800, totalSource: "calculated" });
    expect(resolveOrderFinancials({ itemPrices: [0.1, 0.2] }).effectiveTotalAmount).toBe(0.3);
  });

  it("uses a manual total when the item breakdown is incomplete", () => {
    expect(
      resolveOrderFinancials({ itemPrices: [500, null, 800], totalAmount: 1500 }),
    ).toMatchObject({
      effectiveTotalAmount: 1500,
      isItemBreakdownComplete: false,
      pricedItemsCount: 2,
      totalSource: "manual",
    });
  });

  it("keeps an incomplete order without a manual total unknown", () => {
    expect(resolveOrderFinancials({ itemPrices: [null, null] })).toMatchObject({
      effectiveTotalAmount: null,
      totalSource: "unknown",
    });
  });

  it("reads a free order as costing exactly nothing", () => {
    expect(resolveOrderFinancials({ isFree: true, itemPrices: [null, null] })).toMatchObject({
      effectiveTotalAmount: 0,
      isItemBreakdownComplete: false,
      totalSource: "free",
    });
  });

  it("rejects a conflicting client total for a complete breakdown", () => {
    expect(
      parseOrder({
        deliveryPrice: 100,
        discount: 200,
        items: [
          { bookId: BOOK_ID, price: 500 },
          { bookId: "22222222-2222-4222-8222-222222222222", price: 600 },
          { bookId: "33333333-3333-4333-8333-333333333333", price: 800 },
        ],
        totalAmount: 200,
      }).success,
    ).toBe(false);
  });

  it("rejects a discount that makes the calculated total negative", () => {
    expect(parseOrder({ discount: 501 }).success).toBe(false);
  });
});

describe("validateOrderInvariant", () => {
  it("accepts a paid order whose books add up to a positive total", () => {
    expect(validateOrderInvariant({ currency: "UAH", itemPrices: [500, 600] })).toMatchObject({
      error: null,
    });
  });

  it("accepts a free order that carries no amount at all", () => {
    expect(validateOrderInvariant({ currency: "UAH", isFree: true, itemPrices: [null] })).toEqual({
      error: null,
      summary: expect.objectContaining({ effectiveTotalAmount: 0, totalSource: "free" }),
    });
  });

  it("refuses an order whose total nobody can work out", () => {
    expect(validateOrderInvariant({ currency: "UAH", itemPrices: [500, null] }).error).toBe(
      ORDER_FINANCIAL_MESSAGES.unknownTotal,
    );
  });

  it("refuses an order that names no currency", () => {
    expect(validateOrderInvariant({ itemPrices: [500] }).error).toBe(
      ORDER_FINANCIAL_MESSAGES.currencyRequired,
    );
  });

  it("refuses a paid order that adds up to nothing", () => {
    expect(validateOrderInvariant({ currency: "UAH", itemPrices: [0] }).error).toBe(
      ORDER_FINANCIAL_MESSAGES.paidOrderNeedsPositiveTotal,
    );
  });

  it("refuses a free order that still carries a price, a delivery cost or a discount", () => {
    for (const carried of [
      { itemPrices: [500] },
      { deliveryPrice: 80, itemPrices: [null] },
      { discount: 20, itemPrices: [null] },
      { itemPrices: [null], totalAmount: 0 },
    ]) {
      expect(validateOrderInvariant({ currency: "UAH", isFree: true, ...carried }).error).toBe(
        ORDER_FINANCIAL_MESSAGES.freeOrderCarriesAmounts,
      );
    }
  });

  it("keeps free books with a paid delivery on the ordinary paid path", () => {
    expect(
      validateOrderInvariant({ currency: "UAH", deliveryPrice: 80, itemPrices: [0] }),
    ).toMatchObject({ error: null, summary: { effectiveTotalAmount: 80 } });
  });
});

describe("CreateBookOrderInputSchema under the order invariant", () => {
  it("refuses an order with neither a total nor a full price breakdown", () => {
    expect(parseOrder({ items: [{ bookId: BOOK_ID }] }).success).toBe(false);
  });

  it("refuses an order that names no currency", () => {
    expect(
      CreateBookOrderInputSchema.safeParse({
        items: [{ bookId: BOOK_ID, price: 500 }],
        storeName: "Yakaboo",
      }).success,
    ).toBe(false);
  });

  it("accepts a free order and defaults every other order to paid", () => {
    expect(parseOrder({ isFree: true, items: [{ bookId: BOOK_ID }] }).success).toBe(true);
    expect(parseOrder({}).data?.isFree).toBe(false);
  });
});
