import type { BookOrderHistoryFacetsView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { BookOrderHistoryFacetsViewSchema } from "@app/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

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
  ORDER_ROUTES,
  postJson,
  shipmentOf,
} from "./book-order.fixtures.js";

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

async function facets(query: string): Promise<BookOrderHistoryFacetsView> {
  const res = await requestFacets(query);
  expect(res.status).toBe(200);
  return BookOrderHistoryFacetsViewSchema.parse(res.body);
}

function names(entries: BookOrderHistoryFacetsView["stores"]): string[] {
  return entries.map((entry) => entry.name);
}

function requestFacets(query: string) {
  return getJson({
    accessToken: reader.accessToken,
    app,
    path: `${ORDER_ROUTES.historyFacets}?${query}`,
  });
}

async function seedTerminalOrders() {
  const accessToken = reader.accessToken;
  const received = await createBooks({ accessToken, app, titles: ["Dune", "Messiah"] });
  const cancelled = await createBook({ accessToken, app, title: "Children" });

  const receivedOrder = await createOrder({
    accessToken,
    app,
    input: {
      items: received.map((bookId) => ({ bookId, price: 100 })),
      shipments: [{ bookIds: received, deliveryService: "Nova Poshta" }],
      storeName: "Yakaboo",
      totalAmount: 200,
    },
  });
  const cancelledOrder = await createOrder({
    accessToken,
    app,
    input: {
      items: [{ bookId: cancelled, price: 50 }],
      shipments: [{ bookIds: [cancelled], deliveryService: "Ukrposhta" }],
      storeName: "Book24",
      totalAmount: 50,
    },
  });

  await postJson({
    accessToken,
    app,
    body: {},
    path: ORDER_ROUTES.receiveShipment(
      shipmentOf({ bookId: received[0] ?? "", view: receivedOrder }).id,
    ),
  });
  await postJson({
    accessToken,
    app,
    body: { keepAsWantToBuy: true },
    path: ORDER_ROUTES.cancelShipment(shipmentOf({ bookId: cancelled, view: cancelledOrder }).id),
  });
}

describe("GET /api/delivery/books/history/facets", () => {
  it("answers with empty lists when no order has finished yet", async () => {
    const view = await facets("tab=received");

    expect(view).toEqual({ services: [], stores: [] });
  });

  it("lists only what the received tab actually holds", async () => {
    await seedTerminalOrders();

    const view = await facets("tab=received");

    expect(names(view.stores)).toEqual(["Yakaboo"]);
    expect(names(view.services)).toEqual(["Nova Poshta"]);
  });

  it("lists only what the cancelled tab actually holds", async () => {
    await seedTerminalOrders();

    const view = await facets("tab=cancelled");

    expect(names(view.stores)).toEqual(["Book24"]);
    expect(names(view.services)).toEqual(["Ukrposhta"]);
  });

  it("counts the orders behind every store and service", async () => {
    await seedTerminalOrders();

    const view = await facets("tab=received");

    expect(view.stores[0]?.count).toBe(1);
    expect(view.services[0]?.count).toBe(1);
  });

  it("refuses a tab that carries no finished orders", async () => {
    const res = await requestFacets("tab=active");

    expect(res.status).toBe(400);
  });

  it("refuses a request that names no tab", async () => {
    const res = await requestFacets("");

    expect(res.status).toBe(400);
  });
});
