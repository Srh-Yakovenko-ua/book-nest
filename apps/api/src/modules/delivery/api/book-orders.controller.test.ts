import type { BookOrderStatisticsView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import {
  ActiveMoneyAgeResponseSchema,
  BookOrderStatisticsViewSchema,
  BookOrderViewSchema,
} from "@app/shared";
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
  postJson,
  seedStatisticsFixture,
  shipmentOf,
  STATISTICS_FIXTURE_MONTH,
  STATISTICS_FIXTURE_STORE,
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
      derivedStatus: "shipped",
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

  it("stores a manual total that does not match the sum of the book prices", async () => {
    const bookIds = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: ["Dune", "Emma"],
    });

    const res = await postJson({
      accessToken: reader.accessToken,
      app,
      body: {
        currency: "UAH",
        deliveryPrice: 100,
        discount: 80,
        items: bookIds.map((bookId) => ({ bookId, price: 300 })),
        orderDate: isoDay(-2),
        storeName: "Yakaboo",
        totalAmount: 999,
      },
      path: ORDER_ROUTES.orders,
    });

    expect(res.status).toBe(201);
    const created = BookOrderViewSchema.parse(res.body);

    const stored = await getJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.order(created.id),
    });
    const view = BookOrderViewSchema.parse(stored.body);

    expect({
      deliveryPrice: view.deliveryPrice,
      discount: view.discount,
      itemPricesTotal: view.items.reduce((total, item) => total + (item.price ?? 0), 0),
      totalAmount: view.totalAmount,
    }).toEqual({ deliveryPrice: 100, discount: 80, itemPricesTotal: 600, totalAmount: 999 });
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
        shipments: [{ bookIds: [bookIds[0] ?? ""] }],
        storeName: "Yakaboo",
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

type StatisticsTestQuery = {
  compare?: string;
  currency?: string;
  from?: string;
  includeCancelled?: string;
  status?: string;
  store?: string;
  to?: string;
};

const MONTH_END = { "2025-03": "2025-03-31", "2026-02": "2026-02-28", "2026-03": "2026-03-31" };

function monthWindow(month: keyof typeof MONTH_END): { from: string; to: string } {
  return { from: `${month}-01`, to: MONTH_END[month] };
}

