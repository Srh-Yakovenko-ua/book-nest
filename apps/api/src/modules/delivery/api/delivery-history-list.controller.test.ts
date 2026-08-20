import type { OrderHistoryGroupView, PaginatedOrderHistoryGroups } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { PaginatedOrderHistoryGroupsSchema } from "@app/shared";
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

function booksOf(group: OrderHistoryGroupView | undefined): string[] {
  return (group?.shipments ?? [])
    .flatMap((shipmentGroup) => shipmentGroup.books.map((entry) => entry.book.title))
    .sort();
}

async function history(query: string): Promise<PaginatedOrderHistoryGroups> {
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: `${ORDER_ROUTES.history}?${query}`,
  });
  expect(res.status).toBe(200);
  return PaginatedOrderHistoryGroupsSchema.parse(res.body);
}

function idAt(ids: string[], index: number): string {
  const id = ids[index];
  if (id === undefined) throw new Error(`no seeded id at index ${index}`);
  return id;
}

async function seedSplitOrder() {
  const accessToken = reader.accessToken;
  const bookIds = await createBooks({
    accessToken,
    app,
    titles: ["Dune", "Messiah", "Children", "Emperor"],
  });
  const first = idAt(bookIds, 0);
  const second = idAt(bookIds, 1);
  const third = idAt(bookIds, 2);
  const fourth = idAt(bookIds, 3);

  const order = await createOrder({
    accessToken,
    app,
    input: {
      items: bookIds.map((bookId) => ({ bookId, price: 100 })),
      orderDate: isoDay(-20),
      shipments: [
        {
          bookIds: [first, second],
          deliveryService: "Nova Poshta",
          trackingNumber: "TRK-1",
        },
        { bookIds: [third], deliveryService: "Ukrposhta" },
      ],
      storeName: "Book24",
      totalAmount: 400,
    },
  });

  const firstShipment = shipmentOf({ bookId: first, view: order });
  const secondShipment = shipmentOf({ bookId: third, view: order });

  await postJson({
    accessToken,
    app,
    body: { receivedAt: isoDay(-3) },
    path: ORDER_ROUTES.receiveShipment(firstShipment.id),
  });
  await postJson({
    accessToken,
    app,
    body: { cancelReason: "Out of stock", keepAsWantToBuy: true },
    path: ORDER_ROUTES.cancelShipment(secondShipment.id),
  });

  const unshippedItem = order.items.find((item) => item.bookId === fourth);
  if (unshippedItem === undefined) throw new Error("the fourth book has no order item");
  await postJson({
    accessToken,
    app,
    body: { cancelReason: "Found it cheaper", keepAsWantToBuy: true },
    path: ORDER_ROUTES.cancelItem(unshippedItem.id),
  });

  return order;
}

