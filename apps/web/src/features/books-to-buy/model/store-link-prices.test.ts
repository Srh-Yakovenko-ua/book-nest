import { describe, expect, it } from "vitest";

import { makeStoreLink } from "./books-to-buy.fixtures";
import { hasMultipleCurrencies, sortStoreLinksByPrice } from "./store-link-prices";

describe("sortStoreLinksByPrice", () => {
  it("puts the cheaper link of the same currency first", () => {
    const sorted = sortStoreLinksByPrice([
      makeStoreLink({ id: "pricey", price: 512 }),
      makeStoreLink({ id: "cheap", price: 449 }),
    ]);

    expect(sorted.map((link) => link.id)).toEqual(["cheap", "pricey"]);
  });

  it("keeps currencies in groups instead of comparing them by number", () => {
    const sorted = sortStoreLinksByPrice([
      makeStoreLink({ currency: "USD", id: "usd", price: 9 }),
      makeStoreLink({ currency: "EUR", id: "eur", price: 12 }),
      makeStoreLink({ currency: "UAH", id: "uah", price: 390 }),
    ]);

    expect(sorted.map((link) => link.id)).toEqual(["uah", "eur", "usd"]);
  });

  it("sends the links without a price to the end, oldest first", () => {
    const sorted = sortStoreLinksByPrice([
      makeStoreLink({
        createdAt: "2026-03-05T10:00:00.000Z",
        currency: null,
        id: "newer",
        price: null,
      }),
      makeStoreLink({
        createdAt: "2026-03-01T10:00:00.000Z",
        currency: null,
        id: "older",
        price: null,
      }),
      makeStoreLink({ id: "priced", price: 449 }),
    ]);

    expect(sorted.map((link) => link.id)).toEqual(["priced", "older", "newer"]);
  });

  it("breaks a price tie by the earlier link", () => {
    const sorted = sortStoreLinksByPrice([
      makeStoreLink({ createdAt: "2026-03-05T10:00:00.000Z", id: "later", price: 449 }),
      makeStoreLink({ createdAt: "2026-03-01T10:00:00.000Z", id: "earlier", price: 449 }),
    ]);

    expect(sorted.map((link) => link.id)).toEqual(["earlier", "later"]);
  });

  it("leaves the given array untouched", () => {
    const storeLinks = [
      makeStoreLink({ id: "pricey", price: 512 }),
      makeStoreLink({ id: "cheap", price: 449 }),
    ];

    sortStoreLinksByPrice(storeLinks);

    expect(storeLinks.map((link) => link.id)).toEqual(["pricey", "cheap"]);
  });
});

describe("hasMultipleCurrencies", () => {
  it("sees a single currency across the priced links", () => {
    expect(
      hasMultipleCurrencies([
        makeStoreLink({ id: "a", price: 449 }),
        makeStoreLink({ id: "b", price: 512 }),
      ]),
    ).toBe(false);
  });

  it("spots prices quoted in more than one currency", () => {
    expect(
      hasMultipleCurrencies([
        makeStoreLink({ currency: "UAH", id: "a", price: 449 }),
        makeStoreLink({ currency: "EUR", id: "b", price: 12 }),
      ]),
    ).toBe(true);
  });

  it("ignores the links that carry no price at all", () => {
    expect(
      hasMultipleCurrencies([
        makeStoreLink({ currency: "UAH", id: "a", price: 449 }),
        makeStoreLink({ currency: null, id: "b", price: null }),
      ]),
    ).toBe(false);
  });
});
