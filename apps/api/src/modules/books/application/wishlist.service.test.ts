import type { BookView, Nullable } from "@app/shared";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { BookStoreLinkModel } from "../../../generated/prisma/models.js";
import type {
  BooksRepository,
  SeriesWishlistAnchorRow,
  WishlistBookRow,
} from "../infrastructure/books.repository.js";
import type { BookViewAssembler } from "./book-view-assembler.js";

import { Prisma } from "../../../generated/prisma/client.js";
import { WishlistService } from "./wishlist.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SERIES_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_SERIES_ID = "66666666-6666-4666-8666-666666666667";
const CREATED_AT = new Date("2026-02-01T10:00:00.000Z");
const NOW = new Date("2026-08-10T12:00:00.000Z");

const EMPTY_COUNTS = {
  addedLast30Days: 0,
  missingFromSeries: { booksCount: 0, seriesCount: 0 },
  nextInSeries: { booksCount: 0, seriesCount: 0 },
  waitingOverSixMonths: 0,
};

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

function makeRow({
  id,
  partNumber = null,
  seriesId = null,
  storeLinks,
  wishlistAddedAt = null,
}: {
  id: string;
  partNumber?: Nullable<number>;
  seriesId?: Nullable<string>;
  storeLinks: BookStoreLinkModel[];
  wishlistAddedAt?: Nullable<Date>;
}): WishlistBookRow {
  return { id, partNumber, seriesId, storeLinks, wishlistAddedAt } as unknown as WishlistBookRow;
}

function setup({
  anchorRows = [],
  rows,
  totalBooksCount = rows.length,
}: {
  anchorRows?: SeriesWishlistAnchorRow[];
  rows: WishlistBookRow[];
  totalBooksCount?: number;
}) {
  const countWishlistBooks = vi.fn().mockResolvedValue(totalBooksCount);
  const listWishlistBooks = vi.fn().mockResolvedValue(rows);
  const listSeriesWishlistAnchors = vi.fn().mockResolvedValue(anchorRows);
  const booksRepository = {
    countWishlistBooks,
    listSeriesWishlistAnchors,
    listWishlistBooks,
  } as unknown as BooksRepository;
  const viewOf = vi.fn((row: WishlistBookRow) => ({ id: row.id }) as unknown as BookView);
  const bookViewAssembler = { viewOf } as unknown as BookViewAssembler;
  const service = new WishlistService(booksRepository, bookViewAssembler);

  return {
    booksRepository,
    bookViewAssembler,
    countWishlistBooks,
    listSeriesWishlistAnchors,
    listWishlistBooks,
    service,
    viewOf,
  };
}

