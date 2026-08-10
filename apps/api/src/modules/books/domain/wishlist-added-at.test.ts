import { describe, expect, it } from "vitest";

import { resolveWishlistAddedAtChange } from "./wishlist-added-at.js";

const NOW = new Date("2026-02-01T10:00:00.000Z");

describe("resolveWishlistAddedAtChange", () => {
  it("stamps the date when a book is created straight into the wishlist", () => {
    expect(resolveWishlistAddedAtChange({ current: null, next: "want_to_buy", now: NOW })).toEqual({
      wishlistAddedAt: NOW,
    });
  });

  it("writes nothing when a book is created outside the wishlist", () => {
    expect(resolveWishlistAddedAtChange({ current: null, next: "owned", now: NOW })).toBeNull();
  });

  it("stamps the date when an unowned book is added to the wishlist", () => {
    expect(
      resolveWishlistAddedAtChange({ current: "none", next: "want_to_buy", now: NOW }),
    ).toEqual({ wishlistAddedAt: NOW });
  });

  it("stamps a fresh date when a cancelled delivery puts the book back on the wishlist", () => {
    expect(
      resolveWishlistAddedAtChange({ current: "in_transit", next: "want_to_buy", now: NOW }),
    ).toEqual({ wishlistAddedAt: NOW });
  });

  it("writes nothing when a wishlist book is edited and stays on the wishlist", () => {
    expect(
      resolveWishlistAddedAtChange({ current: "want_to_buy", next: "want_to_buy", now: NOW }),
    ).toBeNull();
  });

  it("clears the date when a wishlist book is bought", () => {
    expect(
      resolveWishlistAddedAtChange({ current: "want_to_buy", next: "owned", now: NOW }),
    ).toEqual({ wishlistAddedAt: null });
  });

  it("clears the date when a wishlist book is removed from the wishlist", () => {
    expect(
      resolveWishlistAddedAtChange({ current: "want_to_buy", next: "none", now: NOW }),
    ).toEqual({ wishlistAddedAt: null });
  });

  it("clears the date when a wishlist book is ordered", () => {
    expect(
      resolveWishlistAddedAtChange({ current: "want_to_buy", next: "in_transit", now: NOW }),
    ).toEqual({ wishlistAddedAt: null });
  });

  it("clears the date when a wishlist book is borrowed instead of bought", () => {
    expect(
      resolveWishlistAddedAtChange({
        current: "want_to_buy",
        next: "borrowed_from_someone",
        now: NOW,
      }),
    ).toEqual({ wishlistAddedAt: null });
  });

  it("writes nothing for a transition that never involves the wishlist", () => {
    expect(
      resolveWishlistAddedAtChange({ current: "owned", next: "lent_to_someone", now: NOW }),
    ).toBeNull();
  });
});
