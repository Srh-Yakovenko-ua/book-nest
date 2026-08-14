import type { Nullable, ShipmentStatus } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookOrderItemsRepository } from "../infrastructure/book-order-items.repository.js";
import type { BookOrdersRepository } from "../infrastructure/book-orders.repository.js";
import type { OrderBooksRepository } from "../infrastructure/order-books.repository.js";
import type { ShipmentsRepository } from "../infrastructure/shipments.repository.js";
import type { BookOrderViewLoader } from "./book-order-view.loader.js";
import type { ShipmentDeliveryServiceResolver } from "./shipment-delivery-service.resolver.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { ShipmentService } from "./shipment.service.js";

const USER = "user-1";
const ORDER_ID = "order-1";
const SHIPMENT_ID = "shipment-1";
const OTHER_SHIPMENT_ID = "shipment-2";

const TX = { marker: "tx" } as unknown as Prisma.TransactionClient;

const orderRow = {
  id: ORDER_ID,
  orderDate: new Date("2026-08-01T00:00:00.000Z"),
  shipments: [],
  userId: USER,
};

function buildService(overrides: {
  books?: Partial<OrderBooksRepository>;
  items?: Partial<BookOrderItemsRepository>;
  orders?: Partial<BookOrdersRepository>;
  shipmentRow?: Nullable<ReturnType<typeof makeShipmentRow>>;
  shipments?: Partial<ShipmentsRepository>;
}) {
  const shipmentRow =
    overrides.shipmentRow === undefined ? makeShipmentRow({}) : overrides.shipmentRow;
  const shipments = {
    cancelActive: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue({ id: SHIPMENT_ID, orderId: ORDER_ID }),
    findOwnedById: vi.fn().mockResolvedValue(shipmentRow),
    lockActive: vi.fn().mockResolvedValue(true),
    receiveActive: vi.fn().mockResolvedValue(1),
    updateActive: vi.fn().mockResolvedValue(1),
    updateActiveStatus: vi.fn().mockResolvedValue(1),
    ...overrides.shipments,
  } as unknown as ShipmentsRepository;
  const items = {
    cancelActiveForShipment: vi.fn().mockResolvedValue([{ bookId: "book-a", id: "item-1" }]),
    moveToShipment: vi.fn().mockResolvedValue(2),
    receiveForShipment: vi.fn().mockResolvedValue([{ bookId: "book-a", id: "item-1" }]),
    ...overrides.items,
  } as unknown as BookOrderItemsRepository;
  const orders = {
    findOwnedById: vi.fn().mockResolvedValue(orderRow),
    ...overrides.orders,
  } as unknown as BookOrdersRepository;
  const books = {
    applyOwnership: vi.fn().mockResolvedValue(1),
    ...overrides.books,
  } as unknown as OrderBooksRepository;
  const resolver = {
    resolve: vi.fn().mockResolvedValue({ deliveryServiceId: null, deliveryServiceName: null }),
    resolvePatch: vi.fn().mockResolvedValue({}),
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
    service: new ShipmentService(
      shipments,
      items,
      orders,
      books,
      resolver,
      viewLoader,
      transactionRunner,
    ),
    shipments,
    transactionRunner,
    viewLoader,
  };
}

function makeShipmentRow({
  items = [
    {
      bookId: "book-a",
      cancelledAt: null,
      id: "item-1",
      receivedAt: null,
      shipmentId: SHIPMENT_ID,
    },
  ],
  orderDate = new Date("2026-08-01T00:00:00.000Z"),
  status = "in_transit" as ShipmentStatus,
}: {
  items?: {
    bookId: string;
    cancelledAt: Nullable<Date>;
    id: string;
    receivedAt: Nullable<Date>;
    shipmentId: Nullable<string>;
  }[];
  orderDate?: Nullable<Date>;
  status?: ShipmentStatus;
}) {
  return {
    id: SHIPMENT_ID,
    items,
    order: { id: ORDER_ID, orderDate, userId: USER },
    orderId: ORDER_ID,
    status,
  };
}

