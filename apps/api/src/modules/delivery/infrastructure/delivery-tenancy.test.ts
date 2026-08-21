import type { BookOrderView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import {
  createBooks,
  createOrder,
  getJson,
  isoDay,
  itemOf,
  ORDER_ROUTES,
  patchJson,
  postJson,
  shipmentOf,
} from "../api/book-order.fixtures.js";
import { DeliveryModule } from "../delivery.module.js";

type Attack = {
  entry: string;
  run: () => Promise<number>;
};

type VictimOrder = {
  bookIds: string[];
  itemIds: string[];
  order: BookOrderView;
  shipmentIds: string[];
};

const NOT_FOUND = 404;

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let attacker: AuthenticatedUser;
let victim: AuthenticatedUser;
let victimOrder: VictimOrder;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, DeliveryModule]);
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(async () => {
  context.reset();
  victim = await context.registerVerifyAndLogin();
  attacker = await context.registerVerifyAndLogin();
  victimOrder = await seedVictimOrder();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function attacksOnVictimRows(): Attack[] {
  const { bookIds, itemIds, order, shipmentIds } = victimOrder;
  const [firstShipment, secondShipment] = shipmentIds;
  const attack = {
    accessToken: attacker.accessToken,
    app,
  };

  return [
    {
      entry: "POST /orders with a foreign book",
      run: () =>
        status(
          postJson({
            ...attack,
            body: {
              currency: "UAH",
              items: [{ bookId: bookIds[0], price: 350 }],
              orderDate: isoDay(0),
              storeName: "Stolen",
            },
            path: ORDER_ROUTES.orders,
          }),
        ),
    },
    {
      entry: "GET /orders/:orderId",
      run: () => status(getJson({ ...attack, path: ORDER_ROUTES.order(order.id) })),
    },
    {
      entry: "PATCH /orders/:orderId",
      run: () =>
        status(
          patchJson({
            ...attack,
            body: { storeName: "Stolen" },
            path: ORDER_ROUTES.order(order.id),
          }),
        ),
    },
    {
      entry: "POST /orders/:orderId/shipments",
      run: () =>
        status(
          postJson({
            ...attack,
            body: { itemIds: [itemIds[0]] },
            path: ORDER_ROUTES.createShipment(order.id),
          }),
        ),
    },
    {
      entry: "POST /orders/:orderId/items/move",
      run: () =>
        status(
          postJson({
            ...attack,
            body: { itemIds: [itemIds[0]], shipmentId: secondShipment },
            path: ORDER_ROUTES.moveItems(order.id),
          }),
        ),
    },
    {
      entry: "PATCH /shipments/:shipmentId",
      run: () =>
        status(
          patchJson({
            ...attack,
            body: { trackingNumber: "STOLEN" },
            path: ORDER_ROUTES.updateShipment(firstShipment ?? ""),
          }),
        ),
    },
    {
      entry: "POST /shipments/:shipmentId/in-transit",
      run: () =>
        status(postJson({ ...attack, path: ORDER_ROUTES.markInTransit(firstShipment ?? "") })),
    },
    {
      entry: "POST /shipments/:shipmentId/ready-for-pickup",
      run: () =>
        status(postJson({ ...attack, path: ORDER_ROUTES.markReadyForPickup(firstShipment ?? "") })),
    },
    {
      entry: "POST /shipments/:shipmentId/receive",
      run: () =>
        status(postJson({ ...attack, path: ORDER_ROUTES.receiveShipment(firstShipment ?? "") })),
    },
    {
      entry: "POST /shipments/:shipmentId/cancel",
      run: () =>
        status(postJson({ ...attack, path: ORDER_ROUTES.cancelShipment(firstShipment ?? "") })),
    },
    {
      entry: "POST /items/:itemId/cancel",
      run: () => status(postJson({ ...attack, path: ORDER_ROUTES.cancelItem(itemIds[0] ?? "") })),
    },
  ];
}

async function readVictimState(): Promise<unknown> {
  const [orders, books] = await Promise.all([
    prisma.bookOrder.findMany({
      include: {
        items: { orderBy: { id: "asc" } },
        shipments: { orderBy: { id: "asc" } },
      },
      orderBy: { id: "asc" },
      where: { userId: victim.userId },
    }),
    prisma.book.findMany({
      orderBy: { id: "asc" },
      select: { id: true, ownershipStatus: true },
      where: { userId: victim.userId },
    }),
  ]);
  return { books, orders };
}

async function seedVictimOrder(): Promise<VictimOrder> {
  const bookIds = await createBooks({
    accessToken: victim.accessToken,
    app,
    titles: ["Victim One", "Victim Two"],
  });
  const order = await createOrder({
    accessToken: victim.accessToken,
    app,
    input: {
      currency: "UAH",
      items: bookIds.map((bookId) => ({ bookId, price: 250 })),
      orderDate: isoDay(-30),
      shipments: [
        { bookIds: [bookIds[0] ?? ""], expectedDeliveryDate: isoDay(2), trackingNumber: "V-A" },
        { bookIds: [bookIds[1] ?? ""], expectedDeliveryDate: isoDay(6), trackingNumber: "V-B" },
      ],
      storeName: "Yakaboo",
    },
  });

  return {
    bookIds,
    itemIds: bookIds.map((bookId) => itemOf({ bookId, view: order }).id),
    order,
    shipmentIds: bookIds.map((bookId) => shipmentOf({ bookId, view: order }).id),
  };
}

async function status(test: ReturnType<typeof getJson>): Promise<number> {
  const res = await test;
  return res.status;
}

describe("the order write surface under a second reader", () => {
  it("answers every entry with a 404 and leaves the victim's rows untouched", async () => {
    const before = await readVictimState();
    const attacks = attacksOnVictimRows();

    const outcomes: Record<string, number> = {};
    for (const attack of attacks) {
      outcomes[attack.entry] = await attack.run();
    }

    expect(outcomes).toEqual(
      Object.fromEntries(attacks.map((attack) => [attack.entry, NOT_FOUND])),
    );
    await expect(readVictimState()).resolves.toEqual(before);
  });

  it("skips a foreign book in the bulk receive instead of receiving it", async () => {
    const before = await readVictimState();

    const res = await postJson({
      accessToken: attacker.accessToken,
      app,
      body: { bookIds: victimOrder.bookIds },
      path: ORDER_ROUTES.receiveBooks,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      receivedBookIds: [],
      skipped: victimOrder.bookIds.map((bookId) => ({ bookId, reason: "not_found" })),
    });
    await expect(readVictimState()).resolves.toEqual(before);
  });
});

describe("the order read surface under a second reader", () => {
  it("shows nothing of the victim's order in any list or summary", async () => {
    const [inTransit, history, inTransitSummary, historySummary, statistics] = await Promise.all([
      getJson({ accessToken: attacker.accessToken, app, path: ORDER_ROUTES.inTransit }),
      getJson({ accessToken: attacker.accessToken, app, path: ORDER_ROUTES.history }),
      getJson({ accessToken: attacker.accessToken, app, path: ORDER_ROUTES.inTransitSummary }),
      getJson({ accessToken: attacker.accessToken, app, path: ORDER_ROUTES.historySummary }),
      getJson({ accessToken: attacker.accessToken, app, path: ORDER_ROUTES.statistics }),
    ]);

    expect(inTransit.body).toMatchObject({ items: [], totalCount: 0 });
    expect(history.body).toMatchObject({ items: [], totalCount: 0 });
    expect(inTransitSummary.body).toMatchObject({
      activeBooksCount: 0,
      activeOrdersCount: 0,
      attention: [],
    });
    expect(historySummary.body).toMatchObject({
      completedOrdersCount: 0,
      receivedBooksCount: 0,
      receivedOrdersCount: 0,
    });
    expect(statistics.body.summary).toMatchObject({ booksCount: 0, ordersCount: 0 });
    expect(statistics.body.byStore).toEqual([]);
  });

  it("still reports the victim's own attention case to the victim", async () => {
    const res = await getJson({
      accessToken: victim.accessToken,
      app,
      path: ORDER_ROUTES.inTransitSummary,
    });

    expect(res.body.attention).toEqual([
      expect.objectContaining({ count: 1, reason: "awaiting_dispatch" }),
    ]);
  });

  it("still shows the victim their own order", async () => {
    const res = await getJson({
      accessToken: victim.accessToken,
      app,
      path: ORDER_ROUTES.order(victimOrder.order.id),
    });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });
});
