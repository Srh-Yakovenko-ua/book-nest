import type { INestApplication } from "@nestjs/common";

import { BookOrderViewSchema } from "@app/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { DeliveryModule } from "../delivery.module.js";
import {
  createBook,
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

async function countRows(userId: string): Promise<{
  items: number;
  orders: number;
  shipments: number;
}> {
  const [orders, items, shipments] = await Promise.all([
    prisma.bookOrder.count({ where: { userId } }),
    prisma.bookOrderItem.count({ where: { order: { userId } } }),
    prisma.shipment.count({ where: { order: { userId } } }),
  ]);
  return { items, orders, shipments };
}

describe("POST /api/delivery/orders under the order invariant", () => {
  it("refuses an order whose books carry no price and no total", async () => {
    const bookId = await createBook({ accessToken: reader.accessToken, app, title: "Unpriced" });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: { currency: "UAH", items: [{ bookId }], storeName: "Yakaboo" },
      path: ORDER_ROUTES.orders,
    });

    expect(res.status).toBe(400);
    await expect(countRows(reader.userId)).resolves.toMatchObject({ orders: 0 });
  });

  it("refuses an order that names no currency", async () => {
    const bookId = await createBook({ accessToken: reader.accessToken, app, title: "No Currency" });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: { items: [{ bookId, price: 350 }], storeName: "Yakaboo" },
      path: ORDER_ROUTES.orders,
    });

    expect(res.status).toBe(400);
  });

  it("stores a free order at a canonical total of zero", async () => {
    const bookId = await createBook({ accessToken: reader.accessToken, app, title: "Review Copy" });

    const order = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: { currency: "UAH", isFree: true, items: [{ bookId }], storeName: "Yakaboo" },
    });

    expect(BookOrderViewSchema.parse(order)).toMatchObject({
      isFree: true,
      items: [{ bookId, price: null }],
      totalAmount: 0,
    });
  });

  it("refuses a free order that still carries an amount", async () => {
    const bookId = await createBook({ accessToken: reader.accessToken, app, title: "Not Free" });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: {
        currency: "UAH",
        isFree: true,
        items: [{ bookId, price: 350 }],
        storeName: "Yakaboo",
      },
      path: ORDER_ROUTES.orders,
    });

    expect(res.status).toBe(400);
  });

  it("keeps free books with a paid delivery on the ordinary paid path", async () => {
    const bookId = await createBook({ accessToken: reader.accessToken, app, title: "Free Book" });

    const order = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        deliveryPrice: 80,
        items: [{ bookId, price: 0 }],
        storeName: "Yakaboo",
      },
    });

    expect(order).toMatchObject({ isFree: false, totalAmount: 80 });
  });
});

describe("PATCH /api/delivery/orders/:orderId under the order invariant", () => {
  it("drops every book price when the reader marks a paid order free", async () => {
    const bookId = await createBook({ accessToken: reader.accessToken, app, title: "Gifted" });
    const order = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        deliveryPrice: 80,
        items: [{ bookId, price: 350 }],
        storeName: "Yakaboo",
      },
    });

    const res = await patchJson({
      accessToken: reader.accessToken,
      app,
      body: { isFree: true },
      path: ORDER_ROUTES.order(order.id),
    });

    expect(res.status).toBe(200);
    expect(BookOrderViewSchema.parse(res.body)).toMatchObject({
      deliveryPrice: null,
      discount: null,
      isFree: true,
      items: [{ bookId, price: null }],
      totalAmount: 0,
    });
  });

  it("refuses an update that would leave the order without a total", async () => {
    const bookIds = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: ["Priced", "Unpriced"],
    });
    const order = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        items: [{ bookId: bookIds[0] ?? "", price: 350 }, { bookId: bookIds[1] ?? "" }],
        storeName: "Yakaboo",
        totalAmount: 700,
      },
    });

    const res = await patchJson({
      accessToken: reader.accessToken,
      app,
      body: { totalAmount: null },
      path: ORDER_ROUTES.order(order.id),
    });

    expect(res.status).toBe(400);
    await expect(
      getJson({ accessToken: reader.accessToken, app, path: ORDER_ROUTES.order(order.id) }).then(
        (kept) => kept.body.totalAmount,
      ),
    ).resolves.toBe(700);
  });
});