describe("WishlistService.getWishlist", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("enriches each book with its store links and best offer", async () => {
    const rows = [
      makeRow({
        id: "book-a",
        storeLinks: [
          makeLink({ bookId: "book-a", id: "a-1", price: new Prisma.Decimal("349.00") }),
          makeLink({
            bookId: "book-a",
            id: "a-2",
            price: new Prisma.Decimal("199.50"),
            storeName: "Book24",
            url: "https://book24.ua/a",
          }),
        ],
      }),
      makeRow({
        id: "book-b",
        storeLinks: [
          makeLink({
            bookId: "book-b",
            currency: "USD",
            id: "b-1",
            price: new Prisma.Decimal("19.99"),
            storeName: "Amazon",
            url: "https://amazon.com/b",
          }),
        ],
      }),
      makeRow({
        id: "book-c",
        storeLinks: [
          makeLink({
            bookId: "book-c",
            id: "c-1",
            price: null,
            storeName: "NoPrice",
            url: "https://nostore.example.com/c",
          }),
        ],
      }),
    ];
    const { service, viewOf } = setup({ rows });

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
      makeRow({
        id: "book-a",
        storeLinks: [
          makeLink({ bookId: "book-a", id: "a-1", price: new Prisma.Decimal("199.50") }),
        ],
      }),
      makeRow({
        id: "book-d",
        storeLinks: [
          makeLink({
            bookId: "book-d",
            id: "d-1",
            price: new Prisma.Decimal("250.50"),
            storeName: "Bookzone",
            url: "https://bookzone.ua/d",
          }),
        ],
      }),
      makeRow({
        id: "book-b",
        storeLinks: [
          makeLink({
            bookId: "book-b",
            currency: "USD",
            id: "b-1",
            price: new Prisma.Decimal("19.99"),
            storeName: "Amazon",
            url: "https://amazon.com/b",
          }),
        ],
      }),
      makeRow({ id: "book-c", storeLinks: [] }),
    ];
    const { service } = setup({ rows });

    const result = await service.getWishlist({ userId: USER_ID });

    expect(result.summary).toEqual({
      booksCount: 4,
      counts: EMPTY_COUNTS,
      estimates: [
        { average: 225, best: 199.5, booksCount: 2, currency: "UAH", total: 450 },
        { average: 19.99, best: 19.99, booksCount: 1, currency: "USD", total: 19.99 },
      ],
      trackedStoresCount: 3,
    });
  });

  it("returns an empty wishlist for a user with no want_to_buy books", async () => {
    const { listWishlistBooks, service } = setup({ rows: [] });

    const result = await service.getWishlist({ userId: USER_ID });

    expect(result).toEqual({
      books: [],
      summary: { booksCount: 0, counts: EMPTY_COUNTS, estimates: [], trackedStoresCount: 0 },
      totalBooksCount: 0,
    });
    expect(listWishlistBooks).toHaveBeenCalledWith({
      now: expect.any(Date),
      query: {},
      userId: USER_ID,
    });
  });

  it("asks for the shelf tops of each distinct series its wishlist books belong to", async () => {
    const { listSeriesWishlistAnchors, service } = setup({
      rows: [
        makeRow({ id: "book-a", partNumber: 3, seriesId: SERIES_ID, storeLinks: [] }),
        makeRow({ id: "book-b", partNumber: 4, seriesId: SERIES_ID, storeLinks: [] }),
        makeRow({ id: "book-c", storeLinks: [] }),
      ],
    });

    await service.getWishlist({ userId: USER_ID });

    expect(listSeriesWishlistAnchors).toHaveBeenCalledWith({
      seriesIds: [SERIES_ID],
      userId: USER_ID,
    });
  });

  it("turns the shelf tops into the series anchors behind the summary counts", async () => {
    const { service } = setup({
      anchorRows: [
        { highestPartNumberOutsideWishlist: 5, seriesId: SERIES_ID },
        { highestPartNumberOutsideWishlist: 4, seriesId: OTHER_SERIES_ID },
      ],
      rows: [
        makeRow({ id: "book-a", partNumber: 6, seriesId: SERIES_ID, storeLinks: [] }),
        makeRow({ id: "book-b", partNumber: 2, seriesId: OTHER_SERIES_ID, storeLinks: [] }),
      ],
    });

    const result = await service.getWishlist({ userId: USER_ID });

    expect(result.summary.counts.nextInSeries).toEqual({ booksCount: 1, seriesCount: 1 });
    expect(result.summary.counts.missingFromSeries).toEqual({ booksCount: 1, seriesCount: 1 });
  });

  it("drops a shelf top with no highest part number so its series anchors nothing", async () => {
    const { service } = setup({
      anchorRows: [{ highestPartNumberOutsideWishlist: null, seriesId: SERIES_ID }],
      rows: [makeRow({ id: "book-a", partNumber: 6, seriesId: SERIES_ID, storeLinks: [] })],
    });

    const result = await service.getWishlist({ userId: USER_ID });

    expect(result.summary.counts.nextInSeries).toEqual({ booksCount: 0, seriesCount: 0 });
    expect(result.summary.counts.missingFromSeries).toEqual({ booksCount: 0, seriesCount: 0 });
  });

  it("counts a wishlist book by the time it has waited against the current clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { service } = setup({
      rows: [
        makeRow({
          id: "book-a",
          storeLinks: [],
          wishlistAddedAt: new Date("2026-08-01T12:00:00.000Z"),
        }),
        makeRow({
          id: "book-b",
          storeLinks: [],
          wishlistAddedAt: new Date("2026-01-05T12:00:00.000Z"),
        }),
      ],
    });

    const result = await service.getWishlist({ userId: USER_ID });

    expect(result.summary.counts.addedLast30Days).toBe(1);
    expect(result.summary.counts.waitingOverSixMonths).toBe(1);
  });
});
