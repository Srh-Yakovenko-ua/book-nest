import { describe, expect, it } from "vitest";

import { findBestOfferLinkId } from "./best-offer-link";
import { makeStoreLink } from "./books-to-buy.fixtures";

describe("findBestOfferLinkId", () => {
  it("finds the link whose price and currency carry the best offer", () => {
    const linkId = findBestOfferLinkId({
      bestOffer: { currency: "USD", price: 12 },
      storeLinks: [
        makeStoreLink({ currency: "UAH", id: "uah", price: 12 }),
        makeStoreLink({ currency: "USD", id: "usd", price: 12 }),
      ],
    });

    expect(linkId).toBe("usd");
  });

  it("treats a priced link without a currency as the default UAH", () => {
    const linkId = findBestOfferLinkId({
      bestOffer: { currency: "UAH", price: 450 },
      storeLinks: [makeStoreLink({ currency: null, id: "implicit-uah", price: 450 })],
    });

    expect(linkId).toBe("implicit-uah");
  });

  it("keeps the earliest link when several carry the same best price", () => {
    const linkId = findBestOfferLinkId({
      bestOffer: { currency: "UAH", price: 450 },
      storeLinks: [
        makeStoreLink({ createdAt: "2026-03-01T00:00:00.000Z", id: "first", price: 450 }),
        makeStoreLink({ createdAt: "2026-03-02T00:00:00.000Z", id: "second", price: 450 }),
      ],
    });

    expect(linkId).toBe("first");
  });

  it("ignores links without a price", () => {
    const linkId = findBestOfferLinkId({
      bestOffer: { currency: "UAH", price: 450 },
      storeLinks: [makeStoreLink({ id: "unpriced", price: null })],
    });

    expect(linkId).toBeNull();
  });

  it("finds nothing when no link matches the best offer price", () => {
    const linkId = findBestOfferLinkId({
      bestOffer: { currency: "UAH", price: 450 },
      storeLinks: [makeStoreLink({ id: "other", price: 500 })],
    });

    expect(linkId).toBeNull();
  });

  it("finds nothing when the book has no best offer", () => {
    const linkId = findBestOfferLinkId({
      bestOffer: null,
      storeLinks: [makeStoreLink({ id: "any" })],
    });

    expect(linkId).toBeNull();
  });
});
