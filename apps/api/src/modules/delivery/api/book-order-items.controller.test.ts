import type { BookOrderView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { DeliveryModule } from "../delivery.module.js";
import {
  createBooks,
  createOrder,
  getJson,
  isoDay,
  itemOf,
  ORDER_ROUTES,
  ownershipOf,
  postJson,
  shipmentOf,
} from "./book-order.fixtures.js";

type ThreeBookParcel = {
  bookIds: string[];
  order: BookOrderView;
  shipmentId: string;
};

let context: AuthTestContext;
let app: INestApplication;
let reader: AuthenticatedUser;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, DeliveryModule]);
  app = context.app;
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

async function seedThreeBookParcel(): Promise<ThreeBookParcel> {
  const bookIds = await createBooks({
    accessToken: reader.accessToken,
    app,
    titles: ["Book One", "Book Two", "Book Three"],
  });

  const order = await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      items: bookIds.map((bookId) => ({ bookId, price: 120 })),
      orderDate: isoDay(-4),
      shipments: [{ bookIds, expectedDeliveryDate: isoDay(3), trackingNumber: "NP-1" }],
      storeName: "Yakaboo",
    },
  });

  return { bookIds, order, shipmentId: shipmentOf({ bookId: bookIds[0] ?? "", view: order }).id };
}

