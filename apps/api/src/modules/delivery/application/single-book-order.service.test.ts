import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  BookOrderItemsRepository,
  BookOrderItemWithContext,
} from "../infrastructure/book-order-items.repository.js";
import type { BookOrdersRepository } from "../infrastructure/book-orders.repository.js";
import type { ShipmentsRepository } from "../infrastructure/shipments.repository.js";
import type { ShipmentDeliveryServiceResolver } from "./shipment-delivery-service.resolver.js";
import type { NewSingleBookOrder, SingleBookOrderPatch } from "./single-book-order.service.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, ConflictError } from "../../../core/exceptions/errors.js";
import { Prisma as PrismaNamespace } from "../../../generated/prisma/client.js";
import { SingleBookOrderService } from "./single-book-order.service.js";

const USER = "user-1";
const BOOK_A = "book-a";
const BOOK_B = "book-b";
const ITEM_A = "item-a";
const ORDER_ID = "order-1";
const SHIPMENT_A = "shipment-a";
const SHIPMENT_B = "shipment-b";

const TX = { marker: "tx" } as unknown as Prisma.TransactionClient;
const TOUCHED_AT = new Date("2026-08-01T00:00:00.000Z");

function activeItemConflict(): PrismaNamespace.PrismaClientKnownRequestError {
  return new PrismaNamespace.PrismaClientKnownRequestError("duplicate", {
    clientVersion: "7.8.0",
    code: "P2002",
    meta: { target: "book_order_items_active_book_idx" },
  });
}

function buildItem({
  orderDate = null,
  orderItems = [{ bookId: BOOK_A, price: null, shipmentId: SHIPMENT_A }],
  shipmentExpectedDeliveryDate = null,
  shipments = [{ expectedDeliveryDate: null, id: SHIPMENT_A }],
  totalAmount = null,
}: {
  orderDate?: Date | null;
  orderItems?: { bookId: string; price?: null | number; shipmentId: null | string }[];
  shipmentExpectedDeliveryDate?: Date | null;
  shipments?: { expectedDeliveryDate: Date | null; id: string }[];
  totalAmount?: null | number;
} = {}): BookOrderItemWithContext {
  return {
    bookId: BOOK_A,
    cancelledAt: null,
    cancelReason: null,
    createdAt: TOUCHED_AT,
    id: ITEM_A,
    order: {
      createdAt: TOUCHED_AT,
      currency: "UAH",
      deliveryPrice: null,
      discount: null,
      id: ORDER_ID,
      isFree: false,
      items: orderItems.map((sibling, index) => ({
        ...sibling,
        id: index === 0 ? ITEM_A : `item-${index}`,
        price:
          sibling.price === null || sibling.price === undefined
            ? null
            : new PrismaNamespace.Decimal(sibling.price),
      })),
      note: null,
      orderDate,
      orderNumber: null,
      shipments,
      storeName: "Yakaboo",
      totalAmount: totalAmount === null ? null : new PrismaNamespace.Decimal(totalAmount),
      updatedAt: TOUCHED_AT,
      userId: USER,
    },
    orderId: ORDER_ID,
    price: null,
    receivedAt: null,
    shipment: {
      cancelledAt: null,
      cancelReason: null,
      createdAt: TOUCHED_AT,
      deliveryServiceId: null,
      deliveryServiceName: null,
      expectedDeliveryDate: shipmentExpectedDeliveryDate,
      id: SHIPMENT_A,
      note: null,
      orderId: ORDER_ID,
      pickupUntil: null,
      receivedAt: null,
      status: "ordered",
      trackingNumber: null,
      trackingUrl: null,
      updatedAt: TOUCHED_AT,
    },
    shipmentId: SHIPMENT_A,
    updatedAt: TOUCHED_AT,
  };
}

function buildService(
  overrides: {
    items?: Partial<BookOrderItemsRepository>;
    orders?: Partial<BookOrdersRepository>;
    shipments?: Partial<ShipmentsRepository>;
  } = {},
) {
  const orders = {
    create: vi.fn().mockResolvedValue({ id: ORDER_ID }),
    updateOwned: vi.fn().mockResolvedValue(1),
    ...overrides.orders,
  } as unknown as BookOrdersRepository;
  const items = {
    cancelActiveForBooks: vi.fn().mockResolvedValue([]),
    findActiveForBook: vi.fn().mockResolvedValue(null),
    findOwnedById: vi.fn().mockResolvedValue(buildItem()),
    moveToShipment: vi.fn().mockResolvedValue(1),
    updateActivePrice: vi.fn().mockResolvedValue(1),
    ...overrides.items,
  } as unknown as BookOrderItemsRepository;
  const shipments = {
    create: vi.fn().mockResolvedValue({ id: SHIPMENT_A }),
    updateActive: vi.fn().mockResolvedValue(1),
    updateActiveStatus: vi.fn().mockResolvedValue(1),
    ...overrides.shipments,
  } as unknown as ShipmentsRepository;
  const resolver = {
    resolve: vi.fn().mockResolvedValue({ deliveryServiceId: null, deliveryServiceName: null }),
    resolvePatch: vi.fn().mockResolvedValue({}),
  } as unknown as ShipmentDeliveryServiceResolver;
  const transactionRunner = {
    run: vi.fn((work: (tx: Prisma.TransactionClient) => Promise<unknown>) => work(TX)),
  } as unknown as TransactionRunner;

  return {
    items,
    orders,
    service: new SingleBookOrderService(orders, items, shipments, resolver, transactionRunner),
    shipments,
  };
}

