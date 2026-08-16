import { CreateBookOrderInputSchema, resolveOrderFinancials } from "@app/shared";
import { describe, expect, it } from "vitest";

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

  it("rejects a conflicting client total for a complete breakdown", () => {
    expect(
      CreateBookOrderInputSchema.safeParse({
        deliveryPrice: 100,
        discount: 200,
        items: [
          { bookId: "11111111-1111-4111-8111-111111111111", price: 500 },
          { bookId: "22222222-2222-4222-8222-222222222222", price: 600 },
          { bookId: "33333333-3333-4333-8333-333333333333", price: 800 },
        ],
        storeName: "Yakaboo",
        totalAmount: 200,
      }).success,
    ).toBe(false);
  });

  it("rejects a discount that makes the calculated total negative", () => {
    expect(
      CreateBookOrderInputSchema.safeParse({
        discount: 501,
        items: [{ bookId: "11111111-1111-4111-8111-111111111111", price: 500 }],
        storeName: "Yakaboo",
      }).success,
    ).toBe(false);
  });
});