describe("POST /api/delivery/items/:itemId/cancel", () => {
  it("cancels the middle book and leaves the parcel and its other books alone", async () => {
    const { bookIds, order, shipmentId } = await seedThreeBookParcel();
    const [first, second, third] = bookIds;

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: { cancelReason: "Store ran out", keepAsWantToBuy: true },
      path: ORDER_ROUTES.cancelItem(itemOf({ bookId: second ?? "", view: order }).id),
    });

    expect(res.status).toBe(200);
    const view: BookOrderView = res.body;
    expect(itemOf({ bookId: second ?? "", view })).toMatchObject({
      cancelReason: "Store ran out",
    });
    expect(itemOf({ bookId: second ?? "", view }).cancelledAt).not.toBeNull();
    expect(view.shipments.find((shipment) => shipment.id === shipmentId)).toMatchObject({
      status: "ordered",
    });
    await expect(ownershipsOf([first ?? "", third ?? ""])).resolves.toEqual([
      "in_transit",
      "in_transit",
    ]);
    await expect(ownershipsOf([second ?? ""])).resolves.toEqual(["want_to_buy"]);
  });

  it("drops the cancelled book to none when the reader gives up on it", async () => {
    const { bookIds, order } = await seedThreeBookParcel();
    const [, second] = bookIds;

    await postJson({
      accessToken: reader.accessToken,
      app,
      body: { keepAsWantToBuy: false },
      path: ORDER_ROUTES.cancelItem(itemOf({ bookId: second ?? "", view: order }).id),
    });

    await expect(ownershipsOf([second ?? ""])).resolves.toEqual(["none"]);
  });

  it("sends a bodyless cancel back to the wishlist rather than to none", async () => {
    const { bookIds, order } = await seedThreeBookParcel();
    const [, second] = bookIds;

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.cancelItem(itemOf({ bookId: second ?? "", view: order }).id),
    });

    expect(res.status).toBe(200);
    await expect(ownershipsOf([second ?? ""])).resolves.toEqual(["want_to_buy"]);
  });

  it("never hands the cancelled book over when the parcel later arrives", async () => {
    const { bookIds, order, shipmentId } = await seedThreeBookParcel();
    const [first, second, third] = bookIds;
    await postJson({
      accessToken: reader.accessToken,
      app,
      body: { keepAsWantToBuy: true },
      path: ORDER_ROUTES.cancelItem(itemOf({ bookId: second ?? "", view: order }).id),
    });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(shipmentId),
    });

    expect(res.status).toBe(200);
    const view: BookOrderView = res.body;
    expect(itemOf({ bookId: second ?? "", view }).receivedAt).toBeNull();
    await expect(ownershipsOf([first ?? "", second ?? "", third ?? ""])).resolves.toEqual([
      "owned",
      "want_to_buy",
      "owned",
    ]);
  });

  it("refuses to cancel the same book twice", async () => {
    const { bookIds, order } = await seedThreeBookParcel();
    const itemId = itemOf({ bookId: bookIds[1] ?? "", view: order }).id;
    await postJson({ accessToken: reader.accessToken, app, path: ORDER_ROUTES.cancelItem(itemId) });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.cancelItem(itemId),
    });

    expect(res.status).toBe(409);
  });

  it("hides another reader's item behind a 404", async () => {
    const { bookIds, order } = await seedThreeBookParcel();
    const stranger = await context.registerVerifyAndLogin();

    const res = await postJson({
      accessToken: stranger.accessToken,
      app,
      path: ORDER_ROUTES.cancelItem(itemOf({ bookId: bookIds[0] ?? "", view: order }).id),
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/delivery/books/receive", () => {
  it("receives the listed books and reports the ones it skipped", async () => {
    const { bookIds, order } = await seedThreeBookParcel();
    const [first, second, third] = bookIds;
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.cancelItem(itemOf({ bookId: second ?? "", view: order }).id),
    });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: { bookIds: [first, second], receivedAt: isoDay(0) },
      path: ORDER_ROUTES.receiveBooks,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      receivedBookIds: [first],
      skipped: [{ bookId: second, reason: "not_active" }],
    });
    await expect(ownershipsOf([first ?? "", third ?? ""])).resolves.toEqual([
      "owned",
      "in_transit",
    ]);
  });

  it("leaves the parcel open while one of its books is still on the way", async () => {
    const { bookIds, order, shipmentId } = await seedThreeBookParcel();

    await postJson({
      accessToken: reader.accessToken,
      app,
      body: { bookIds: [bookIds[0]] },
      path: ORDER_ROUTES.receiveBooks,
    });

    const view = await readOrder(order.id);
    expect(view.shipments.find((shipment) => shipment.id === shipmentId)).toMatchObject({
      receivedAt: null,
      status: "ordered",
    });
    expect(view.derivedStatus).toBe("partially_received");
  });

  it("closes the parcel once its last book on the way is received", async () => {
    const { bookIds, order, shipmentId } = await seedThreeBookParcel();
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.cancelItem(itemOf({ bookId: bookIds[2] ?? "", view: order }).id),
    });

    await postJson({
      accessToken: reader.accessToken,
      app,
      body: { bookIds: [bookIds[0], bookIds[1]], receivedAt: isoDay(-1) },
      path: ORDER_ROUTES.receiveBooks,
    });

    const view = await readOrder(order.id);
    const parcel = view.shipments.find((shipment) => shipment.id === shipmentId);
    expect(parcel).toMatchObject({ status: "received" });
    expect(parcel?.receivedAt).toBe(`${isoDay(-1)}T00:00:00.000Z`);
  });

  it("leaves a parcel whose books were all cancelled out of the received state", async () => {
    const { bookIds, order, shipmentId } = await seedThreeBookParcel();
    for (const bookId of bookIds) {
      await postJson({
        accessToken: reader.accessToken,
        app,
        path: ORDER_ROUTES.cancelItem(itemOf({ bookId, view: order }).id),
      });
    }

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: { bookIds },
      path: ORDER_ROUTES.receiveBooks,
    });

    expect(res.body.receivedBookIds).toEqual([]);
    const view = await readOrder(order.id);
    expect(view.shipments.find((shipment) => shipment.id === shipmentId)).toMatchObject({
      status: "ordered",
    });
    expect(view.derivedStatus).toBe("cancelled");
  });

  it("never receives a book of another reader", async () => {
    const { bookIds } = await seedThreeBookParcel();
    const stranger = await context.registerVerifyAndLogin();

    const res = await postJson({
      accessToken: stranger.accessToken,
      app,
      body: { bookIds: [bookIds[0]] },
      path: ORDER_ROUTES.receiveBooks,
    });

    expect(res.body).toEqual({
      receivedBookIds: [],
      skipped: [{ bookId: bookIds[0], reason: "not_found" }],
    });
    await expect(ownershipsOf([bookIds[0] ?? ""])).resolves.toEqual(["in_transit"]);
  });
});