describe("GET /api/delivery/books/history", () => {
  it("returns an empty page when nothing has finished yet", async () => {
    const page = await history("tab=received");

    expect(page.items).toEqual([]);
    expect(page.totalCount).toBe(0);
    expect(page.totalBooksCount).toBe(0);
  });

  it("paginates orders and counts books in their own field", async () => {
    await seedSplitOrder();

    const page = await history("tab=received");

    expect(page.totalCount).toBe(1);
    expect(page.totalBooksCount).toBe(2);
    expect(page.items).toHaveLength(1);
  });

  it("gives the received tab only the received books of the order", async () => {
    await seedSplitOrder();

    const page = await history("tab=received");
    const group = page.items[0];

    expect(booksOf(group)).toEqual(["Dune", "Messiah"]);
    expect(group?.booksCount).toBe(2);
  });

  it("gives the cancelled tab only the cancelled books of the same order", async () => {
    await seedSplitOrder();

    const page = await history("tab=cancelled");
    const group = page.items[0];

    expect(booksOf(group)).toEqual(["Children", "Emperor"]);
    expect(group?.booksCount).toBe(2);
  });

  it("keeps the canonical order total in the header of both tabs", async () => {
    await seedSplitOrder();

    const [received, cancelled] = await Promise.all([
      history("tab=received"),
      history("tab=cancelled"),
    ]);

    expect(received.items[0]?.order.effectiveTotalAmount).toBe(400);
    expect(cancelled.items[0]?.order.effectiveTotalAmount).toBe(400);
  });

  it("carries the terminal state of each parcel", async () => {
    await seedSplitOrder();

    const received = await history("tab=received");
    const cancelled = await history("tab=cancelled");
    const receivedParcel = received.items[0]?.shipments[0]?.shipment;
    const cancelledParcel = cancelled.items[0]?.shipments.find(
      (group) => group.shipment?.status === "cancelled",
    )?.shipment;

    expect(receivedParcel?.status).toBe("received");
    expect(receivedParcel?.receivedAt).not.toBeNull();
    expect(receivedParcel?.trackingNumber).toBe("TRK-1");
    expect(cancelledParcel?.cancelReason).toBe("Out of stock");
    expect(cancelledParcel?.cancelledAt).not.toBeNull();
  });

  it("keeps a book cancelled before dispatch in a group without a parcel", async () => {
    await seedSplitOrder();

    const page = await history("tab=cancelled");
    const loose = page.items[0]?.shipments.find((group) => group.shipment === null);

    expect(loose?.books.map((entry) => entry.book.title)).toEqual(["Emperor"]);
    expect(loose?.books[0]?.cancelReason).toBe("Found it cheaper");
  });

  it("narrows the parcels of a card to the delivery service that was filtered on", async () => {
    await seedSplitOrder();

    const page = await history("tab=cancelled&service=Ukrposhta");
    const group = page.items[0];

    expect(group?.shipments).toHaveLength(1);
    expect(group?.shipments[0]?.shipment?.deliveryService?.name).toBe("Ukrposhta");
    expect(group?.booksCount).toBe(1);
    expect(page.totalBooksCount).toBe(1);
  });

  it("lets a search hit on one book still render the whole tab of its order", async () => {
    await seedSplitOrder();

    const page = await history("tab=received&search=Messiah");

    expect(page.totalCount).toBe(1);
    expect(booksOf(page.items[0])).toEqual(["Dune", "Messiah"]);
  });

  it("finds an order by its store name without emptying the card", async () => {
    await seedSplitOrder();

    const page = await history("tab=received&search=Book24");

    expect(page.items[0]?.booksCount).toBe(2);
  });

  it("orders the page by the canonical total once a currency narrows the selection", async () => {
    const accessToken = reader.accessToken;
    const priced = await createBooks({ accessToken, app, titles: ["Cheap", "Pricey"] });
    const plan = [
      { bookId: idAt(priced, 0), price: 50, storeName: "Small" },
      { bookId: idAt(priced, 1), price: 900, storeName: "Big" },
    ];

    for (const { bookId, price, storeName } of plan) {
      const order = await createOrder({
        accessToken,
        app,
        input: {
          items: [{ bookId, price }],
          shipments: [{ bookIds: [bookId] }],
          storeName,
          totalAmount: price,
        },
      });
      await postJson({
        accessToken,
        app,
        body: {},
        path: ORDER_ROUTES.receiveShipment(shipmentOf({ bookId, view: order }).id),
      });
    }

    const ascending = await history("tab=received&currency=UAH&sort=price_asc");
    const descending = await history("tab=received&currency=UAH&sort=price_desc");

    expect(ascending.items.map((group) => group.order.storeName)).toEqual(["Small", "Big"]);
    expect(descending.items.map((group) => group.order.storeName)).toEqual(["Big", "Small"]);
  });

  it("falls back to the default sort when a price sort names no currency", async () => {
    await seedSplitOrder();

    const page = await history("tab=received&sort=price_desc");

    expect(page.totalCount).toBe(1);
  });
});
