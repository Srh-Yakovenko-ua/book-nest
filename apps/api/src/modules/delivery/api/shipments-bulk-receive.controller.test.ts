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

type SplitOrder = {
  firstParcel: string[];
  order: BookOrderView;
  orderedBookIds: string[];
  parcelA: string;
  parcelB: string;
  secondParcel: string[];
};

type ThreeParcelOrder = {
  orderedBookIds: string[];
  parcelOne: string;
  parcelThree: string;
  parcelTwo: string;
};

const RECEIVE_SHIPMENTS_PATH = "/api/delivery/shipments/receive";
const UNKNOWN_SHIPMENT_ID = "00000000-0000-4000-8000-00000000f001";

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

async function cancelItemOfBook({
  bookId,
  order,
}: {
  bookId: string;
  order: BookOrderView;
}): Promise<void> {
  const res = await postJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.cancelItem(itemOf({ bookId, view: order }).id),
  });
  if (res.status !== 200) {
    throw new Error(
      `cancelling the item of book ${bookId} failed with status ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
}

async function cancelParcel(shipmentId: string): Promise<void> {
  const res = await postJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.cancelShipment(shipmentId),
  });
  if (res.status !== 200) {
    throw new Error(
      `cancelling parcel ${shipmentId} failed with status ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
}

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
  if (typeof res.body.id !== "string") {
    throw new Error(`order ${orderId} read failed with status ${res.status}`);
  }
  return res.body;
}