describe("ShipmentService.markReceived", () => {
  it("marks only the books of this parcel as owned", async () => {
    const { books, items, service } = buildService({});

    await service.markReceived({ input: {}, shipmentId: SHIPMENT_ID, userId: USER });

    expect(items.receiveForShipment).toHaveBeenCalledWith(
      expect.objectContaining({ shipmentId: SHIPMENT_ID, userId: USER }),
      TX,
    );
    expect(books.applyOwnership).toHaveBeenCalledWith(
      expect.objectContaining({ bookIds: ["book-a"], ownershipStatus: "owned" }),
      TX,
    );
  });

  it("stamps the receipt date the reader chose", async () => {
    const { items, service, shipments } = buildService({});

    await service.markReceived({
      input: { receivedAt: "2026-08-09" },
      shipmentId: SHIPMENT_ID,
      userId: USER,
    });

    const receivedAt = new Date("2026-08-09T00:00:00.000Z");
    expect(shipments.receiveActive).toHaveBeenCalledWith(
      expect.objectContaining({ receivedAt }),
      TX,
    );
    expect(items.receiveForShipment).toHaveBeenCalledWith(
      expect.objectContaining({ receivedAt }),
      TX,
    );
  });

  it.each(["received", "cancelled"] as ShipmentStatus[])(
    "refuses to receive a parcel that is already %s",
    async (status) => {
      const { books, service, shipments } = buildService({
        shipmentRow: makeShipmentRow({ status }),
      });

      await expect(
        service.markReceived({ input: {}, shipmentId: SHIPMENT_ID, userId: USER }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(shipments.receiveActive).not.toHaveBeenCalled();
      expect(books.applyOwnership).not.toHaveBeenCalled();
    },
  );

  it("refuses when another request received the parcel first", async () => {
    const { books, service } = buildService({
      shipments: { receiveActive: vi.fn().mockResolvedValue(0) },
    });

    await expect(
      service.markReceived({ input: {}, shipmentId: SHIPMENT_ID, userId: USER }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(books.applyOwnership).not.toHaveBeenCalled();
  });

  it("reports a parcel that does not belong to the reader as missing", async () => {
    const { service } = buildService({ shipmentRow: null });

    await expect(
      service.markReceived({ input: {}, shipmentId: SHIPMENT_ID, userId: USER }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("ShipmentService.cancel", () => {
  it("cancels the parcel and its live books inside one transaction", async () => {
    const { books, items, service, shipments, transactionRunner } = buildService({});

    await service.cancel({
      input: { cancelReason: "Store cancelled", keepAsWantToBuy: true },
      shipmentId: SHIPMENT_ID,
      userId: USER,
    });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
    expect(shipments.cancelActive).toHaveBeenCalledWith(
      expect.objectContaining({ cancelReason: "Store cancelled", shipmentId: SHIPMENT_ID }),
      TX,
    );
    expect(items.cancelActiveForShipment).toHaveBeenCalledWith(
      expect.objectContaining({ cancelReason: "Store cancelled", shipmentId: SHIPMENT_ID }),
      TX,
    );
    expect(books.applyOwnership).toHaveBeenCalledWith(
      expect.objectContaining({ bookIds: ["book-a"], ownershipStatus: "want_to_buy" }),
      TX,
    );
  });

  it("drops the books back to none when the reader no longer wants them", async () => {
    const { books, service } = buildService({});

    await service.cancel({
      input: { keepAsWantToBuy: false },
      shipmentId: SHIPMENT_ID,
      userId: USER,
    });

    expect(books.applyOwnership).toHaveBeenCalledWith(
      expect.objectContaining({ ownershipStatus: "none" }),
      TX,
    );
  });

  it("refuses to cancel a parcel that already arrived", async () => {
    const { items, service, shipments } = buildService({
      shipmentRow: makeShipmentRow({ status: "received" }),
    });

    await expect(
      service.cancel({ input: { keepAsWantToBuy: true }, shipmentId: SHIPMENT_ID, userId: USER }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(shipments.cancelActive).not.toHaveBeenCalled();
    expect(items.cancelActiveForShipment).not.toHaveBeenCalled();
  });

  it("leaves the books alone when the parcel was cancelled by a parallel request", async () => {
    const { items, service } = buildService({
      shipments: { cancelActive: vi.fn().mockResolvedValue(0) },
    });

    await expect(
      service.cancel({ input: { keepAsWantToBuy: true }, shipmentId: SHIPMENT_ID, userId: USER }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(items.cancelActiveForShipment).not.toHaveBeenCalled();
  });
});

describe("ShipmentService.update", () => {
  it.each(["received", "cancelled"] as ShipmentStatus[])(
    "refuses a note-only patch on a %s parcel",
    async (status) => {
      const { service, shipments } = buildService({ shipmentRow: makeShipmentRow({ status }) });

      await expect(
        service.update({
          input: { note: "left at the door" },
          shipmentId: SHIPMENT_ID,
          userId: USER,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(shipments.updateActive).not.toHaveBeenCalled();
    },
  );

  it("refuses an expected delivery earlier than the order date", async () => {
    const { service, shipments } = buildService({});

    await expect(
      service.update({
        input: { expectedDeliveryDate: "2026-07-25" },
        shipmentId: SHIPMENT_ID,
        userId: USER,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(shipments.updateActive).not.toHaveBeenCalled();
  });

  it("patches only the fields the request carried", async () => {
    const { service, shipments } = buildService({});

    await service.update({
      input: { trackingNumber: "TRK-9", trackingUrl: null },
      shipmentId: SHIPMENT_ID,
      userId: USER,
    });

    expect(shipments.updateActive).toHaveBeenCalledWith(
      {
        data: { trackingNumber: "TRK-9", trackingUrl: null },
        shipmentId: SHIPMENT_ID,
        userId: USER,
      },
      TX,
    );
  });

  it("routes a status change through the guarded status write", async () => {
    const { service, shipments } = buildService({});

    await service.update({
      input: { status: "ready_for_pickup" },
      shipmentId: SHIPMENT_ID,
      userId: USER,
    });

    expect(shipments.updateActiveStatus).toHaveBeenCalledWith(
      { data: { status: "ready_for_pickup" }, shipmentId: SHIPMENT_ID, userId: USER },
      TX,
    );
  });
});

describe("ShipmentService.moveItems", () => {
  it("locks the target parcel before moving anything into it", async () => {
    const calls: string[] = [];
    const { service } = buildService({
      items: {
        moveToShipment: vi.fn(() => {
          calls.push("move");
          return Promise.resolve(2);
        }),
      },
      shipments: {
        lockActive: vi.fn(() => {
          calls.push("lock");
          return Promise.resolve(true);
        }),
      },
    });

    await service.moveItems({
      input: { itemIds: ["item-1", "item-2"], shipmentId: OTHER_SHIPMENT_ID },
      orderId: ORDER_ID,
      userId: USER,
    });

    expect(calls).toEqual(["lock", "move"]);
  });

  it("refuses to move books into a parcel that is no longer active", async () => {
    const { items, service } = buildService({
      shipments: { lockActive: vi.fn().mockResolvedValue(false) },
    });

    await expect(
      service.moveItems({
        input: { itemIds: ["item-1"], shipmentId: OTHER_SHIPMENT_ID },
        orderId: ORDER_ID,
        userId: USER,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(items.moveToShipment).not.toHaveBeenCalled();
  });

  it("takes no lock when the books are pulled out of every parcel", async () => {
    const { items, service, shipments } = buildService({
      items: { moveToShipment: vi.fn().mockResolvedValue(1) },
    });

    await service.moveItems({
      input: { itemIds: ["item-1"], shipmentId: null },
      orderId: ORDER_ID,
      userId: USER,
    });

    expect(shipments.lockActive).not.toHaveBeenCalled();
    expect(items.moveToShipment).toHaveBeenCalledWith(
      { itemIds: ["item-1"], orderId: ORDER_ID, shipmentId: null, userId: USER },
      TX,
    );
  });

  it("refuses the whole move when one book does not belong to the order", async () => {
    const { service } = buildService({
      items: { moveToShipment: vi.fn().mockResolvedValue(1) },
    });

    await expect(
      service.moveItems({
        input: { itemIds: ["item-1", "item-2"], shipmentId: OTHER_SHIPMENT_ID },
        orderId: ORDER_ID,
        userId: USER,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe("ShipmentService.create", () => {
  it("refuses a parcel expected before the order was placed", async () => {
    const { service, shipments } = buildService({});

    await expect(
      service.create({
        input: { expectedDeliveryDate: "2026-07-20", itemIds: ["item-1"] },
        orderId: ORDER_ID,
        userId: USER,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(shipments.create).not.toHaveBeenCalled();
  });

  it("moves the chosen books into the parcel it just created", async () => {
    const { items, service } = buildService({
      items: { moveToShipment: vi.fn().mockResolvedValue(2) },
    });

    await service.create({
      input: { itemIds: ["item-1", "item-2"] },
      orderId: ORDER_ID,
      userId: USER,
    });

    expect(items.moveToShipment).toHaveBeenCalledWith(
      { itemIds: ["item-1", "item-2"], orderId: ORDER_ID, shipmentId: SHIPMENT_ID, userId: USER },
      TX,
    );
  });

  it("reports a missing order instead of creating a stray parcel", async () => {
    const { service, shipments } = buildService({
      orders: { findOwnedById: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      service.create({ input: { itemIds: ["item-1"] }, orderId: ORDER_ID, userId: USER }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(shipments.create).not.toHaveBeenCalled();
  });
});

describe("ShipmentService.markInTransit", () => {
  it("carries the tracking number and expected date into the guarded write", async () => {
    const { service, shipments } = buildService({});

    await service.markInTransit({
      input: { expectedDeliveryDate: "2026-08-15", trackingNumber: "TRK-1" },
      shipmentId: SHIPMENT_ID,
      userId: USER,
    });

    expect(shipments.updateActiveStatus).toHaveBeenCalledWith(
      {
        data: {
          expectedDeliveryDate: new Date("2026-08-15T00:00:00.000Z"),
          status: "in_transit",
          trackingNumber: "TRK-1",
        },
        shipmentId: SHIPMENT_ID,
        userId: USER,
      },
      TX,
    );
  });

  it("refuses an expected delivery earlier than the order date", async () => {
    const { service, shipments } = buildService({});

    await expect(
      service.markInTransit({
        input: { expectedDeliveryDate: "2026-07-25" },
        shipmentId: SHIPMENT_ID,
        userId: USER,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(shipments.updateActiveStatus).not.toHaveBeenCalled();
  });

  it("accepts an expected delivery on the order date itself", async () => {
    const { service, shipments } = buildService({});

    await service.markInTransit({
      input: { expectedDeliveryDate: "2026-08-01" },
      shipmentId: SHIPMENT_ID,
      userId: USER,
    });

    expect(shipments.updateActiveStatus).toHaveBeenCalledWith(
      {
        data: {
          expectedDeliveryDate: new Date("2026-08-01T00:00:00.000Z"),
          status: "in_transit",
        },
        shipmentId: SHIPMENT_ID,
        userId: USER,
      },
      TX,
    );
  });

  it.each(["received", "cancelled"] as ShipmentStatus[])(
    "refuses to revive a %s parcel",
    async (status) => {
      const { service, shipments } = buildService({ shipmentRow: makeShipmentRow({ status }) });

      await expect(
        service.markInTransit({ input: {}, shipmentId: SHIPMENT_ID, userId: USER }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(shipments.updateActiveStatus).not.toHaveBeenCalled();
    },
  );
});

describe("ShipmentService.markReadyForPickup", () => {
  it("stores the pickup deadline together with the status", async () => {
    const { service, shipments } = buildService({});

    await service.markReadyForPickup({
      input: { pickupUntil: "2026-08-20" },
      shipmentId: SHIPMENT_ID,
      userId: USER,
    });

    expect(shipments.updateActiveStatus).toHaveBeenCalledWith(
      {
        data: {
          pickupUntil: new Date("2026-08-20T00:00:00.000Z"),
          status: "ready_for_pickup",
        },
        shipmentId: SHIPMENT_ID,
        userId: USER,
      },
      TX,
    );
  });
});
