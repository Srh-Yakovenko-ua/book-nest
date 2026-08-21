import type { BookOrderView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { DeliveryModule } from "../delivery.module.js";
import { OrderBooksRepository } from "../infrastructure/order-books.repository.js";
import {
  createBooks,
  createOrder,
  getJson,
  isoDay,
  ORDER_ROUTES,
  ownershipOf,
  patchJson,
  postJson,
  shipmentOf,
} from "./book-order.fixtures.js";

type SplitOrder = {
  bookIds: string[];
  firstParcel: string[];
  order: BookOrderView;
  parcelA: string;
  parcelB: string;
  secondParcel: string[];
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reader: AuthenticatedUser;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, DeliveryModule]);
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(async () => {
  context.reset();
  reader = await context.registerVerifyAndLogin();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function ownershipsOf(bookIds: string[]): Promise<string[]> {
  const statuses: string[] = [];
  for (const bookId of bookIds) {
    statuses.push(await ownershipOf({ accessToken: reader.accessToken, app, bookId }));
  }
  return statuses;
}

async function readOrder(orderId: string): Promise<BookOrderView> {
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.order(orderId),
  });
  return res.body;
}

async function seedSplitOrder(): Promise<SplitOrder> {
  const bookIds = await createBooks({
    accessToken: reader.accessToken,
    app,
    titles: ["One", "Two", "Three", "Four", "Five"],
  });
  const firstParcel = bookIds.slice(0, 3);
  const secondParcel = bookIds.slice(3);

  const order = await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      items: bookIds.map((bookId) => ({ bookId, price: 100 })),
      orderDate: isoDay(-5),
      shipments: [
        { bookIds: firstParcel, expectedDeliveryDate: isoDay(2), trackingNumber: "NP-A" },
        { bookIds: secondParcel, expectedDeliveryDate: isoDay(8), trackingNumber: "NP-B" },
      ],
      storeName: "Yakaboo",
    },
  });

  return {
    bookIds,
    firstParcel,
    order,
    parcelA: shipmentOf({ bookId: firstParcel[0] ?? "", view: order }).id,
    parcelB: shipmentOf({ bookId: secondParcel[0] ?? "", view: order }).id,
    secondParcel,
  };
}

describe("POST /api/delivery/shipments/:shipmentId/receive", () => {
  it("hands over only the books of the received parcel and leaves the order open", async () => {
    const { firstParcel, parcelA, parcelB, secondParcel } = await seedSplitOrder();

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelA),
    });

    expect(res.status).toBe(200);
    const view: BookOrderView = res.body;
    expect(view.derivedStatus).toBe("partially_received");
    expect(view.shipments.find((shipment) => shipment.id === parcelA)).toMatchObject({
      status: "received",
    });
    expect(view.shipments.find((shipment) => shipment.id === parcelB)).toMatchObject({
      status: "ordered",
    });
    await expect(ownershipsOf(firstParcel)).resolves.toEqual(["owned", "owned", "owned"]);
    await expect(ownershipsOf(secondParcel)).resolves.toEqual(["in_transit", "in_transit"]);
  });

  it("refuses to receive the same parcel twice", async () => {
    const { parcelA } = await seedSplitOrder();
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelA),
    });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelA),
    });

    expect(res.status).toBe(409);
  });

  it("refuses to receive a cancelled parcel", async () => {
    const { parcelA } = await seedSplitOrder();
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.cancelShipment(parcelA),
    });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelA),
    });

    expect(res.status).toBe(409);
  });

  it("closes the order once its second parcel arrives", async () => {
    const { bookIds, order, parcelA, parcelB } = await seedSplitOrder();

    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelA),
    });
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelB),
    });

    const view = await readOrder(order.id);
    expect(view.derivedStatus).toBe("received");
    await expect(ownershipsOf(bookIds)).resolves.toEqual(new Array(5).fill("owned"));
  });
});

