import { describe, expect, it } from "vitest";

import { computeOwnershipChange } from "./ownership-transition.js";

const DATE = "2026-02-01";
const PARSED_DATE = new Date("2026-02-01T00:00:00.000Z");

describe("computeOwnershipChange mark-owned", () => {
  it("sets the ownership status to owned and deletes any purchase row", () => {
    const patch = computeOwnershipChange({ kind: "mark-owned" });

    expect(patch).toEqual({
      book: { ownershipStatus: "owned", wishlistAddedAt: null },
      purchaseInfo: "delete",
    });
  });
});

describe("computeOwnershipChange remove-owned", () => {
  it("sets the ownership status back to none and deletes the purchase row", () => {
    const patch = computeOwnershipChange({ kind: "remove-owned" });

    expect(patch).toEqual({
      book: { ownershipStatus: "none", wishlistAddedAt: null },
      purchaseInfo: "delete",
    });
  });
});

describe("computeOwnershipChange remove-from-wishlist", () => {
  it("sets the ownership status back to none and deletes the purchase row like remove-owned", () => {
    const patch = computeOwnershipChange({ kind: "remove-from-wishlist" });

    expect(patch).toEqual(computeOwnershipChange({ kind: "remove-owned" }));
    expect(patch).toEqual({
      book: { ownershipStatus: "none", wishlistAddedAt: null },
      purchaseInfo: "delete",
    });
  });
});

describe("computeOwnershipChange mark-bought", () => {
  it("sets ownership to owned and stamps the purchase date without touching other fields", () => {
    const patch = computeOwnershipChange({ date: DATE, fields: {}, kind: "mark-bought" });

    expect(patch).toEqual({
      book: { ownershipStatus: "owned", wishlistAddedAt: null },
      purchaseInfo: { purchasedAt: PARSED_DATE },
    });
  });

  it("carries store, price, and currency alongside the purchase date and no other keys", () => {
    const patch = computeOwnershipChange({
      date: DATE,
      fields: { currency: "UAH", expectedPrice: 249.5, storeName: "Yakaboo" },
      kind: "mark-bought",
    });

    expect(patch.purchaseInfo).toEqual({
      currency: "UAH",
      expectedPrice: 249.5,
      purchasedAt: PARSED_DATE,
      storeName: "Yakaboo",
    });
  });

  it("propagates explicit nulls for the provided fields", () => {
    const patch = computeOwnershipChange({
      date: DATE,
      fields: { currency: null, expectedPrice: null, storeName: null },
      kind: "mark-bought",
    });

    expect(patch.purchaseInfo).toEqual({
      currency: null,
      expectedPrice: null,
      purchasedAt: PARSED_DATE,
      storeName: null,
    });
  });

  it("includes only the single provided field next to the purchase date", () => {
    const patch = computeOwnershipChange({
      date: DATE,
      fields: { currency: "EUR" },
      kind: "mark-bought",
    });

    expect(patch.purchaseInfo).toEqual({ currency: "EUR", purchasedAt: PARSED_DATE });
  });
});

describe("computeOwnershipChange want-to-buy", () => {
  const NOW = new Date("2026-05-01T10:00:00.000Z");

  it("stamps the wishlist entry date and leaves purchase info alone", () => {
    const patch = computeOwnershipChange({ kind: "want-to-buy", now: NOW });

    expect(patch).toEqual({
      book: { ownershipStatus: "want_to_buy", wishlistAddedAt: NOW },
    });
  });

  it("does not stamp a purchase date", () => {
    const patch = computeOwnershipChange({ kind: "want-to-buy", now: NOW });

    expect(patch.purchaseInfo).toBeUndefined();
  });
});
