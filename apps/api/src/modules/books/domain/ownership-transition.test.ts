import { describe, expect, it } from "vitest";

import { computeOwnershipChange } from "./ownership-transition.js";

const DATE = "2026-02-01";
const PARSED_DATE = new Date("2026-02-01T00:00:00.000Z");
const NOW = new Date("2026-02-01T09:15:00.000Z");

describe("computeOwnershipChange mark-owned", () => {
  it("sets the ownership status to owned and deletes any purchase row", () => {
    const patch = computeOwnershipChange({ current: "none", kind: "mark-owned", now: NOW });

    expect(patch).toEqual({ book: { ownershipStatus: "owned" }, purchaseInfo: "delete" });
  });
});

describe("computeOwnershipChange remove-owned", () => {
  it("sets the ownership status back to none and deletes the purchase row", () => {
    const patch = computeOwnershipChange({ current: "owned", kind: "remove-owned", now: NOW });

    expect(patch).toEqual({ book: { ownershipStatus: "none" }, purchaseInfo: "delete" });
  });
});

describe("computeOwnershipChange remove-from-wishlist", () => {
  it("sets the ownership status back to none and deletes the purchase row like remove-owned", () => {
    const patch = computeOwnershipChange({
      current: "want_to_buy",
      kind: "remove-from-wishlist",
      now: NOW,
    });

    expect(patch).toEqual(
      computeOwnershipChange({ current: "want_to_buy", kind: "remove-owned", now: NOW }),
    );
    expect(patch).toEqual({
      book: { ownershipStatus: "none", wishlistAddedAt: null },
      purchaseInfo: "delete",
    });
  });
});

describe("computeOwnershipChange mark-bought", () => {
  it("sets ownership to owned and stamps the purchase date without touching other fields", () => {
    const patch = computeOwnershipChange({
      current: "want_to_buy",
      date: DATE,
      fields: {},
      kind: "mark-bought",
      now: NOW,
    });

    expect(patch).toEqual({
      book: { ownershipStatus: "owned", wishlistAddedAt: null },
      purchaseInfo: { purchasedAt: PARSED_DATE },
    });
  });

  it("carries store, price, and currency alongside the purchase date and no other keys", () => {
    const patch = computeOwnershipChange({
      current: "want_to_buy",
      date: DATE,
      fields: { currency: "UAH", expectedPrice: 249.5, storeName: "Yakaboo" },
      kind: "mark-bought",
      now: NOW,
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
      current: "want_to_buy",
      date: DATE,
      fields: { currency: null, expectedPrice: null, storeName: null },
      kind: "mark-bought",
      now: NOW,
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
      current: "want_to_buy",
      date: DATE,
      fields: { currency: "EUR" },
      kind: "mark-bought",
      now: NOW,
    });

    expect(patch.purchaseInfo).toEqual({ currency: "EUR", purchasedAt: PARSED_DATE });
  });
});

describe("computeOwnershipChange want-to-buy", () => {
  it("only sets the ownership status and leaves purchase info alone", () => {
    const patch = computeOwnershipChange({ current: "none", kind: "want-to-buy", now: NOW });

    expect(patch).toEqual({ book: { ownershipStatus: "want_to_buy", wishlistAddedAt: NOW } });
  });

  it("does not stamp a purchase date", () => {
    const patch = computeOwnershipChange({ current: "none", kind: "want-to-buy", now: NOW });

    expect(patch.purchaseInfo).toBeUndefined();
  });
});

describe("computeOwnershipChange wishlist stamp", () => {
  it("stamps the wishlist date when the transition enters want_to_buy", () => {
    const patch = computeOwnershipChange({ current: "none", kind: "want-to-buy", now: NOW });

    expect(patch.book).toEqual({ ownershipStatus: "want_to_buy", wishlistAddedAt: NOW });
  });

  it("clears the wishlist date when the transition leaves want_to_buy", () => {
    const patch = computeOwnershipChange({ current: "want_to_buy", kind: "mark-owned", now: NOW });

    expect(patch.book).toEqual({ ownershipStatus: "owned", wishlistAddedAt: null });
  });

  it("omits the wishlist date when the transition neither enters nor leaves want_to_buy", () => {
    const patch = computeOwnershipChange({ current: "owned", kind: "remove-owned", now: NOW });

    expect(patch.book).not.toHaveProperty("wishlistAddedAt");
  });
});
