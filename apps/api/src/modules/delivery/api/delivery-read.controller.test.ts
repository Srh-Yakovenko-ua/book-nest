import type {
  BookOrderItemRowView,
  BookOrderStatisticsView,
  BookOrderView,
  InTransitSummaryView,
} from "@app/shared";
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
  createBook,
  createBooks,
  createOrder,
  getJson,
  isoDay,
  isoDayOfPreviousMonth,
  ORDER_ROUTES,
  postJson,
  previousMonthKey,
  shipmentOf,
} from "./book-order.fixtures.js";

const LIST_BOOKS = {
  noDate: "No Date",
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
} as const;

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

async function inTransitSummary(): Promise<InTransitSummaryView> {
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.inTransitSummary,
  });
  return res.body;
}

async function inTransitTitles({
  filter,
  sort,
}: {
  filter?: string;
  sort?: string;
}): Promise<string[]> {
  const query = new URLSearchParams({
    ...(filter === undefined ? {} : { filter }),
    ...(sort === undefined ? {} : { sort }),
  });
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: `${ORDER_ROUTES.inTransit}?${query.toString()}`,
  });
  if (res.status !== 200) {
    throw new Error(`in-transit read failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.items.map((row: BookOrderItemRowView) => row.book.title);
}

async function seedListFixture(): Promise<BookOrderView> {
  const bookIds = await createBooks({
    accessToken: reader.accessToken,
    app,
    titles: [LIST_BOOKS.overdue, LIST_BOOKS.today, LIST_BOOKS.upcoming, LIST_BOOKS.noDate],
  });
  const [overdue, today, upcoming, noDate] = bookIds;

  return createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      items: [
        { bookId: overdue ?? "", price: 100 },
        { bookId: today ?? "", price: 200 },
        { bookId: upcoming ?? "", price: 300 },
        { bookId: noDate ?? "" },
      ],
      orderDate: isoDay(-30),
      shipments: [
        {
          bookIds: [overdue ?? ""],
          expectedDeliveryDate: isoDay(-10),
          trackingNumber: "NP-OVERDUE",
        },
        { bookIds: [today ?? ""], expectedDeliveryDate: isoDay(0), trackingNumber: "NP-TODAY" },
        {
          bookIds: [upcoming ?? ""],
          expectedDeliveryDate: isoDay(5),
          trackingNumber: "NP-UPCOMING",
        },
        { bookIds: [noDate ?? ""] },
      ],
      storeName: "Yakaboo",
    },
  });
}

async function statistics(): Promise<BookOrderStatisticsView> {
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.statistics,
  });
  if (res.status !== 200) {
    throw new Error(`statistics read failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

describe("GET /api/delivery/books/in-transit filters", () => {
  it("returns only the parcel waiting at the pickup point", async () => {
    const order = await seedListFixture();
    const bookId = order.items.find((item) => item.price === 200)?.bookId ?? "";
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.markReadyForPickup(shipmentOf({ bookId, view: order }).id),
    });

    await expect(inTransitTitles({ filter: "ready_for_pickup" })).resolves.toEqual([
      LIST_BOOKS.today,
    ]);
  });

  it("returns only the book whose date has already passed", async () => {
    await seedListFixture();

    await expect(inTransitTitles({ filter: "delayed" })).resolves.toEqual([LIST_BOOKS.overdue]);
  });

  it("returns only the book with no expected date", async () => {
    await seedListFixture();

    await expect(inTransitTitles({ filter: "no_delivery_date" })).resolves.toEqual([
      LIST_BOOKS.noDate,
    ]);
  });

  it("returns only the book with no tracking number", async () => {
    await seedListFixture();

    await expect(inTransitTitles({ filter: "without_tracking_number" })).resolves.toEqual([
      LIST_BOOKS.noDate,
    ]);
  });

  it("returns only the book with no price", async () => {
    await seedListFixture();

    await expect(inTransitTitles({ filter: "without_price" })).resolves.toEqual([
      LIST_BOOKS.noDate,
    ]);
  });

  it("drops a book out of the list once its parcel arrives", async () => {
    const order = await seedListFixture();
    const bookId = order.items.find((item) => item.price === 100)?.bookId ?? "";
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(shipmentOf({ bookId, view: order }).id),
    });

    await expect(inTransitTitles({ filter: "delayed" })).resolves.toEqual([]);
  });
});

describe("GET /api/delivery/books/in-transit sorting", () => {
  it("puts the soonest arrival first and the late one last", async () => {
    await seedListFixture();

    await expect(inTransitTitles({ sort: "closest_delivery" })).resolves.toEqual([
      LIST_BOOKS.today,
      LIST_BOOKS.upcoming,
      LIST_BOOKS.overdue,
      LIST_BOOKS.noDate,
    ]);
  });

  it("puts the late one first on the very same books", async () => {
    await seedListFixture();

    await expect(inTransitTitles({ sort: "delayed_first" })).resolves.toEqual([
      LIST_BOOKS.overdue,
      LIST_BOOKS.today,
      LIST_BOOKS.upcoming,
      LIST_BOOKS.noDate,
    ]);
  });
});

