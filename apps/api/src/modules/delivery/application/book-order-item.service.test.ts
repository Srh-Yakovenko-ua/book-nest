import type { Nullable } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookOrderItemsRepository } from "../infrastructure/book-order-items.repository.js";
import type { OrderBooksRepository } from "../infrastructure/order-books.repository.js";
import type { BookOrderViewLoader } from "./book-order-view.loader.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { BookOrderItemService } from "./book-order-item.service.js";

const USER = "user-1";
const ORDER_ID = "order-1";
const ITEM_ID = "item-1";
const BOOK_A = "book-a";
const BOOK_B = "book-b";
const BOOK_C = "book-c";

const TX = { marker: "tx" } as unknown as Prisma.TransactionClient;

function buildService(overrides: {
  books?: Partial<OrderBooksRepository>;
  items?: Partial<BookOrderItemsRepository>;
}) {
  const items = {
    cancelActiveForBooks: vi.fn().mockResolvedValue([]),
    cancelOne: vi.fn().mockResolvedValue(1),
    findOwnedById: vi.fn().mockResolvedValue(makeItemRow({})),
    receiveForBooks: vi.fn().mockResolvedValue([]),
    ...overrides.items,
  } as unknown as BookOrderItemsRepository;
  const books = {
    applyOwnership: vi.fn().mockResolvedValue(1),
    listOwned: vi.fn().mockResolvedValue([]),
    ...overrides.books,
  } as unknown as OrderBooksRepository;
  const viewLoader = {
    loadOrThrow: vi.fn().mockResolvedValue({ id: ORDER_ID }),
  } as unknown as BookOrderViewLoader;
  const transactionRunner = {
    run: vi.fn((work: (tx: Prisma.TransactionClient) => Promise<unknown>) => work(TX)),
  } as unknown as TransactionRunner;

  return {
    books,
    items,
    service: new BookOrderItemService(items, books, viewLoader, transactionRunner),
    transactionRunner,
    viewLoader,
  };
}

function makeItemRow({
  cancelledAt = null,
  receivedAt = null,
}: {
  cancelledAt?: Nullable<Date>;
  receivedAt?: Nullable<Date>;
}) {
  return {
    bookId: BOOK_A,
    cancelledAt,
    id: ITEM_ID,
    orderId: ORDER_ID,
    receivedAt,
    shipmentId: "shipment-1",
  };
}