function draft(overrides: Partial<NewSingleBookOrder> = {}): NewSingleBookOrder {
  return {
    currency: "UAH",
    deliveryService: null,
    expectedDeliveryDate: null,
    hasShipment: true,
    isFree: false,
    note: null,
    orderDate: null,
    orderNumber: null,
    price: 350,
    status: "ordered",
    storeName: "Yakaboo",
    trackingNumber: null,
    trackingUrl: null,
    ...overrides,
  };
}

function update(patch: SingleBookOrderPatch): SingleBookOrderPatch {
  return patch;
}

describe("SingleBookOrderService.updateActiveItem on an order shared with other books", () => {
  const sharedOrderItems = [
    { bookId: BOOK_A, price: null, shipmentId: SHIPMENT_A },
    { bookId: BOOK_B, price: null, shipmentId: SHIPMENT_A },
  ];

  it("refuses an order-level field and writes nothing", async () => {
    const { orders, service } = buildService({
      items: {
        findOwnedById: vi.fn().mockResolvedValue(buildItem({ orderItems: sharedOrderItems })),
      },
    });

    await expect(
      service.updateActiveItem({
        itemId: ITEM_A,
        patch: update({ storeName: "New" }),
        userId: USER,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(orders.updateOwned).not.toHaveBeenCalled();
  });

  it("refuses a shipment-level field when the shipment carries the other book too", async () => {
    const { service, shipments } = buildService({
      items: {
        findOwnedById: vi.fn().mockResolvedValue(buildItem({ orderItems: sharedOrderItems })),
      },
    });

    await expect(
      service.updateActiveItem({
        itemId: ITEM_A,
        patch: update({ trackingNumber: "TTN" }),
        userId: USER,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(shipments.updateActive).not.toHaveBeenCalled();
  });

  it("still lets the reader price their own copy", async () => {
    const { items, orders, service, shipments } = buildService({
      items: {
        findOwnedById: vi
          .fn()
          .mockResolvedValue(buildItem({ orderItems: sharedOrderItems, totalAmount: 800 })),
      },
    });

    await service.updateActiveItem({ itemId: ITEM_A, patch: update({ price: 249 }), userId: USER });

    expect(items.updateActivePrice).toHaveBeenCalledWith(
      { itemId: ITEM_A, price: 249, userId: USER },
      TX,
    );
    expect(orders.updateOwned).toHaveBeenCalledWith(
      { data: { totalAmount: 800 }, orderId: ORDER_ID, userId: USER },
      TX,
    );
    expect(shipments.updateActive).not.toHaveBeenCalled();
  });

  it("refuses to price one book of an order whose total would then be unknown", async () => {
    const { orders, service } = buildService({
      items: {
        findOwnedById: vi.fn().mockResolvedValue(buildItem({ orderItems: sharedOrderItems })),
      },
    });

    await expect(
      service.updateActiveItem({ itemId: ITEM_A, patch: update({ price: 249 }), userId: USER }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(orders.updateOwned).not.toHaveBeenCalled();
  });

  it("recalculates the order total when an item price changes", async () => {
    const { orders, service } = buildService({
      items: {
        findOwnedById: vi.fn().mockResolvedValue(
          buildItem({
            orderItems: [
              { bookId: BOOK_A, price: 100, shipmentId: SHIPMENT_A },
              { bookId: BOOK_B, price: 200, shipmentId: SHIPMENT_A },
            ],
            totalAmount: 300,
          }),
        ),
      },
    });

    await service.updateActiveItem({ itemId: ITEM_A, patch: update({ price: 150 }), userId: USER });

    expect(orders.updateOwned).toHaveBeenCalledWith(
      { data: { totalAmount: 350 }, orderId: ORDER_ID, userId: USER },
      TX,
    );
  });

  it("freezes the calculated total as a manual one when an item price becomes unknown", async () => {
    const { orders, service } = buildService({
      items: {
        findOwnedById: vi.fn().mockResolvedValue(
          buildItem({
            orderItems: [
              { bookId: BOOK_A, price: 100, shipmentId: SHIPMENT_A },
              { bookId: BOOK_B, price: 200, shipmentId: SHIPMENT_A },
            ],
            totalAmount: 300,
          }),
        ),
      },
    });

    await service.updateActiveItem({
      itemId: ITEM_A,
      patch: update({ price: null }),
      userId: USER,
    });

    expect(orders.updateOwned).toHaveBeenCalledWith(
      { data: { totalAmount: 300 }, orderId: ORDER_ID, userId: USER },
      TX,
    );
  });

  it("allows a shipment-level field when only this book rides that shipment", async () => {
    const { service, shipments } = buildService({
      items: {
        findOwnedById: vi.fn().mockResolvedValue(
          buildItem({
            orderItems: [
              { bookId: BOOK_A, shipmentId: SHIPMENT_A },
              { bookId: BOOK_B, shipmentId: SHIPMENT_B },
            ],
            shipments: [
              { expectedDeliveryDate: null, id: SHIPMENT_A },
              { expectedDeliveryDate: null, id: SHIPMENT_B },
            ],
          }),
        ),
      },
    });

    await service.updateActiveItem({
      itemId: ITEM_A,
      patch: update({ trackingNumber: "TTN" }),
      userId: USER,
    });

    expect(shipments.updateActive).toHaveBeenCalled();
  });
});

describe("SingleBookOrderService.updateActiveItem order date invariant", () => {
  it("rejects an order date that lands after a sibling shipment's expected delivery", async () => {
    const { orders, service } = buildService({
      items: {
        findOwnedById: vi.fn().mockResolvedValue(
          buildItem({
            orderDate: new Date("2026-02-01T00:00:00.000Z"),
            shipmentExpectedDeliveryDate: new Date("2026-02-20T00:00:00.000Z"),
            shipments: [
              { expectedDeliveryDate: new Date("2026-02-20T00:00:00.000Z"), id: SHIPMENT_A },
              { expectedDeliveryDate: new Date("2026-02-10T00:00:00.000Z"), id: SHIPMENT_B },
            ],
          }),
        ),
      },
    });

    await expect(
      service.updateActiveItem({
        itemId: ITEM_A,
        patch: update({ orderDate: new Date("2026-02-15T00:00:00.000Z") }),
        userId: USER,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(orders.updateOwned).not.toHaveBeenCalled();
  });

  it("accepts an order date every shipment of the order still covers", async () => {
    const { orders, service } = buildService({
      items: {
        findOwnedById: vi.fn().mockResolvedValue(
          buildItem({
            orderDate: new Date("2026-02-01T00:00:00.000Z"),
            shipmentExpectedDeliveryDate: new Date("2026-02-20T00:00:00.000Z"),
            shipments: [
              { expectedDeliveryDate: new Date("2026-02-20T00:00:00.000Z"), id: SHIPMENT_A },
              { expectedDeliveryDate: new Date("2026-02-25T00:00:00.000Z"), id: SHIPMENT_B },
            ],
          }),
        ),
      },
    });

    await service.updateActiveItem({
      itemId: ITEM_A,
      patch: update({ orderDate: new Date("2026-02-15T00:00:00.000Z") }),
      userId: USER,
    });

    expect(orders.updateOwned).toHaveBeenCalled();
  });
});

describe("SingleBookOrderService.create", () => {
  it("creates an order item without a shipment when shipping has not started", async () => {
    const { orders, service } = buildService();

    await service.create(
      { bookId: BOOK_A, draft: draft({ hasShipment: false }), userId: USER },
      TX,
    );

    expect(orders.create).toHaveBeenCalledWith(expect.objectContaining({ shipments: [] }), TX);
  });

  it("stores an absent store name as the empty sentinel the column requires", async () => {
    const { orders, service } = buildService();

    await service.create({ bookId: BOOK_A, draft: draft({ storeName: null }), userId: USER }, TX);

    expect(orders.create).toHaveBeenCalledWith(
      expect.objectContaining({ order: expect.objectContaining({ storeName: "" }) }),
      TX,
    );
  });

  it("stores a free single-book order at a canonical total of zero", async () => {
    const { orders, service } = buildService();

    await service.create(
      { bookId: BOOK_A, draft: draft({ isFree: true, price: null }), userId: USER },
      TX,
    );

    expect(orders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ isFree: true, totalAmount: 0 }),
      }),
      TX,
    );
  });

  it("refuses a single-book order whose price nobody entered", async () => {
    const { orders, service } = buildService();

    await expect(
      service.create({ bookId: BOOK_A, draft: draft({ price: null }), userId: USER }, TX),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(orders.create).not.toHaveBeenCalled();
  });

  it("refuses a single-book order that names no currency", async () => {
    const { orders, service } = buildService();

    await expect(
      service.create({ bookId: BOOK_A, draft: draft({ currency: null }), userId: USER }, TX),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(orders.create).not.toHaveBeenCalled();
  });

  it("turns a lost race on the one-active-item index into a conflict", async () => {
    const { service } = buildService({
      orders: { create: vi.fn().mockRejectedValue(activeItemConflict()) },
    });

    await expect(
      service.create({ bookId: BOOK_A, draft: draft(), userId: USER }, TX),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