async function statisticsOf(query: StatisticsTestQuery = {}): Promise<BookOrderStatisticsView> {
  const params = new URLSearchParams(
    Object.entries(query).flatMap<[string, string]>(([key, value]) =>
      value === undefined ? [] : [[key, value]],
    ),
  );
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: `${ORDER_ROUTES.statistics}?${params.toString()}`,
  });
  if (res.status !== 200) {
    throw new Error(`statistics read failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return BookOrderStatisticsViewSchema.parse(res.body);
}

function totalsOf(view: BookOrderStatisticsView): Record<string, number> {
  return Object.fromEntries(view.summary.totalsByCurrency.map((row) => [row.currency, row.total]));
}

describe("GET /api/delivery/orders/statistics over a realistic catalogue", () => {
  it("keeps three currencies apart instead of converting them into one number", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf();

    expect(totalsOf(view)).toEqual({ EUR: 45, UAH: 3369, USD: 36 });
  });

  it("counts an order once no matter how many parcels carry it", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf();

    expect({ books: view.summary.booksCount, orders: view.summary.ordersCount }).toEqual({
      books: 14,
      orders: 9,
    });
  });

  it("drops a cancelled book out of its order's total without dropping the order", async () => {
    const fixture = await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf();

    const partial = view.topOrders.find((order) => order.id === fixture.partiallyCancelled.id);
    expect({ booksCount: partial?.booksCount, totalAmount: partial?.totalAmount }).toEqual({
      booksCount: 1,
      totalAmount: 400,
    });
  });

  it("trusts a manual total over the sum of the books it disagrees with", async () => {
    const fixture = await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf();

    expect(
      view.topOrders.find((order) => order.id === fixture.manualMismatch.id)?.totalAmount,
    ).toBe(999);
  });

  it("leaves an order whose price nobody entered out of the money, but not out of the count", async () => {
    const fixture = await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf();

    expect(view.topOrders.map((order) => order.id)).not.toContain(fixture.unknownPrice.id);
    expect(view.summary.ordersCount).toBe(9);
  });

  it("reads a currency filter as a filter on orders, not as a conversion", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf({ currency: "EUR" });

    expect(totalsOf(view)).toEqual({ EUR: 45 });
    expect(view.summary.ordersCount).toBe(1);
  });

  it("answers a store filter with that store alone", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf({ store: STATISTICS_FIXTURE_STORE.depot });

    expect(view.byStore.map((store) => store.store)).toEqual([STATISTICS_FIXTURE_STORE.depot]);
    expect(totalsOf(view)).toEqual({ UAH: 999 });
  });

  it("holds a cancelled order out of the totals until it is asked for", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const excluded = await statisticsOf();
    const included = await statisticsOf({ includeCancelled: "true" });

    expect(totalsOf(excluded).UAH).toBe(3369);
    expect(totalsOf(included).UAH).toBe(4269);
    expect({
      excluded: excluded.lifecycle.orders.cancelled,
      included: included.lifecycle.orders.cancelled,
    }).toEqual({ excluded: 0, included: 1 });
  });

  it("bills delivery and discount into the month they belong to", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf(monthWindow(STATISTICS_FIXTURE_MONTH.current));

    expect(view.costs).toEqual([
      {
        currency: "UAH",
        deliveryCostPerBook: expect.closeTo(11.11, 2),
        deliveryShareOfSpendPercent: expect.closeTo(4.13, 2),
        deliveryTotal: 100,
        discountShareOfRawSubtotalPercent: 4,
        discountTotal: 80,
        ordersWithDeliveryCount: 1,
        ordersWithDiscountCount: 1,
      },
      {
        currency: "EUR",
        deliveryCostPerBook: 2.5,
        deliveryShareOfSpendPercent: expect.closeTo(11.11, 2),
        deliveryTotal: 5,
        discountShareOfRawSubtotalPercent: 0,
        discountTotal: 0,
        ordersWithDeliveryCount: 1,
        ordersWithDiscountCount: 0,
      },
      {
        currency: "USD",
        deliveryCostPerBook: 0,
        deliveryShareOfSpendPercent: 0,
        deliveryTotal: 0,
        discountShareOfRawSubtotalPercent: 10,
        discountTotal: 4,
        ordersWithDeliveryCount: 0,
        ordersWithDiscountCount: 1,
      },
    ]);
  });
});

describe("GET /api/delivery/orders/statistics comparison", () => {
  it("compares a whole calendar month against the month before it", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf({
      compare: "previous_period",
      ...monthWindow(STATISTICS_FIXTURE_MONTH.current),
    });

    expect(view.meta.comparisonPeriod).toEqual({
      from: `${STATISTICS_FIXTURE_MONTH.previous}-01`,
      mode: "previous_period",
      to: MONTH_END[STATISTICS_FIXTURE_MONTH.previous],
    });
    expect(
      view.comparison?.totalsByCurrency.find((delta) => delta.currency === "UAH"),
    ).toMatchObject({ current: 2419, previous: 250 });
  });

  it("compares a month against the same month a year earlier", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf({
      compare: "same_period_last_year",
      ...monthWindow(STATISTICS_FIXTURE_MONTH.current),
    });

    expect(view.meta.comparisonPeriod).toEqual({
      from: `${STATISTICS_FIXTURE_MONTH.lastYear}-01`,
      mode: "same_period_last_year",
      to: MONTH_END[STATISTICS_FIXTURE_MONTH.lastYear],
    });
    expect(
      view.comparison?.totalsByCurrency.find((delta) => delta.currency === "UAH"),
    ).toMatchObject({ current: 2419, previous: 700 });
  });

  it("says nothing about a comparison nobody can compute from an open-ended period", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf({ compare: "previous_period" });

    expect({ comparison: view.comparison, period: view.meta.comparisonPeriod }).toEqual({
      comparison: null,
      period: null,
    });
  });

  it("carries the previous period's own stage counts alongside the current ones", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf({
      compare: "previous_period",
      ...monthWindow(STATISTICS_FIXTURE_MONTH.current),
    });

    expect(view.lifecycle.comparison?.orders.previous.total).toBe(1);
    expect(view.lifecycle.comparison?.orders.delta.total).toBe(view.lifecycle.orders.total - 1);
  });

  it("leaves the lifecycle comparison out while compare is off", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf(monthWindow(STATISTICS_FIXTURE_MONTH.current));

    expect(view.lifecycle.comparison).toBeNull();
  });
});

describe("GET /api/delivery/orders/statistics contract", () => {
  it("answers an empty library with empty arrays and null scalars, never with placeholder rows", async () => {
    const view = await statisticsOf();

    expect({
      bestValueStoreByCurrency: view.bestValueStoreByCurrency,
      byStore: view.byStore,
      comparison: view.comparison,
      costs: view.costs,
      daily: view.daily,
      landedCost: view.landedCost,
      monthly: view.monthly,
      pulse: view.pulse,
      topOrders: view.topOrders,
      topOrdersByCurrency: view.topOrdersByCurrency,
    }).toEqual({
      bestValueStoreByCurrency: [],
      byStore: [],
      comparison: null,
      costs: [],
      daily: [],
      landedCost: [],
      monthly: [],
      pulse: [],
      topOrders: [],
      topOrdersByCurrency: [],
    });
    expect(view.summary.averageBooksPerOrder).toBeNull();
    expect(view.records.mostBooksInOrder).toBeNull();
  });

  it("reports an untruncated read with the cap it was measured against", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const view = await statisticsOf();

    expect(view.meta).toMatchObject({ isTruncated: false, loadedOrdersCount: 10 });
    expect(view.meta.maxOrders).toBeGreaterThan(view.meta.loadedOrdersCount);
  });

  it("marks the record scope as filtered so nothing gets called an all-time record", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const filtered = await statisticsOf(monthWindow(STATISTICS_FIXTURE_MONTH.current));
    const unfiltered = await statisticsOf();

    expect(filtered.records.scope).toEqual({
      isPeriodFiltered: true,
      isTruncated: false,
      period: {
        from: `${STATISTICS_FIXTURE_MONTH.current}-01`,
        to: MONTH_END[STATISTICS_FIXTURE_MONTH.current],
      },
    });
    expect(unfiltered.records.scope.isPeriodFiltered).toBe(false);
  });

  it("keeps every reader's statistics to their own orders", async () => {
    const stranger = await context.registerVerifyAndLogin();
    await seedStatisticsFixture({ accessToken: stranger.accessToken, app });

    const view = await statisticsOf();

    expect(view.summary).toMatchObject({ booksCount: 0, ordersCount: 0 });
    expect(view.byStore).toEqual([]);
  });
});

describe("GET /api/delivery/orders/statistics/active-age", () => {
  it("measures the age of active money and ignores the historical period filter", async () => {
    await seedStatisticsFixture({ accessToken: reader.accessToken, app });

    const res = await getJson({
      accessToken: reader.accessToken,
      app,
      path: `${ORDER_ROUTES.statisticsActiveAge}`,
    });
    const filtered = await getJson({
      accessToken: reader.accessToken,
      app,
      path: `${ORDER_ROUTES.statisticsActiveAge}?from=2026-03-01&to=2026-03-31`,
    });

    expect(res.status).toBe(200);
    expect(ActiveMoneyAgeResponseSchema.parse(filtered.body).buckets).toEqual(
      ActiveMoneyAgeResponseSchema.parse(res.body).buckets,
    );
  });
});