async function receiveParcel(shipmentId: string): Promise<void> {
  const res = await postJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.receiveShipment(shipmentId),
  });
  if (res.status !== 200) {
    throw new Error(
      `receiving parcel ${shipmentId} failed with status ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
}

async function seedSplitOrder(): Promise<SplitOrder> {
  const orderedBookIds = await createBooks({
    accessToken: reader.accessToken,
    app,
    titles: ["One", "Two", "Three", "Four", "Five"],
  });
  const firstParcel = orderedBookIds.slice(0, 3);
  const secondParcel = orderedBookIds.slice(3);

  const order = await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      items: orderedBookIds.map((bookId) => ({ bookId, price: 100 })),
      orderDate: isoDay(-5),
      shipments: [
        { bookIds: firstParcel, expectedDeliveryDate: isoDay(2), trackingNumber: "NP-A" },
        { bookIds: secondParcel, expectedDeliveryDate: isoDay(8), trackingNumber: "NP-B" },
      ],
      storeName: "Yakaboo",
    },
  });

  return {
    firstParcel,
    order,
    orderedBookIds,
    parcelA: shipmentOf({ bookId: firstParcel[0] ?? "", view: order }).id,
    parcelB: shipmentOf({ bookId: secondParcel[0] ?? "", view: order }).id,
    secondParcel,
  };
}

async function seedThreeParcelOrder(): Promise<ThreeParcelOrder> {
  const orderedBookIds = await createBooks({
    accessToken: reader.accessToken,
    app,
    titles: ["Alpha", "Beta", "Gamma"],
  });

  const order = await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      items: orderedBookIds.map((bookId) => ({ bookId, price: 90 })),
      orderDate: isoDay(-6),
      shipments: orderedBookIds.map((bookId, index) => ({
        bookIds: [bookId],
        expectedDeliveryDate: isoDay(index + 1),
        trackingNumber: `NP-${index}`,
      })),
      storeName: "Yakaboo",
    },
  });

  return {
    orderedBookIds,
    parcelOne: shipmentOf({ bookId: orderedBookIds[0] ?? "", view: order }).id,
    parcelThree: shipmentOf({ bookId: orderedBookIds[2] ?? "", view: order }).id,
    parcelTwo: shipmentOf({ bookId: orderedBookIds[1] ?? "", view: order }).id,
  };
}

describe("POST /api/delivery/shipments/:shipmentId/receive", () => {
  it("hands over the books of the one parcel it names and closes that parcel", async () => {
    const { firstParcel, parcelA } = await seedSplitOrder();

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(parcelA),
    });

    expect(res.status).toBe(200);
    const view: BookOrderView = res.body;
    expect(view.shipments.find((shipment) => shipment.id === parcelA)).toMatchObject({
      status: "received",
    });
    expect(
      view.items
        .filter((item) => item.shipmentId === parcelA)
        .every((item) => item.receivedAt !== null),
    ).toBe(true);
    await expect(ownershipsOf(firstParcel)).resolves.toEqual(["owned", "owned", "owned"]);
  });
});

describe("POST /api/delivery/shipments/receive", () => {
  it("reports every parcel of the batch as received", async () => {
    const { parcelA, parcelB } = await seedSplitOrder();

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: { shipmentIds: [parcelA, parcelB] },
      path: RECEIVE_SHIPMENTS_PATH,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ receivedShipmentIds: [parcelA, parcelB], skipped: [] });
  });

  it("closes every parcel of the batch and hands over all of their books", async () => {
    const { order, orderedBookIds, parcelA, parcelB } = await seedSplitOrder();

    await postJson({
      accessToken: reader.accessToken,
      app,
      body: { shipmentIds: [parcelA, parcelB] },
      path: RECEIVE_SHIPMENTS_PATH,
    });

    const view = await readOrder(order.id);
    expect(view.shipments.find((shipment) => shipment.id === parcelA)).toMatchObject({
      status: "received",
    });
    expect(view.shipments.find((shipment) => shipment.id === parcelB)).toMatchObject({
      status: "received",
    });
    expect(view.items.every((item) => item.receivedAt !== null)).toBe(true);
    expect(view.derivedStatus).toBe("received");
    await expect(ownershipsOf(orderedBookIds)).resolves.toEqual(new Array(5).fill("owned"));
  });

  it("stamps the receipt date the reader chose on every parcel of the batch", async () => {
    const { order, parcelA, parcelB } = await seedSplitOrder();
    const receivedAt = isoDay(-1);

    await postJson({
      accessToken: reader.accessToken,
      app,
      body: { receivedAt, shipmentIds: [parcelA, parcelB] },
      path: RECEIVE_SHIPMENTS_PATH,
    });

    const view = await readOrder(order.id);
    expect(view.shipments.find((shipment) => shipment.id === parcelA)).toMatchObject({
      receivedAt: `${receivedAt}T00:00:00.000Z`,
    });
    expect(view.shipments.find((shipment) => shipment.id === parcelB)).toMatchObject({
      receivedAt: `${receivedAt}T00:00:00.000Z`,
    });
  });

  it("keeps a cancelled book of the parcel cancelled while the rest of it arrives", async () => {
    const { firstParcel, order, parcelA } = await seedSplitOrder();
    const [first, second, third] = firstParcel;
    await cancelItemOfBook({ bookId: second ?? "", order });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: { shipmentIds: [parcelA] },
      path: RECEIVE_SHIPMENTS_PATH,
    });

    expect(res.status).toBe(200);
    const view = await readOrder(order.id);
    expect(itemOf({ bookId: second ?? "", view })).toMatchObject({ receivedAt: null });
    expect(itemOf({ bookId: second ?? "", view }).cancelledAt).not.toBeNull();
    await expect(ownershipsOf([first ?? "", second ?? "", third ?? ""])).resolves.toEqual([
      "owned",
      "want_to_buy",
      "owned",
    ]);
  });

  it("leaves the parcel the batch did not name on its way", async () => {
    const { order, parcelA, parcelB, secondParcel } = await seedSplitOrder();

    await postJson({
      accessToken: reader.accessToken,
      app,
      body: { shipmentIds: [parcelA] },
      path: RECEIVE_SHIPMENTS_PATH,
    });

    const view = await readOrder(order.id);
    expect(view.shipments.find((shipment) => shipment.id === parcelB)).toMatchObject({
      receivedAt: null,
      status: "ordered",
    });
    await expect(ownershipsOf(secondParcel)).resolves.toEqual(["in_transit", "in_transit"]);
  });

  it("moves the order to partially received while its other parcel is still on the way", async () => {
    const { order, parcelA } = await seedSplitOrder();

    await postJson({
      accessToken: reader.accessToken,
      app,
      body: { shipmentIds: [parcelA] },
      path: RECEIVE_SHIPMENTS_PATH,
    });

    const view = await readOrder(order.id);
    expect(view.derivedStatus).toBe("partially_received");
  });

  it("skips the parcels that are no longer active and the ones that do not exist", async () => {
    const { parcelOne, parcelThree, parcelTwo } = await seedThreeParcelOrder();
    await receiveParcel(parcelTwo);
    await cancelParcel(parcelThree);

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: { shipmentIds: [parcelOne, parcelTwo, parcelThree, UNKNOWN_SHIPMENT_ID] },
      path: RECEIVE_SHIPMENTS_PATH,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      receivedShipmentIds: [parcelOne],
      skipped: [
        { reason: "not_active", shipmentId: parcelTwo },
        { reason: "not_active", shipmentId: parcelThree },
        { reason: "not_found", shipmentId: UNKNOWN_SHIPMENT_ID },
      ],
    });
  });

  it("receives the active parcel of a mixed batch and leaves the settled ones alone", async () => {
    const { orderedBookIds, parcelOne, parcelThree, parcelTwo } = await seedThreeParcelOrder();
    await receiveParcel(parcelTwo);
    await cancelParcel(parcelThree);

    await postJson({
      accessToken: reader.accessToken,
      app,
      body: { shipmentIds: [parcelOne, parcelTwo, parcelThree, UNKNOWN_SHIPMENT_ID] },
      path: RECEIVE_SHIPMENTS_PATH,
    });

    await expect(ownershipsOf(orderedBookIds)).resolves.toEqual(["owned", "owned", "want_to_buy"]);
  });

  it("never receives a parcel of another reader", async () => {
    const { firstParcel, order, parcelA } = await seedSplitOrder();
    const stranger = await context.registerVerifyAndLogin();

    const res = await postJson({
      accessToken: stranger.accessToken,
      app,
      body: { shipmentIds: [parcelA] },
      path: RECEIVE_SHIPMENTS_PATH,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      receivedShipmentIds: [],
      skipped: [{ reason: "not_found", shipmentId: parcelA }],
    });
    const view = await readOrder(order.id);
    expect(view.shipments.find((shipment) => shipment.id === parcelA)).toMatchObject({
      status: "ordered",
    });
    await expect(ownershipsOf(firstParcel)).resolves.toEqual([
      "in_transit",
      "in_transit",
      "in_transit",
    ]);
  });

  it("rejects a batch that names no parcel at all", async () => {
    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: { shipmentIds: [] },
      path: RECEIVE_SHIPMENTS_PATH,
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "shipmentIds", message: expect.any(String) }),
      ]),
    );
  });
});