describe("POST /api/delivery/orders", () => {
  it("puts one book and one parcel under a single order", async () => {
    const bookId = await createBook({ accessToken: reader.accessToken, app, title: "Dune" });

    const order = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        items: [{ bookId, price: 350 }],
        orderDate: isoDay(-3),
        shipments: [
          {
            bookIds: [bookId],
            expectedDeliveryDate: isoDay(4),
            trackingNumber: "NP-1",
          },
        ],
        storeName: "Yakaboo",
      },
    });

    expect(BookOrderViewSchema.parse(order)).toMatchObject({
      derivedStatus: "active",
      items: [{ bookId, price: 350 }],
      storeName: "Yakaboo",
    });
    expect(order.shipments).toHaveLength(1);
    expect(shipmentOf({ bookId, view: order })).toMatchObject({
      status: "ordered",
      trackingNumber: "NP-1",
    });
    await expect(countRows(reader.userId)).resolves.toEqual({ items: 1, orders: 1, shipments: 1 });
    await expect(ownershipOf({ accessToken: reader.accessToken, app, bookId })).resolves.toBe(
      "in_transit",
    );
  });

  it("puts three books into one parcel of one order", async () => {
    const bookIds = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: ["Dune", "Dune Messiah", "Children of Dune"],
    });

    const order = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        items: bookIds.map((bookId) => ({ bookId, price: 200 })),
        orderDate: isoDay(-1),
        shipments: [{ bookIds, expectedDeliveryDate: isoDay(6) }],
        storeName: "Yakaboo",
      },
    });

    expect(order.items).toHaveLength(3);
    expect(order.shipments).toHaveLength(1);
    expect(new Set(order.items.map((item) => item.shipmentId))).toEqual(
      new Set([order.shipments[0]?.id]),
    );
    await expect(countRows(reader.userId)).resolves.toEqual({ items: 3, orders: 1, shipments: 1 });

    const ownerships = await Promise.all(
      bookIds.map((bookId) => ownershipOf({ accessToken: reader.accessToken, app, bookId })),
    );
    expect(ownerships).toEqual(["in_transit", "in_transit", "in_transit"]);
  });

  it("splits five books across two parcels of one order", async () => {
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
        orderDate: isoDay(-2),
        shipments: [
          { bookIds: firstParcel, expectedDeliveryDate: isoDay(3), trackingNumber: "NP-A" },
          { bookIds: secondParcel, expectedDeliveryDate: isoDay(9), trackingNumber: "NP-B" },
        ],
        storeName: "Book Depot",
      },
    });

    expect(order.items).toHaveLength(5);
    expect(order.shipments).toHaveLength(2);
    await expect(countRows(reader.userId)).resolves.toEqual({ items: 5, orders: 1, shipments: 2 });

    const parcelA = shipmentOf({ bookId: firstParcel[0] ?? "", view: order });
    const parcelB = shipmentOf({ bookId: secondParcel[0] ?? "", view: order });
    expect(parcelA.id).not.toBe(parcelB.id);
    expect(
      firstParcel.every((bookId) => shipmentOf({ bookId, view: order }).id === parcelA.id),
    ).toBe(true);
    expect(
      secondParcel.every((bookId) => shipmentOf({ bookId, view: order }).id === parcelB.id),
    ).toBe(true);

    const ownerships = await Promise.all(
      bookIds.map((bookId) => ownershipOf({ accessToken: reader.accessToken, app, bookId })),
    );
    expect(ownerships).toEqual(new Array(5).fill("in_transit"));
  });

  it("keeps books without a parcel in the order and leaves them unshipped", async () => {
    const bookIds = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: ["Shipped", "Unshipped"],
    });

    const order = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        items: bookIds.map((bookId) => ({ bookId })),
        orderDate: isoDay(0),
        shipments: [{ bookIds: [bookIds[0] ?? ""], status: "in_transit" }],
        storeName: "Yakaboo",
        totalAmount: 500,
      },
    });

    expect(order.derivedStatus).toBe("partially_shipped");
    expect(order.items.filter((item) => item.shipmentId === null)).toHaveLength(1);
    await expect(countRows(reader.userId)).resolves.toEqual({ items: 2, orders: 1, shipments: 1 });
  });

  it("refuses to order a book that is already on its way", async () => {
    const bookId = await createBook({ accessToken: reader.accessToken, app, title: "Dune" });
    const input = {
      items: [{ bookId }],
      orderDate: isoDay(0),
      shipments: [{ bookIds: [bookId] }],
      storeName: "Yakaboo",
      totalAmount: 500,
    };
    await createOrder({ accessToken: reader.accessToken, app, input });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: input,
      path: ORDER_ROUTES.orders,
    });

    expect(res.status).toBe(409);
    await expect(countRows(reader.userId)).resolves.toMatchObject({ orders: 1 });
  });

  it("refuses to order another reader's book and writes nothing", async () => {
    const stranger = await context.registerVerifyAndLogin();
    const foreignBookId = await createBook({
      accessToken: stranger.accessToken,
      app,
      title: "Not yours",
    });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: {
        items: [{ bookId: foreignBookId }],
        orderDate: isoDay(0),
        storeName: "Yakaboo",
      },
      path: ORDER_ROUTES.orders,
    });

    expect(res.status).toBe(404);
    await expect(countRows(reader.userId)).resolves.toEqual({ items: 0, orders: 0, shipments: 0 });
    await expect(countRows(stranger.userId)).resolves.toEqual({
      items: 0,
      orders: 0,
      shipments: 0,
    });
  });

  it("hides an order of another reader behind a 404", async () => {
    const stranger = await context.registerVerifyAndLogin();
    const bookId = await createBook({
      accessToken: stranger.accessToken,
      app,
      title: "Theirs",
    });
    const foreignOrder = await createOrder({
      accessToken: stranger.accessToken,
      app,
      input: {
        items: [{ bookId }],
        orderDate: isoDay(0),
        storeName: "Yakaboo",
        totalAmount: 500,
      },
    });

    const res = await getJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.order(foreignOrder.id),
    });

    expect(res.status).toBe(404);
  });
});
