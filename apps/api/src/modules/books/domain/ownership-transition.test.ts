import { describe, expect, it } from "vitest";

import { computeOwnershipChange } from "./ownership-transition.js";

const DATE = "2026-02-01";
const PARSED_DATE = new Date("2026-02-01T00:00:00.000Z");

describe("computeOwnershipChange mark-owned", () => {
  it("sets the ownership status to owned and deletes any purchase row", () => {
    const patch = computeOwnershipChange({ kind: "mark-owned" });

    expect(patch).toEqual({ book: { ownershipStatus: "owned" }, purchaseInfo: "delete" });
  });
});

describe("computeOwnershipChange remove-owned", () => {
  it("sets the ownership status back to none and deletes the purchase row", () => {
    const patch = computeOwnershipChange({ kind: "remove-owned" });

    expect(patch).toEqual({ book: { ownershipStatus: "none" }, purchaseInfo: "delete" });
  });
});

describe("computeOwnershipChange mark-bought", () => {
  it("sets ownership to owned and stamps the purchase date without touching other fields", () => {
    const patch = computeOwnershipChange({ date: DATE, kind: "mark-bought" });

    expect(patch).toEqual({
      book: { ownershipStatus: "owned" },
      purchaseInfo: { purchasedAt: PARSED_DATE },
    });
  });
});

describe("computeOwnershipChange want-to-buy", () => {
  it("sets ownership to want_to_buy without a purchase patch for empty fields", () => {
    const patch = computeOwnershipChange({ fields: {}, kind: "want-to-buy" });

    expect(patch).toEqual({ book: { ownershipStatus: "want_to_buy" } });
  });

  it("overwrites every purchase field, nulling the ones that were not provided", () => {
    const patch = computeOwnershipChange({
      fields: { storeName: "Yakaboo" },
      kind: "want-to-buy",
    });

    expect(patch).toEqual({
      book: { ownershipStatus: "want_to_buy" },
      purchaseInfo: {
        currency: null,
        expectedPrice: null,
        note: null,
        purchasedAt: null,
        storeName: "Yakaboo",
        storeUrl: null,
      },
    });
  });

  it("carries every provided purchase field into the patch and nulls the purchase date", () => {
    const patch = computeOwnershipChange({
      fields: {
        currency: "UAH",
        expectedPrice: 299.99,
        note: "wishlist",
        storeName: "Yakaboo",
        storeUrl: "https://yakaboo.ua",
      },
      kind: "want-to-buy",
    });

    expect(patch.purchaseInfo).toEqual({
      currency: "UAH",
      expectedPrice: 299.99,
      note: "wishlist",
      purchasedAt: null,
      storeName: "Yakaboo",
      storeUrl: "https://yakaboo.ua",
    });
  });

  it("treats an explicit null field as an overwrite trigger", () => {
    const patch = computeOwnershipChange({
      fields: { note: null },
      kind: "want-to-buy",
    });

    expect(patch.purchaseInfo).toEqual({
      currency: null,
      expectedPrice: null,
      note: null,
      purchasedAt: null,
      storeName: null,
      storeUrl: null,
    });
  });

  it("nulls the purchase date instead of stamping one on want-to-buy", () => {
    const patch = computeOwnershipChange({
      fields: { storeName: "Yakaboo" },
      kind: "want-to-buy",
    });

    expect(patch.purchaseInfo).toMatchObject({ purchasedAt: null });
  });
});
