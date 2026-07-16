import { describe, expect, it } from "vitest";

import type { BookStoreLinkModel } from "../../../generated/prisma/models.js";

import { Prisma } from "../../../generated/prisma/client.js";
import { computeBestOffer } from "./best-offer.js";

const BASE_CREATED_AT = new Date("2026-02-01T10:00:00.000Z");

function makeLink(overrides: Partial<BookStoreLinkModel> = {}): BookStoreLinkModel {
  return {
    bookId: "00000000-0000-4000-8000-00000000b001",
    createdAt: BASE_CREATED_AT,
    currency: null,
    id: "00000000-0000-4000-8000-00000000l001",
    price: null,
    storeName: "Yakaboo",
    updatedAt: BASE_CREATED_AT,
    url: "https://yakaboo.ua/book",
    userId: "00000000-0000-4000-8000-00000000u001",
    ...overrides,
  };
}

describe("computeBestOffer", () => {
  it("returns null for an empty list", () => {
    expect(computeBestOffer({ links: [] })).toBeNull();
  });

  it("returns null when no link has a price", () => {
    const links = [makeLink({ id: "l-1", price: null }), makeLink({ id: "l-2", price: null })];

    expect(computeBestOffer({ links })).toBeNull();
  });

  it("returns the single priced link with its currency", () => {
    const links = [
      makeLink({ currency: "USD", id: "l-1", price: new Prisma.Decimal("19.99") }),
      makeLink({ id: "l-2", price: null }),
    ];

    expect(computeBestOffer({ links })).toEqual({ currency: "USD", price: 19.99 });
  });

  it("picks the cheapest priced link", () => {
    const links = [
      makeLink({ currency: "UAH", id: "l-1", price: new Prisma.Decimal("349.00") }),
      makeLink({ currency: "UAH", id: "l-2", price: new Prisma.Decimal("199.50") }),
      makeLink({ currency: "UAH", id: "l-3", price: new Prisma.Decimal("280.00") }),
    ];

    expect(computeBestOffer({ links })).toEqual({ currency: "UAH", price: 199.5 });
  });

  it("breaks a price tie by the earliest createdAt regardless of input order", () => {
    const links = [
      makeLink({
        createdAt: new Date("2026-02-03T10:00:00.000Z"),
        currency: "EUR",
        id: "l-late",
        price: new Prisma.Decimal("100.00"),
      }),
      makeLink({
        createdAt: new Date("2026-02-01T10:00:00.000Z"),
        currency: "UAH",
        id: "l-early",
        price: new Prisma.Decimal("100.00"),
      }),
    ];

    expect(computeBestOffer({ links })).toEqual({ currency: "UAH", price: 100 });
  });

  it("falls back to UAH when the cheapest priced link has no currency", () => {
    const links = [makeLink({ currency: null, id: "l-1", price: new Prisma.Decimal("42.00") })];

    expect(computeBestOffer({ links })).toEqual({ currency: "UAH", price: 42 });
  });
});