describe("GET /api/delivery/books/in-transit/summary", () => {
  it("counts a book that needs attention on several grounds only once", async () => {
    await seedListFixture();

    const summary = await inTransitSummary();

    expect(summary).toMatchObject({
      activeBooksCount: 4,
      activeOrdersCount: 1,
      activeShipmentsCount: 4,
      attentionCount: 2,
      delayedCount: 1,
      withoutExpectedDateCount: 1,
      withoutPriceCount: 1,
      withoutTrackingCount: 1,
    });
  });

  it("reports the pickup and transit counts of the parcels behind the books", async () => {
    const order = await seedListFixture();
    const readyBookId = order.items.find((item) => item.price === 200)?.bookId ?? "";
    const transitBookId = order.items.find((item) => item.price === 300)?.bookId ?? "";
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.markReadyForPickup(shipmentOf({ bookId: readyBookId, view: order }).id),
    });
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.markInTransit(shipmentOf({ bookId: transitBookId, view: order }).id),
    });

    const summary = await inTransitSummary();

    expect(summary).toMatchObject({
      inTransitCount: 1,
      orderedCount: 2,
      readyForPickupCount: 1,
      uniqueStoresCount: 1,
    });
  });
});

describe("GET /api/delivery/orders/statistics", () => {
  it("counts three books of one parcel as one order and one shipment", async () => {
    const bookIds = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: ["One", "Two", "Three"],
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        items: bookIds.map((bookId) => ({ bookId, price: 100 })),
        orderDate: isoDay(-3),
        shipments: [{ bookIds, expectedDeliveryDate: isoDay(4) }],
        storeName: "Yakaboo",
        totalAmount: 300,
      },
    });

    const { summary } = await statistics();

    expect(summary).toMatchObject({
      activeBooksCount: 3,
      activeShipmentsCount: 1,
      booksCount: 3,
      ordersCount: 1,
      shipmentsCount: 1,
    });
  });

  it("averages the order amount and the book price inside each store", async () => {
    const yakabooBooks = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: ["Y One", "Y Two", "Y Three"],
    });
    const depotBookId = await createBook({
      accessToken: reader.accessToken,
      app,
      title: "D One",
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        deliveryPrice: 60,
        items: yakabooBooks.map((bookId) => ({ bookId, price: 100 })),
        orderDate: isoDay(-6),
        storeName: "Yakaboo",
        totalAmount: 360,
      },
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        deliveryPrice: 40,
        items: [{ bookId: depotBookId, price: 500 }],
        orderDate: isoDay(-5),
        storeName: "Book Depot",
        totalAmount: 540,
      },
    });

    const { byStore } = await statistics();

    expect(byStore).toEqual([
      {
        averageBookPriceByCurrency: [{ average: 500, currency: "UAH" }],
        averageOrderAmountByCurrency: [{ average: 540, currency: "UAH" }],
        booksCount: 1,
        ordersCount: 1,
        store: "Book Depot",
        totalsByCurrency: [{ currency: "UAH", total: 540 }],
      },
      {
        averageBookPriceByCurrency: [{ average: 100, currency: "UAH" }],
        averageOrderAmountByCurrency: [{ average: 360, currency: "UAH" }],
        booksCount: 3,
        ordersCount: 1,
        store: "Yakaboo",
        totalsByCurrency: [{ currency: "UAH", total: 360 }],
      },
    ]);
  });

  it("counts two orders of one month as two orders carrying five books", async () => {
    const firstOrderBooks = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: ["M One", "M Two", "M Three"],
    });
    const secondOrderBooks = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: ["M Four", "M Five"],
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        items: firstOrderBooks.map((bookId) => ({ bookId, price: 100 })),
        orderDate: isoDayOfPreviousMonth(0),
        storeName: "Yakaboo",
        totalAmount: 300,
      },
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        items: secondOrderBooks.map((bookId) => ({ bookId, price: 100 })),
        orderDate: isoDayOfPreviousMonth(1),
        storeName: "Yakaboo",
        totalAmount: 200,
      },
    });

    const { monthly } = await statistics();

    expect(monthly).toEqual([
      {
        booksCount: 5,
        month: previousMonthKey(),
        ordersCount: 2,
        totalsByCurrency: [{ currency: "UAH", total: 500 }],
      },
    ]);
  });

  it("keeps another reader's orders out of the numbers", async () => {
    const stranger = await context.registerVerifyAndLogin();
    const strangerBookId = await createBook({
      accessToken: stranger.accessToken,
      app,
      title: "Theirs",
    });
    await createOrder({
      accessToken: stranger.accessToken,
      app,
      input: {
        currency: "UAH",
        items: [{ bookId: strangerBookId, price: 900 }],
        orderDate: isoDay(-2),
        storeName: "Yakaboo",
        totalAmount: 900,
      },
    });

    const { summary } = await statistics();

    expect(summary).toMatchObject({ booksCount: 0, ordersCount: 0, shipmentsCount: 0 });
  });
});
