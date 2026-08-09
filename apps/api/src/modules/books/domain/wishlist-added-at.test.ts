import { describe, expect, it } from "vitest";

import { wishlistAddedAtOnCreate, wishlistAddedAtOnTransition } from "./wishlist-added-at.js";

const NOW = new Date("2026-05-01T10:00:00.000Z");

describe("wishlistAddedAtOnCreate", () => {
  it("stamps a book born in the wishlist", () => {
    expect(wishlistAddedAtOnCreate({ now: NOW, ownershipStatus: "want_to_buy" })).toEqual(NOW);
  });

  it.each(["none", "in_transit", "owned", "borrowed_from_someone", "lent_to_someone"] as const)(
    "leaves a book created as %s without a wishlist date",
    (ownershipStatus) => {
      expect(wishlistAddedAtOnCreate({ now: NOW, ownershipStatus })).toBeNull();
    },
  );
});

describe("wishlistAddedAtOnTransition", () => {
  it("stamps the date when a book enters the wishlist", () => {
    expect(wishlistAddedAtOnTransition({ current: "none", next: "want_to_buy", now: NOW })).toEqual(
      NOW,
    );
  });

  it("stamps a fresh date when a book returns to the wishlist", () => {
    expect(
      wishlistAddedAtOnTransition({ current: "owned", next: "want_to_buy", now: NOW }),
    ).toEqual(NOW);
  });

  it("clears the date when a book leaves the wishlist", () => {
    expect(
      wishlistAddedAtOnTransition({ current: "want_to_buy", next: "owned", now: NOW }),
    ).toBeNull();
  });

  it("keeps the original date when the book stays in the wishlist", () => {
    expect(
      wishlistAddedAtOnTransition({ current: "want_to_buy", next: "want_to_buy", now: NOW }),
    ).toBeUndefined();
  });

  it("stays out of the way for changes that never touch the wishlist", () => {
    expect(
      wishlistAddedAtOnTransition({ current: "owned", next: "lent_to_someone", now: NOW }),
    ).toBeUndefined();
  });
});
