import type { CreateBookOrderInput } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookOrderItemsRepository } from "../infrastructure/book-order-items.repository.js";
import type { BookOrdersRepository } from "../infrastructure/book-orders.repository.js";
import type { OrderBooksRepository } from "../infrastructure/order-books.repository.js";
import type { BookOrderViewLoader } from "./book-order-view.loader.js";
import type { ShipmentDeliveryServiceResolver } from "./shipment-delivery-service.resolver.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma as PrismaNamespace } from "../../../generated/prisma/client.js";
import { BookOrderService } from "./book-order.service.js";

const USER = "user-1";
const BOOK_A = "book-a";
const BOOK_B = "book-b";
const ORDER_ID = "order-1";

const TX = { marker: "tx" } as unknown as Prisma.TransactionClient;

const emptyOrderRow = {
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  currency: null,
  deliveryPrice: null,
  discount: null,
  id: ORDER_ID,
  items: [],
  note: null,
  orderDate: null,
  orderNumber: null,
  shipments: [],
  storeName: "Bookstore",
  totalAmount: null,
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  userId: USER,
};

function activeOrderItemConflict(): PrismaNamespace.PrismaClientKnownRequestError {
  return new PrismaNamespace.PrismaClientKnownRequestError("duplicate", {
    clientVersion: "7.8.0",
    code: "P2002",
    meta: { target: "book_order_items_active_book_idx" },
  });
}

function buildService(overrides: {
  books?: Partial<OrderBooksRepository>;
  items?: Partial<BookOrderItemsRepository>;
  orders?: Partial<BookOrdersRepository>;
  resolver?: Partial<ShipmentDeliveryServiceResolver>;
}) {
  const orders = {
    create: vi.fn().mockResolvedValue(emptyOrderRow),
    findOwnedById: vi.fn().mockResolvedValue(emptyOrderRow),
    updateOwned: vi.fn().mockResolvedValue(1),
    ...overrides.orders,
  } as unknown as BookOrdersRepository;
  const items = {
    findActiveBookIds: vi.fn().mockResolvedValue([]),
    ...overrides.items,
  } as unknown as BookOrderItemsRepository;
  const books = {
    applyOwnership: vi.fn().mockResolvedValue(1),
    listOwned: vi.fn().mockResolvedValue([
      { id: BOOK_A, ownershipStatus: "want_to_buy" },
      { id: BOOK_B, ownershipStatus: "none" },
    ]),
    ...overrides.books,
  } as unknown as OrderBooksRepository;
  const resolver = {
    resolve: vi
      .fn()
      .mockResolvedValue({ deliveryServiceId: "service-1", deliveryServiceName: "Nova Poshta" }),
    ...overrides.resolver,
  } as unknown as ShipmentDeliveryServiceResolver;
  const viewLoader = {
    loadOrThrow: vi.fn().mockResolvedValue({ id: ORDER_ID }),
  } as unknown as BookOrderViewLoader;
  const transactionRunner = {
    run: vi.fn((work: (tx: Prisma.TransactionClient) => Promise<unknown>) => work(TX)),
  } as unknown as TransactionRunner;

  return {
    books,
    items,
    orders,
    resolver,
    service: new BookOrderService(orders, items, books, resolver, viewLoader, transactionRunner),
    transactionRunner,
    viewLoader,
  };
}

function createInput(overrides: Partial<CreateBookOrderInput> = {}): CreateBookOrderInput {
  return {
    items: [{ bookId: BOOK_A }, { bookId: BOOK_B }],
    storeName: "Bookstore",
    ...overrides,
  };
}