describe("POST /api/delivery/shipments/:shipmentId/cancel", () => {
  it("cancels one parcel without touching the books of the other", async () => {
    const { firstParcel, parcelA, parcelB, secondParcel } = await seedSplitOrder();

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: { cancelReason: "Store ran out", keepAsWantToBuy: true },
      path: ORDER_ROUTES.cancelShipment(parcelA),
    });

    expect(res.status).toBe(200);
    const view: BookOrderView = res.body;
    expect(view.shipments.find((shipment) => shipment.id === parcelA)).toMatchObject({
      cancelReason: "Store ran out",
      status: "cancelled",
    });
    expect(view.shipments.find((shipment) => shipment.id === parcelB)).toMatchObject({
      status: "ordered",
    });
    await expect(ownershipsOf(firstParcel)).resolves.toEqual([
      "want_to_buy",
      "want_to_buy",
      "want_to_buy",
    ]);
    await expect(ownershipsOf(secondParcel)).resolves.toEqual(["in_transit", "in_transit"]);
  });

  it("keeps the books of the surviving parcel owned after it is received", async () => {
    const { firstParcel, parcelA, parcelB, secondParcel } = await seedSplitOrder();

    await postJson({
      accessToken: reader.accessToken,
      app,
      body: { keepAsWantToBuy: false },
      path: ORDER_ROUTES.cancelShipment(parcelA),
    });
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelB),
    });

    await expect(ownershipsOf(firstParcel)).resolves.toEqual(["none", "none", "none"]);
    await expect(ownershipsOf(secondParcel)).resolves.toEqual(["owned", "owned"]);
  });

  it("refuses to cancel a received parcel", async () => {
    const { parcelA } = await seedSplitOrder();
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelA),
    });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.cancelShipment(parcelA),
    });

    expect(res.status).toBe(409);
  });
});

describe("receiving a parcel is one transaction", () => {
  it("leaves no book of the parcel on its way once the parcel arrives", async () => {
    const { parcelA } = await seedSplitOrder();

    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelA),
    });

    const stillOnTheWay = await prisma.book.count({
      where: {
        orderItems: { some: { shipmentId: parcelA } },
        ownershipStatus: "in_transit",
      },
    });
    const pendingItems = await prisma.bookOrderItem.count({
      where: { receivedAt: null, shipmentId: parcelA },
    });
    expect(stillOnTheWay).toBe(0);
    expect(pendingItems).toBe(0);
  });

  it("rolls the parcel, its books and its items back when a later write fails", async () => {
    const { firstParcel, order, parcelA } = await seedSplitOrder();
    vi.spyOn(app.get(OrderBooksRepository), "applyOwnership").mockRejectedValueOnce(
      new Error("ownership write failed"),
    );

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelA),
    });

    expect(res.status).toBe(500);
    const view = await readOrder(order.id);
    expect(view.shipments.find((shipment) => shipment.id === parcelA)).toMatchObject({
      receivedAt: null,
      status: "ordered",
    });
    expect(view.items.every((item) => item.receivedAt === null)).toBe(true);
    await expect(ownershipsOf(firstParcel)).resolves.toEqual([
      "in_transit",
      "in_transit",
      "in_transit",
    ]);
  });
});

describe("PATCH /api/delivery/shipments/:shipmentId", () => {
  it("rejects a body that tries to walk a parcel back into transit", async () => {
    const { parcelA } = await seedSplitOrder();

    const res = await patchJson({
      accessToken: reader.accessToken,
      app,
      body: { status: "received" },
      path: ORDER_ROUTES.updateShipment(parcelA),
    });

    expect(res.status).toBe(400);
  });

  it("refuses to edit a parcel that already arrived", async () => {
    const { parcelA } = await seedSplitOrder();
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelA),
    });

    const res = await patchJson({
      accessToken: reader.accessToken,
      app,
      body: { status: "in_transit" },
      path: ORDER_ROUTES.updateShipment(parcelA),
    });

    expect(res.status).toBe(409);
  });

  it("walks an active parcel through its own statuses", async () => {
    const { parcelA } = await seedSplitOrder();

    const inTransit = await postJson({
      accessToken: reader.accessToken,
      app,
      body: { trackingNumber: "NP-A-2" },
      path: ORDER_ROUTES.markInTransit(parcelA),
    });
    const readyForPickup = await postJson({
      accessToken: reader.accessToken,
      app,
      body: { pickupUntil: isoDay(5) },
      path: ORDER_ROUTES.markReadyForPickup(parcelA),
    });

    expect(inTransit.status).toBe(200);
    expect(readyForPickup.status).toBe(200);
    const view: BookOrderView = readyForPickup.body;
    expect(view.shipments.find((shipment) => shipment.id === parcelA)).toMatchObject({
      pickupUntil: isoDay(5),
      status: "ready_for_pickup",
      trackingNumber: "NP-A-2",
    });
  });

  it("hides another reader's parcel behind a 404", async () => {
    const { parcelA } = await seedSplitOrder();
    const stranger = await context.registerVerifyAndLogin();

    const res = await postJson({
      accessToken: stranger.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelA),
    });

    expect(res.status).toBe(404);
  });
});