describe("BookOrderItemService.cancel", () => {
  it("cancels the single book and returns it to the wishlist without touching the parcel", async () => {
    const { books, items, service, transactionRunner } = buildService({});

    await service.cancel({
      input: { cancelReason: "Out of stock", keepAsWantToBuy: true },
      itemId: ITEM_ID,
      userId: USER,
    });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
    expect(items.cancelOne).toHaveBeenCalledWith(
      expect.objectContaining({ cancelReason: "Out of stock", itemId: ITEM_ID, userId: USER }),
      TX,
    );
    expect(books.applyOwnership).toHaveBeenCalledWith(
      expect.objectContaining({ bookIds: [BOOK_A], ownershipStatus: "want_to_buy" }),
      TX,
    );
  });

  it("drops the book to none when the reader gives up on it", async () => {
    const { books, service } = buildService({});

    await service.cancel({ input: { keepAsWantToBuy: false }, itemId: ITEM_ID, userId: USER });

    expect(books.applyOwnership).toHaveBeenCalledWith(
      expect.objectContaining({ ownershipStatus: "none" }),
      TX,
    );
  });

  it("refuses to cancel a book that was already cancelled", async () => {
    const { items, service } = buildService({
      items: {
        findOwnedById: vi
          .fn()
          .mockResolvedValue(makeItemRow({ cancelledAt: new Date("2026-08-01T00:00:00.000Z") })),
      },
    });

    await expect(
      service.cancel({ input: { keepAsWantToBuy: true }, itemId: ITEM_ID, userId: USER }),
    ).rejects.toThrow("This book was already cancelled");
    expect(items.cancelOne).not.toHaveBeenCalled();
  });

  it("refuses to cancel a book that already arrived", async () => {
    const { service } = buildService({
      items: {
        findOwnedById: vi
          .fn()
          .mockResolvedValue(makeItemRow({ receivedAt: new Date("2026-08-02T00:00:00.000Z") })),
      },
    });

    await expect(
      service.cancel({ input: { keepAsWantToBuy: true }, itemId: ITEM_ID, userId: USER }),
    ).rejects.toThrow("This book has already arrived");
  });

  it("leaves ownership alone when a parallel request cancelled the book first", async () => {
    const { books, service } = buildService({
      items: { cancelOne: vi.fn().mockResolvedValue(0) },
    });

    await expect(
      service.cancel({ input: { keepAsWantToBuy: true }, itemId: ITEM_ID, userId: USER }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(books.applyOwnership).not.toHaveBeenCalled();
  });

  it("reports an item of another reader as missing", async () => {
    const { service } = buildService({
      items: { findOwnedById: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      service.cancel({ input: { keepAsWantToBuy: true }, itemId: ITEM_ID, userId: USER }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("BookOrderItemService.bulkReceive", () => {
  it("splits the requested books into received, not found and not active", async () => {
    const { service } = buildService({
      books: {
        listOwned: vi.fn().mockResolvedValue([
          { id: BOOK_A, ownershipStatus: "in_transit" },
          { id: BOOK_B, ownershipStatus: "owned" },
        ]),
      },
      items: {
        receiveForBooks: vi.fn().mockResolvedValue([{ bookId: BOOK_A, id: ITEM_ID }]),
      },
    });

    const result = await service.bulkReceive({
      bookIds: [BOOK_A, BOOK_B, BOOK_C, BOOK_A],
      receivedAt: undefined,
      userId: USER,
    });

    expect(result).toEqual({
      receivedBookIds: [BOOK_A],
      skipped: [
        { bookId: BOOK_B, reason: "not_active" },
        { bookId: BOOK_C, reason: "not_found" },
      ],
    });
  });

  it("only receives the books the reader listed", async () => {
    const { items, service } = buildService({
      books: {
        listOwned: vi.fn().mockResolvedValue([{ id: BOOK_A, ownershipStatus: "in_transit" }]),
      },
      items: { receiveForBooks: vi.fn().mockResolvedValue([{ bookId: BOOK_A, id: ITEM_ID }]) },
    });

    await service.bulkReceive({
      bookIds: [BOOK_A],
      receivedAt: "2026-08-09",
      userId: USER,
    });

    expect(items.receiveForBooks).toHaveBeenCalledWith(
      { bookIds: [BOOK_A], receivedAt: new Date("2026-08-09T00:00:00.000Z"), userId: USER },
      TX,
    );
  });

  it("makes the received books owned in the same transaction", async () => {
    const { books, service, transactionRunner } = buildService({
      books: {
        applyOwnership: vi.fn().mockResolvedValue(1),
        listOwned: vi.fn().mockResolvedValue([{ id: BOOK_A, ownershipStatus: "in_transit" }]),
      },
      items: { receiveForBooks: vi.fn().mockResolvedValue([{ bookId: BOOK_A, id: ITEM_ID }]) },
    });

    await service.bulkReceive({ bookIds: [BOOK_A], receivedAt: undefined, userId: USER });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
    expect(books.applyOwnership).toHaveBeenCalledWith(
      expect.objectContaining({ bookIds: [BOOK_A], ownershipStatus: "owned", userId: USER }),
      TX,
    );
  });
});

describe("BookOrderItemService.cancelActiveForBooks", () => {
  it("cancels the live items of the given books on the caller's transaction", async () => {
    const now = new Date("2026-08-10T10:00:00.000Z");
    const { items, service } = buildService({
      items: {
        cancelActiveForBooks: vi.fn().mockResolvedValue([{ bookId: BOOK_A, id: ITEM_ID }]),
      },
    });

    const cancelled = await service.cancelActiveForBooks(
      { bookIds: [BOOK_A], cancelReason: null, now, userId: USER },
      TX,
    );

    expect(items.cancelActiveForBooks).toHaveBeenCalledWith(
      { bookIds: [BOOK_A], cancelledAt: now, cancelReason: null, userId: USER },
      TX,
    );
    expect(cancelled).toEqual([{ bookId: BOOK_A, id: ITEM_ID }]);
  });
});