describe("BookOrderService.create", () => {
  it("refuses an order that names a book the reader does not own", async () => {
    const { orders, service } = buildService({
      books: { listOwned: vi.fn().mockResolvedValue([{ id: BOOK_A, ownershipStatus: "none" }]) },
    });

    await expect(service.create({ input: createInput(), userId: USER })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(orders.create).not.toHaveBeenCalled();
  });

  it("refuses a book that already travels inside another live order", async () => {
    const { orders, service } = buildService({
      items: { findActiveBookIds: vi.fn().mockResolvedValue([BOOK_B]) },
    });

    await expect(service.create({ input: createInput(), userId: USER })).rejects.toThrow(
      "This book already has an active delivery",
    );
    expect(orders.create).not.toHaveBeenCalled();
  });

  it("refuses a book the reader already owns", async () => {
    const { service } = buildService({
      books: {
        listOwned: vi.fn().mockResolvedValue([
          { id: BOOK_A, ownershipStatus: "want_to_buy" },
          { id: BOOK_B, ownershipStatus: "owned" },
        ]),
      },
    });

    await expect(service.create({ input: createInput(), userId: USER })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("puts every ordered book in transit inside the same transaction", async () => {
    const { books, orders, service, transactionRunner } = buildService({});

    await service.create({ input: createInput(), userId: USER });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
    expect(orders.create).toHaveBeenCalledWith(expect.anything(), TX);
    expect(books.applyOwnership).toHaveBeenCalledWith(
      expect.objectContaining({
        bookIds: [BOOK_A, BOOK_B],
        ownershipStatus: "in_transit",
        userId: USER,
      }),
      TX,
    );
  });

  it("carries one order, two parcels and five books through the same use case", async () => {
    const bookIds = ["b1", "b2", "b3", "b4", "b5"];
    const { orders, resolver, service } = buildService({
      books: {
        listOwned: vi
          .fn()
          .mockResolvedValue(bookIds.map((id) => ({ id, ownershipStatus: "want_to_buy" }))),
      },
    });

    await service.create({
      input: createInput({
        items: bookIds.map((bookId) => ({ bookId })),
        shipments: [
          { bookIds: bookIds.slice(0, 3), deliveryService: "Nova Poshta" },
          { bookIds: bookIds.slice(3), status: "in_transit" },
        ],
      }),
      userId: USER,
    });

    expect(resolver.resolve).toHaveBeenCalledTimes(2);
    const createArgs = vi.mocked(orders.create).mock.calls[0]?.[0];
    expect(createArgs?.shipments.map((shipment) => shipment.bookIds)).toEqual([
      bookIds.slice(0, 3),
      bookIds.slice(3),
    ]);
    expect(createArgs?.shipments.map((shipment) => shipment.data.status)).toEqual([
      "ordered",
      "in_transit",
    ]);
    expect(createArgs?.shipments[0]?.data.deliveryServiceName).toBe("Nova Poshta");
  });

  it("turns the active-item index violation into a friendly conflict", async () => {
    const { service } = buildService({
      orders: { create: vi.fn().mockRejectedValue(activeOrderItemConflict()) },
    });

    await expect(service.create({ input: createInput(), userId: USER })).rejects.toThrow(
      "This book already has an active delivery",
    );
  });

  it("lets an unrelated database failure through untouched", async () => {
    const { service } = buildService({
      orders: { create: vi.fn().mockRejectedValue(new Error("connection lost")) },
    });

    await expect(service.create({ input: createInput(), userId: USER })).rejects.toThrow(
      "connection lost",
    );
  });
});

describe("BookOrderService.update", () => {
  it("refuses an order date later than a parcel that is already expected", async () => {
    const { orders, service } = buildService({
      orders: {
        findOwnedById: vi.fn().mockResolvedValue({
          ...emptyOrderRow,
          shipments: [{ expectedDeliveryDate: new Date("2026-08-05T00:00:00.000Z") }],
        }),
      },
    });

    await expect(
      service.update({ input: { orderDate: "2026-08-10" }, orderId: ORDER_ID, userId: USER }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(orders.updateOwned).not.toHaveBeenCalled();
  });

  it("accepts an order date that still precedes every expected delivery", async () => {
    const { orders, service } = buildService({
      orders: {
        findOwnedById: vi.fn().mockResolvedValue({
          ...emptyOrderRow,
          shipments: [{ expectedDeliveryDate: new Date("2026-08-05T00:00:00.000Z") }],
        }),
        updateOwned: vi.fn().mockResolvedValue(1),
      },
    });

    await service.update({
      input: { orderDate: "2026-08-05", storeName: "Other store" },
      orderId: ORDER_ID,
      userId: USER,
    });

    expect(orders.updateOwned).toHaveBeenCalledWith(
      {
        data: { orderDate: new Date("2026-08-05T00:00:00.000Z"), storeName: "Other store" },
        orderId: ORDER_ID,
        userId: USER,
      },
      TX,
    );
  });

  it("reports a missing order rather than patching nothing", async () => {
    const { service } = buildService({
      orders: { findOwnedById: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      service.update({ input: { note: "hi" }, orderId: ORDER_ID, userId: USER }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
