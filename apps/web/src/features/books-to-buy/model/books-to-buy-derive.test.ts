import type { WishlistBookView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { deriveWishlistBestOffers } from "./books-to-buy-derive";
import { makeStoreLink, makeWishlistBook } from "./books-to-buy.fixtures";

function offerBook({
  createdAt = "2026-03-01T00:00:00.000Z",
  price,
  title,
  wishlistAddedAt = null,
}: {
  createdAt?: string;
  price: null | number;
  title: string;
  wishlistAddedAt?: null | string;
}): WishlistBookView {
  return makeWishlistBook({
    bestOffer: price === null ? null : { currency: "UAH", price },
    createdAt,
    id: title,
    storeLinks: price === null ? [] : [makeStoreLink({ id: `link-${title}`, price })],
    title,
    wishlistAddedAt,
  });
}

describe("deriveWishlistBestOffers", () => {
  it("orders the offers from the cheapest to the most expensive", () => {
    const offers = deriveWishlistBestOffers([
      offerBook({ price: 900, title: "Дорога" }),
      offerBook({ price: 100, title: "Дешева" }),
    ]);

    expect(offers.map((offer) => offer.title)).toEqual(["Дешева", "Дорога"]);
  });

  it("skips books that have no best offer", () => {
    const offers = deriveWishlistBestOffers([
      offerBook({ price: null, title: "Без ціни" }),
      offerBook({ price: 100, title: "Дешева" }),
    ]);

    expect(offers.map((offer) => offer.title)).toEqual(["Дешева"]);
  });

  it("names the store that holds the best offer", () => {
    const book = makeWishlistBook({
      bestOffer: { currency: "UAH", price: 300 },
      storeLinks: [
        makeStoreLink({ id: "expensive", price: 500, storeName: "Yakaboo" }),
        makeStoreLink({ id: "cheap", price: 300, storeName: "Книгарня Є" }),
      ],
    });

    expect(deriveWishlistBestOffers([book])[0]?.storeName).toBe("Книгарня Є");
  });

  it("leaves the store unnamed when no link carries the best offer price", () => {
    const book = makeWishlistBook({
      bestOffer: { currency: "USD", price: 12 },
      storeLinks: [makeStoreLink({ id: "uah", price: 300, storeName: "Yakaboo" })],
    });

    expect(deriveWishlistBestOffers([book])[0]?.storeName).toBeNull();
  });
});
