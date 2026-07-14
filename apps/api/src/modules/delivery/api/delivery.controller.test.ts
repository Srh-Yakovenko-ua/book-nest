import type { INestApplication } from "@nestjs/common";

import {
  DeliveryStatisticsViewSchema,
  type DeliveryStatus,
  type Nullable,
  type OwnershipStatus,
} from "@app/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { DeliveryModule } from "../delivery.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FUTURE_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10);
const DAY_MS = 1000 * 60 * 60 * 24;
const isoDay = (offset: number): string =>
  new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);
const utcDay = (offset: number): Date => new Date(`${isoDay(offset)}T00:00:00.000Z`);

type DeliverySeed = {
  cancelledAt?: Nullable<Date>;
  cancelReason?: Nullable<string>;
  currency?: Nullable<string>;
  deliveryService?: Nullable<string>;
  expectedDeliveryDate?: Nullable<Date>;
  orderDate?: Nullable<Date>;
  ownershipStatus: OwnershipStatus;
  price?: Nullable<number>;
  receivedAt?: Nullable<Date>;
  status: DeliveryStatus;
  storeName?: Nullable<string>;
  trackingNumber?: Nullable<string>;
  trackingUrl?: Nullable<string>;
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, DeliveryModule]);
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  context.reset();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function bulkReceive(accessToken: string, bookIds: string[], receivedAt?: string): request.Test {
  return request(app.getHttpServer())
    .post("/api/delivery/receive")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(receivedAt === undefined ? { bookIds } : { bookIds, receivedAt });
}

