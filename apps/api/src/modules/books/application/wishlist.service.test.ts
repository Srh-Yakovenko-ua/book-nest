import type { BookView } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { BookStoreLinkModel } from "../../../generated/prisma/models.js";
import type { BooksRepository, WishlistBookRow } from "../infrastructure/books.repository.js";
import type { BookViewAssembler } from "./book-view-assembler.js";

import { Prisma } from "../../../generated/prisma/client.js";
import { WishlistService } from "./wishlist.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = new Date("2026-02-01T10:00:00.000Z");

function makeLink(overrides: Partial<BookStoreLinkModel> = {}): BookStoreLinkModel {
  return {
    bookId: "book-a",
    createdAt: CREATED_AT,
    currency: "UAH",
    id: "link-id",
    price: new Prisma.Decimal("199.50"),
    storeName: "Yakaboo",
    updatedAt: CREATED_AT,
    url: "https://yakaboo.ua/book",
    userId: USER_ID,
    ...overrides,
  };
}

function makeRow(id: string, storeLinks: BookStoreLinkModel[]): WishlistBookRow {
  return { id, storeLinks } as unknown as WishlistBookRow;
}

function setup(rows: WishlistBookRow[]) {
  const listWishlistBooks = vi.fn().mockResolvedValue(rows);
  const booksRepository = { listWishlistBooks } as unknown as BooksRepository;
  const viewOf = vi.fn((row: WishlistBookRow) => ({ id: row.id }) as unknown as BookView);
  const bookViewAssembler = { viewOf } as unknown as BookViewAssembler;
  const service = new WishlistService(booksRepository, bookViewAssembler);

  return { booksRepository, bookViewAssembler, listWishlistBooks, service, viewOf };
}

describe("WishlistService.getWishlist", () => {
  it("enriches each book with its store links and best offer", async () => {
    const rows = [
      makeRow("book-a", [
        makeLink({ bookId: "book-a", id: "a-1", price: new Prisma.Decimal("349.00") }),
        makeLink({
          bookId: "book-a",
          id: "a-2",
          price: new Prisma.Decimal("199.50"),
          storeName: "Book24",
          url: "https://book24.ua/a",
        }),
      ]),
      makeRow("book-b", [
        makeLink({
          bookId: "book-b",
          currency: "USD",
          id: "b-1",
          price: new Prisma.Decimal("19.99"),
          storeName: "Amazon",
          url: "https://amazon.com/b",
        }),
      ]),
      makeRow("book-c", [
        makeLink({
          bookId: "book-c",
          id: "c-1",
          price: null,
          storeName: "NoPrice",
          url: "https://nostore.example.com/c",
        }),
      ]),
    ];
    const { service, viewOf } = setup(rows);

    const result = await service.getWishlist({ userId: USER_ID });

    expect(result.books).toHaveLength(3);
    expect(result.books[0]?.id).toBe("book-a");
    expect(result.books[0]?.storeLinks).toHaveLength(2);
    expect(result.books[0]?.bestOffer).toEqual({ currency: "UAH", price: 199.5 });
    expect(result.books[1]?.bestOffer).toEqual({ currency: "USD", price: 19.99 });
    expect(result.books[2]?.bestOffer).toBeNull();
    expect(viewOf).toHaveBeenCalledTimes(3);
  });

  it("builds the per-currency summary from the derived best offers", async () => {
    const rows = [
      makeRow("book-a", [
        makeLink({ bookId: "book-a", id: "a-1", price: new Prisma.Decimal("199.50") }),
      ]),
      makeRow("book-d", [
        makeLink({
          bookId: "book-d",
          id: "d-1",
          price: new Prisma.Decimal("250.50"),
          storeName: "Bookzone",
          url: "https://bookzone.ua/d",
        }),
      ]),
      makeRow("book-b", [
        makeLink({
          bookId: "book-b",
          currency: "USD",
          id: "b-1",
          price: new Prisma.Decimal("19.99"),
          storeName: "Amazon",
          url: "https://amazon.com/b",
        }),
      ]),
      makeRow("book-c", []),
    ];
    const { service } = setup(rows);

    const result = await service.getWishlist({ userId: USER_ID });

    expect(result.summary).toEqual({
      booksCount: 4,
      estimates: [
        { average: 225, best: 199.5, booksCount: 2, currency: "UAH", total: 450 },
        { average: 19.99, best: 19.99, booksCount: 1, currency: "USD", total: 19.99 },
      ],
      trackedStoresCount: 3,
    });
  });

  it("returns an empty wishlist for a user with no want_to_buy books", async () => {
    const { listWishlistBooks, service } = setup([]);

    const result = await service.getWishlist({ userId: USER_ID });

    expect(result).toEqual({
      books: [],
      summary: { booksCount: 0, estimates: [], trackedStoresCount: 0 },
    });
    expect(listWishlistBooks).toHaveBeenCalledWith({ userId: USER_ID });
  });
});