async function createBook(
  accessToken: string,
  title: string,
  author = "Frank Herbert",
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ authors: [{ name: author }], title });
  if (typeof res.body.id !== "string") {
    throw new Error(`book creation failed with status ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.id;
}

function getJson(accessToken: string, path: string): request.Test {
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

async function seedActiveSet(user: AuthenticatedUser): Promise<void> {
  await seedDelivery(user, "Delayed", {
    currency: "UAH",
    expectedDeliveryDate: utcDay(-30),
    ownershipStatus: "in_transit",
    price: 100,
    status: "ordered",
    storeName: "Yakaboo",
  });
  await seedDelivery(user, "This Week", {
    currency: "UAH",
    expectedDeliveryDate: utcDay(0),
    ownershipStatus: "in_transit",
    price: 200,
    status: "in_transit",
    storeName: "  yakaboo ",
  });
  await seedDelivery(user, "Future", {
    currency: "USD",
    expectedDeliveryDate: utcDay(30),
    ownershipStatus: "in_transit",
    price: 50,
    status: "ready_for_pickup",
    storeName: "Book Depot",
  });
  await seedDelivery(user, "Received", {
    currency: "UAH",
    ownershipStatus: "owned",
    price: 999,
    receivedAt: new Date(),
    status: "received",
    storeName: "Ignore Store",
  });
  await seedDelivery(user, "Cancelled", {
    cancelledAt: new Date(),
    currency: "UAH",
    ownershipStatus: "want_to_buy",
    price: 888,
    status: "cancelled",
    storeName: "Ignore Store",
  });
  await seedDelivery(user, "Orphan Order", {
    currency: "UAH",
    ownershipStatus: "want_to_buy",
    price: 777,
    status: "ordered",
    storeName: "Ignore Store",
  });
}

async function seedDelivery(
  user: AuthenticatedUser,
  title: string,
  seed: DeliverySeed,
  author = "Frank Herbert",
): Promise<string> {
  const bookId = await createBook(user.accessToken, title, author);
  await prisma.book.update({
    data: { ownershipStatus: seed.ownershipStatus },
    where: { id: bookId },
  });
  await prisma.bookDelivery.create({
    data: {
      bookId,
      cancelledAt: seed.cancelledAt ?? null,
      cancelReason: seed.cancelReason ?? null,
      currency: seed.currency ?? null,
      deliveryService: seed.deliveryService ?? null,
      expectedDeliveryDate: seed.expectedDeliveryDate ?? null,
      note: null,
      orderDate: seed.orderDate ?? null,
      price: seed.price ?? null,
      receivedAt: seed.receivedAt ?? null,
      status: seed.status,
      storeName: seed.storeName ?? null,
      trackingNumber: seed.trackingNumber ?? null,
      trackingUrl: seed.trackingUrl ?? null,
      userId: user.userId,
    },
  });
  return bookId;
}

describe("delivery endpoints authorization", () => {
  it.each([
    ["GET", "/api/delivery/in-transit/summary"],
    ["GET", "/api/delivery/in-transit"],
    ["GET", "/api/delivery/history/summary"],
    ["GET", "/api/delivery/history"],
    ["GET", "/api/delivery/statistics"],
  ])("returns 401 for %s %s without an Authorization header", async (_method, path) => {
    const res = await request(app.getHttpServer()).get(path);

    expect(res.status).toBe(401);
  });

  it("returns 401 for POST /api/delivery/receive without an Authorization header", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/delivery/receive")
      .send({ bookIds: [MISSING_UUID] });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/delivery/in-transit/summary", () => {
  it("returns zeroed metrics when the user has no in-transit deliveries", async () => {
    const user = await context.registerVerifyAndLogin();

    const res = await getJson(user.accessToken, "/api/delivery/in-transit/summary");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      activeCount: 0,
      delayedCount: 0,
      expectedThisWeek: 0,
      totalByCurrency: [],
      uniqueStores: 0,
    });
  });

  it("counts only active in-transit deliveries and derives the summary metrics", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedActiveSet(user);

    const res = await getJson(user.accessToken, "/api/delivery/in-transit/summary");

    expect(res.status).toBe(200);
    expect(res.body.activeCount).toBe(3);
    expect(res.body.delayedCount).toBe(1);
    expect(res.body.expectedThisWeek).toBe(1);
    expect(res.body.uniqueStores).toBe(2);
    expect(res.body.totalByCurrency).toEqual([
      { currency: "UAH", total: 300 },
      { currency: "USD", total: 50 },
    ]);
  });

  it("defaults a null-currency active priced delivery to UAH and merges it with explicit UAH", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "Null Currency", {
      currency: null,
      expectedDeliveryDate: utcDay(3),
      ownershipStatus: "in_transit",
      price: 500,
      status: "ordered",
      storeName: "Yakaboo",
    });
    await seedDelivery(user, "Explicit UAH", {
      currency: "UAH",
      expectedDeliveryDate: utcDay(3),
      ownershipStatus: "in_transit",
      price: 100,
      status: "ordered",
      storeName: "Yakaboo",
    });

    const res = await getJson(user.accessToken, "/api/delivery/in-transit/summary");

    expect(res.status).toBe(200);
    expect(res.body.totalByCurrency).toEqual([{ currency: "UAH", total: 600 }]);
  });
});

describe("GET /api/delivery/in-transit", () => {
  it("lists only active in-transit deliveries with computed ui status ordered by closest delivery", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedActiveSet(user);

    const res = await getJson(user.accessToken, "/api/delivery/in-transit");

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(3);
    expect(res.body.items.map((item: { book: { title: string } }) => item.book.title)).toEqual([
      "Delayed",
      "This Week",
      "Future",
    ]);
    expect(res.body.items.map((item: { uiStatus: Nullable<string> }) => item.uiStatus)).toEqual([
      "delayed",
      "arriving_soon",
      null,
    ]);
    expect(res.body.items[0].id).toMatch(UUID);
  });

  it("filters delayed deliveries", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedActiveSet(user);

    const res = await getJson(user.accessToken, "/api/delivery/in-transit?filter=delayed");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Delayed");
  });

  it("filters deliveries without a delivery date", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "No Date", {
      expectedDeliveryDate: null,
      ownershipStatus: "in_transit",
      status: "ordered",
      storeName: "Yakaboo",
    });
    await seedDelivery(user, "Dated", {
      expectedDeliveryDate: utcDay(3),
      ownershipStatus: "in_transit",
      status: "ordered",
      storeName: "Yakaboo",
    });

    const res = await getJson(user.accessToken, "/api/delivery/in-transit?filter=no_delivery_date");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("No Date");
    expect(res.body.items[0].uiStatus).toBe("no_delivery_date");
  });

  it("filters deliveries that have a price", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "Priced", {
      currency: "UAH",
      ownershipStatus: "in_transit",
      price: 120,
      status: "ordered",
      storeName: "Yakaboo",
    });
    await seedDelivery(user, "No Price", {
      ownershipStatus: "in_transit",
      price: null,
      status: "ordered",
      storeName: "Yakaboo",
    });

    const res = await getJson(user.accessToken, "/api/delivery/in-transit?filter=has_price");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Priced");
  });

  it("sorts by price ascending with missing prices last", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "Cheap", {
      currency: "UAH",
      ownershipStatus: "in_transit",
      price: 10,
      status: "ordered",
      storeName: "Yakaboo",
    });
    await seedDelivery(user, "Pricey", {
      currency: "UAH",
      ownershipStatus: "in_transit",
      price: 90,
      status: "ordered",
      storeName: "Yakaboo",
    });
    await seedDelivery(user, "Unpriced", {
      ownershipStatus: "in_transit",
      price: null,
      status: "ordered",
      storeName: "Yakaboo",
    });

    const res = await getJson(user.accessToken, "/api/delivery/in-transit?sort=price");

    expect(res.body.items.map((item: { book: { title: string } }) => item.book.title)).toEqual([
      "Cheap",
      "Pricey",
      "Unpriced",
    ]);
  });

  it("searches by book title", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "The Left Hand of Darkness", {
      ownershipStatus: "in_transit",
      status: "ordered",
      storeName: "Yakaboo",
    });
    await seedDelivery(user, "Hyperion", {
      ownershipStatus: "in_transit",
      status: "ordered",
      storeName: "Book Depot",
    });

    const res = await getJson(user.accessToken, "/api/delivery/in-transit?search=left hand");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("The Left Hand of Darkness");
  });

  it("searches by store name", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "First", {
      ownershipStatus: "in_transit",
      status: "ordered",
      storeName: "Yakaboo",
    });
    await seedDelivery(user, "Second", {
      ownershipStatus: "in_transit",
      status: "ordered",
      storeName: "Book Depot",
    });

    const res = await getJson(user.accessToken, "/api/delivery/in-transit?search=depot");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Second");
  });

  it("does not match the cancel reason field when searching active deliveries", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "Active With Reason", {
      cancelReason: "Damaged in shipping",
      ownershipStatus: "in_transit",
      status: "ordered",
      storeName: "Yakaboo",
    });

    const res = await getJson(user.accessToken, "/api/delivery/in-transit?search=damaged");

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.totalCount).toBe(0);
  });

  it("returns 400 for an invalid sort value", async () => {
    const user = await context.registerVerifyAndLogin();

    const res = await getJson(user.accessToken, "/api/delivery/in-transit?sort=bogus");

    expect(res.status).toBe(400);
  });
});

async function seedHistorySet(user: AuthenticatedUser): Promise<void> {
  await seedDelivery(user, "Active Order", {
    currency: "UAH",
    orderDate: utcDay(-5),
    ownershipStatus: "in_transit",
    price: 100,
    status: "in_transit",
    storeName: "Yakaboo",
    trackingNumber: "TN-1",
  });
  await seedDelivery(user, "Received Order", {
    currency: "USD",
    orderDate: utcDay(-10),
    ownershipStatus: "owned",
    price: 200,
    receivedAt: new Date(),
    status: "received",
    storeName: "Book Depot",
  });
  await seedDelivery(user, "Cancelled Order", {
    cancelledAt: new Date(),
    currency: "UAH",
    orderDate: utcDay(-3),
    ownershipStatus: "want_to_buy",
    price: 50,
    status: "cancelled",
    storeName: "Yakaboo",
  });
}

describe("GET /api/delivery/history/summary", () => {
  it("counts orders by status and totals only non-cancelled priced orders by currency", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedHistorySet(user);

    const res = await getJson(user.accessToken, "/api/delivery/history/summary");

    expect(res.status).toBe(200);
    expect(res.body.totalOrders).toBe(3);
    expect(res.body.activeCount).toBe(1);
    expect(res.body.receivedCount).toBe(1);
    expect(res.body.cancelledCount).toBe(1);
    expect(res.body.totalByCurrency).toEqual([
      { currency: "UAH", total: 100 },
      { currency: "USD", total: 200 },
    ]);
  });

  it("defaults null-currency non-cancelled priced orders to UAH in the total", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "Active Null", {
      currency: null,
      orderDate: utcDay(-5),
      ownershipStatus: "in_transit",
      price: 500,
      status: "ordered",
      storeName: "Yakaboo",
    });
    await seedDelivery(user, "Received Null", {
      currency: null,
      orderDate: utcDay(-10),
      ownershipStatus: "owned",
      price: 200,
      receivedAt: new Date(),
      status: "received",
      storeName: "Book Depot",
    });

    const res = await getJson(user.accessToken, "/api/delivery/history/summary");

    expect(res.status).toBe(200);
    expect(res.body.totalByCurrency).toEqual([{ currency: "UAH", total: 700 }]);
  });
});

describe("GET /api/delivery/history", () => {
  it("lists every order regardless of status ordered by newest orders", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedHistorySet(user);

    const res = await getJson(user.accessToken, "/api/delivery/history");

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(3);
    expect(res.body.items.map((item: { book: { title: string } }) => item.book.title)).toEqual([
      "Cancelled Order",
      "Active Order",
      "Received Order",
    ]);
  });

  it("filters to the active tab", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedHistorySet(user);

    const res = await getJson(user.accessToken, "/api/delivery/history?tab=active");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Active Order");
  });

  it("filters to the received tab", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedHistorySet(user);

    const res = await getJson(user.accessToken, "/api/delivery/history?tab=received");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Received Order");
  });

  it("filters to the cancelled tab", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedHistorySet(user);

    const res = await getJson(user.accessToken, "/api/delivery/history?tab=cancelled");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Cancelled Order");
  });

  it("carries the cancel reason on a cancelled history item", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "Cancelled With Reason", {
      cancelledAt: new Date(),
      cancelReason: "Out of stock",
      orderDate: utcDay(-3),
      ownershipStatus: "want_to_buy",
      status: "cancelled",
      storeName: "Yakaboo",
    });

    const res = await getJson(user.accessToken, "/api/delivery/history?tab=cancelled");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].delivery.cancelReason).toBe("Out of stock");
  });

  it("exposes a null cancel reason on a non-cancelled history item", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "Received Order", {
      orderDate: utcDay(-3),
      ownershipStatus: "owned",
      receivedAt: new Date(),
      status: "received",
      storeName: "Yakaboo",
    });

    const res = await getJson(user.accessToken, "/api/delivery/history?tab=received");

    expect(res.status).toBe(200);
    expect(res.body.items[0].delivery.cancelReason).toBeNull();
  });

  it("matches a search term that appears only in the cancel reason", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "Pristine Order", {
      cancelledAt: new Date(),
      cancelReason: "Damaged in shipping",
      orderDate: utcDay(-3),
      ownershipStatus: "want_to_buy",
      status: "cancelled",
      storeName: "Yakaboo",
    });
    await seedDelivery(user, "Unrelated Order", {
      orderDate: utcDay(-5),
      ownershipStatus: "owned",
      receivedAt: new Date(),
      status: "received",
      storeName: "Book Depot",
    });

    const res = await getJson(user.accessToken, "/api/delivery/history?search=damaged");

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Pristine Order");
    expect(res.body.items[0].delivery.cancelReason).toBe("Damaged in shipping");
  });

  it("does not match unrelated records when a cancel-reason search term is absent from them", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "Cancelled With Reason", {
      cancelledAt: new Date(),
      cancelReason: "Warehouse flooded",
      orderDate: utcDay(-3),
      ownershipStatus: "want_to_buy",
      status: "cancelled",
      storeName: "Yakaboo",
    });
    await seedDelivery(user, "Another Cancelled", {
      cancelledAt: new Date(),
      cancelReason: "Out of stock",
      orderDate: utcDay(-4),
      ownershipStatus: "want_to_buy",
      status: "cancelled",
      storeName: "Book Depot",
    });

    const res = await getJson(user.accessToken, "/api/delivery/history?search=flooded");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Cancelled With Reason");
  });

  it("filters by an order-date range", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedHistorySet(user);

    const res = await getJson(
      user.accessToken,
      `/api/delivery/history?from=${isoDay(-6)}&to=${isoDay(-2)}`,
    );

    expect(
      res.body.items.map((item: { book: { title: string } }) => item.book.title).sort(),
    ).toEqual(["Active Order", "Cancelled Order"]);
  });

  it("filters to orders that have a tracking number", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedHistorySet(user);

    const res = await getJson(user.accessToken, "/api/delivery/history?hasTrackingNumber=true");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Active Order");
  });

  it("filters to orders that have no tracking number when hasTrackingNumber is false", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedHistorySet(user);

    const res = await getJson(user.accessToken, "/api/delivery/history?hasTrackingNumber=false");

    expect(
      res.body.items.map((item: { book: { title: string } }) => item.book.title).sort(),
    ).toEqual(["Cancelled Order", "Received Order"]);
  });

  it("filters by currency", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedHistorySet(user);

    const res = await getJson(user.accessToken, "/api/delivery/history?currency=USD");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Received Order");
  });

  it("sorts by price descending with missing prices last", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedHistorySet(user);

    const res = await getJson(user.accessToken, "/api/delivery/history?sort=price");

    expect(res.body.items.map((item: { book: { title: string } }) => item.book.title)).toEqual([
      "Received Order",
      "Active Order",
      "Cancelled Order",
    ]);
  });

  it("attaches a ui status only to active orders", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedDelivery(user, "Active Delayed", {
      expectedDeliveryDate: utcDay(-4),
      orderDate: utcDay(-6),
      ownershipStatus: "in_transit",
      status: "in_transit",
      storeName: "Yakaboo",
    });
    await seedDelivery(user, "Received", {
      expectedDeliveryDate: utcDay(-4),
      orderDate: utcDay(-6),
      ownershipStatus: "owned",
      receivedAt: new Date(),
      status: "received",
      storeName: "Yakaboo",
    });

    const res = await getJson(user.accessToken, "/api/delivery/history?sort=title");

    const byTitle = new Map<string, Nullable<string>>(
      res.body.items.map((item: { book: { title: string }; uiStatus: Nullable<string> }) => [
        item.book.title,
        item.uiStatus,
      ]),
    );
    expect(byTitle.get("Active Delayed")).toBe("delayed");
    expect(byTitle.get("Received")).toBeNull();
  });
});

describe("GET /api/delivery/statistics", () => {
  async function seedStatisticsSet(user: AuthenticatedUser): Promise<void> {
    await seedDelivery(user, "Received UAH", {
      currency: "UAH",
      orderDate: utcDay(-40),
      ownershipStatus: "owned",
      price: 100,
      receivedAt: new Date(),
      status: "received",
      storeName: "Yakaboo",
    });
    await seedDelivery(user, "Received USD", {
      currency: "USD",
      orderDate: utcDay(-35),
      ownershipStatus: "owned",
      price: 50,
      receivedAt: new Date(),
      status: "received",
      storeName: "Book Depot",
    });
    await seedDelivery(user, "Cancelled UAH", {
      cancelledAt: new Date(),
      currency: "UAH",
      orderDate: utcDay(-20),
      ownershipStatus: "want_to_buy",
      price: 30,
      status: "cancelled",
      storeName: "Yakaboo",
    });
  }

  it("returns a payload that matches the statistics view schema", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedStatisticsSet(user);

    const res = await getJson(user.accessToken, "/api/delivery/statistics");

    expect(res.status).toBe(200);
    expect(() => DeliveryStatisticsViewSchema.parse(res.body)).not.toThrow();
  });

  it("excludes cancelled orders from the summary total by default", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedStatisticsSet(user);

    const res = await getJson(user.accessToken, "/api/delivery/statistics");

    expect(res.body.summary.totalByCurrency).toEqual([
      { currency: "UAH", total: 100 },
      { currency: "USD", total: 50 },
    ]);
    expect(res.body.summary.cancelledByCurrency).toEqual([{ currency: "UAH", total: 30 }]);
  });

  it("folds cancelled orders into the summary total when includeCancelled is true", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedStatisticsSet(user);

    const res = await getJson(user.accessToken, "/api/delivery/statistics?includeCancelled=true");

    expect(res.body.summary.totalByCurrency).toEqual([
      { currency: "UAH", total: 130 },
      { currency: "USD", total: 50 },
    ]);
    expect(res.body.summary.cancelledByCurrency).toEqual([{ currency: "UAH", total: 30 }]);
  });

  it("buckets orders into months and orders the top orders by price descending", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedStatisticsSet(user);

    const res = await getJson(user.accessToken, "/api/delivery/statistics?includeCancelled=true");

    expect(res.body.monthly.length).toBeGreaterThan(0);
    const prices = res.body.topOrders.map((order: { price: number }) => order.price);
    expect(prices).toEqual([...prices].sort((left: number, right: number) => right - left));
    expect(prices[0]).toBe(100);
  });
});

describe("POST /api/delivery/receive", () => {
  it("returns 400 when bookIds is empty", async () => {
    const user = await context.registerVerifyAndLogin();

    const res = await bulkReceive(user.accessToken, []);

    expect(res.status).toBe(400);
  });

  it("receives active deliveries and skips books that are missing or inactive", async () => {
    const user = await context.registerVerifyAndLogin();
    const activeBookId = await seedDelivery(user, "Active", {
      ownershipStatus: "in_transit",
      status: "ordered",
      storeName: "Yakaboo",
    });
    const noDeliveryBookId = await createBook(user.accessToken, "No Delivery");

    const res = await bulkReceive(user.accessToken, [activeBookId, noDeliveryBookId, MISSING_UUID]);

    expect(res.status).toBe(200);
    expect(res.body.receivedBookIds).toEqual([activeBookId]);
    expect(res.body.skipped).toEqual(
      expect.arrayContaining([
        { bookId: noDeliveryBookId, reason: "not_active" },
        { bookId: MISSING_UUID, reason: "not_found" },
      ]),
    );

    const delivery = await prisma.bookDelivery.findFirstOrThrow({
      where: { bookId: activeBookId },
    });
    expect(delivery.status).toBe("received");
    expect(delivery.receivedAt).not.toBeNull();
    const book = await prisma.book.findFirstOrThrow({ where: { id: activeBookId } });
    expect(book.ownershipStatus).toBe("owned");
  });

  it("does not apply a duplicated book id twice", async () => {
    const user = await context.registerVerifyAndLogin();
    const activeBookId = await seedDelivery(user, "Active", {
      ownershipStatus: "in_transit",
      status: "ordered",
      storeName: "Yakaboo",
    });

    const res = await bulkReceive(user.accessToken, [activeBookId, activeBookId]);

    expect(res.status).toBe(200);
    expect(res.body.receivedBookIds).toEqual([activeBookId]);
    const receivedCount = await prisma.bookDelivery.count({
      where: { bookId: activeBookId, status: "received" },
    });
    expect(receivedCount).toBe(1);
  });

  it("applies a supplied received date to every received delivery", async () => {
    const user = await context.registerVerifyAndLogin();
    const firstBookId = await seedDelivery(user, "First Active", {
      ownershipStatus: "in_transit",
      status: "ordered",
      storeName: "Yakaboo",
    });
    const secondBookId = await seedDelivery(user, "Second Active", {
      ownershipStatus: "in_transit",
      status: "in_transit",
      storeName: "Book Depot",
    });

    const res = await bulkReceive(user.accessToken, [firstBookId, secondBookId], "2026-02-10");

    expect(res.status).toBe(200);
    expect(res.body.receivedBookIds.sort()).toEqual([firstBookId, secondBookId].sort());
    const deliveries = await prisma.bookDelivery.findMany({
      where: { bookId: { in: [firstBookId, secondBookId] } },
    });
    expect(deliveries).toHaveLength(2);
    for (const delivery of deliveries) {
      expect(delivery.status).toBe("received");
      expect(delivery.receivedAt).toEqual(new Date("2026-02-10T00:00:00.000Z"));
    }
  });

  it("returns 400 when the supplied received date is in the future", async () => {
    const user = await context.registerVerifyAndLogin();
    const activeBookId = await seedDelivery(user, "Active", {
      ownershipStatus: "in_transit",
      status: "ordered",
      storeName: "Yakaboo",
    });

    const res = await bulkReceive(user.accessToken, [activeBookId], FUTURE_DATE);

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "receivedAt" })]),
    );
    const delivery = await prisma.bookDelivery.findFirstOrThrow({
      where: { bookId: activeBookId },
    });
    expect(delivery.status).toBe("ordered");
    expect(delivery.receivedAt).toBeNull();
  });

  it("keeps the partial-success shape with a supplied received date when some ids cannot be received", async () => {
    const user = await context.registerVerifyAndLogin();
    const activeBookId = await seedDelivery(user, "Active", {
      ownershipStatus: "in_transit",
      status: "ordered",
      storeName: "Yakaboo",
    });
    const noDeliveryBookId = await createBook(user.accessToken, "No Delivery");

    const res = await bulkReceive(
      user.accessToken,
      [activeBookId, noDeliveryBookId, MISSING_UUID],
      "2026-02-10",
    );

    expect(res.status).toBe(200);
    expect(res.body.receivedBookIds).toEqual([activeBookId]);
    expect(res.body.skipped).toEqual(
      expect.arrayContaining([
        { bookId: noDeliveryBookId, reason: "not_active" },
        { bookId: MISSING_UUID, reason: "not_found" },
      ]),
    );
    const delivery = await prisma.bookDelivery.findFirstOrThrow({
      where: { bookId: activeBookId },
    });
    expect(delivery.receivedAt).toEqual(new Date("2026-02-10T00:00:00.000Z"));
  });
});

describe("delivery multi-tenant isolation", () => {
  async function seedStranger(): Promise<{ bookId: string; stranger: AuthenticatedUser }> {
    const stranger = await context.registerVerifyAndLogin();
    const bookId = await seedDelivery(stranger, "Stranger Order", {
      currency: "UAH",
      orderDate: utcDay(-5),
      ownershipStatus: "in_transit",
      price: 500,
      status: "ordered",
      storeName: "Stranger Store",
    });
    return { bookId, stranger };
  }

  it("hides another user's deliveries from the in-transit list", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedStranger();

    const res = await getJson(user.accessToken, "/api/delivery/in-transit");

    expect(res.body.items).toEqual([]);
    expect(res.body.totalCount).toBe(0);
  });

  it("hides another user's deliveries from history", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedStranger();

    const res = await getJson(user.accessToken, "/api/delivery/history");

    expect(res.body.items).toEqual([]);
  });

  it("hides another user's deliveries from statistics", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedStranger();

    const res = await getJson(user.accessToken, "/api/delivery/statistics");

    expect(res.body.summary.totalByCurrency).toEqual([]);
    expect(res.body.topOrders).toEqual([]);
  });

  it("cannot bulk-receive another user's book and leaves it unchanged", async () => {
    const user = await context.registerVerifyAndLogin();
    const { bookId } = await seedStranger();

    const res = await bulkReceive(user.accessToken, [bookId]);

    expect(res.status).toBe(200);
    expect(res.body.receivedBookIds).toEqual([]);
    expect(res.body.skipped).toEqual([{ bookId, reason: "not_found" }]);

    const delivery = await prisma.bookDelivery.findFirstOrThrow({ where: { bookId } });
    expect(delivery.status).toBe("ordered");
    expect(delivery.receivedAt).toBeNull();
    const book = await prisma.book.findFirstOrThrow({ where: { id: bookId } });
    expect(book.ownershipStatus).toBe("in_transit");
  });
});
