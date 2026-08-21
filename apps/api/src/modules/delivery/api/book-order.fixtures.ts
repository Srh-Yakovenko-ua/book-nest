import type { BookOrderView, CreateBookOrderInput } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { addDays, format, startOfMonth, subMonths } from "date-fns";
import request from "supertest";

type AuthedApp = {
  accessToken: string;
  app: INestApplication;
};

const ISO_DATE_FORMAT = "yyyy-MM-dd";
const MONTH_FORMAT = "yyyy-MM";
const OK_STATUS = 200;

export const ORDER_ROUTES = {
  budgets: "/api/delivery/budgets",
  budgetScheduled: (currency: string): string => `/api/delivery/budgets/${currency}/scheduled`,
  cancelItem: (itemId: string): string => `/api/delivery/items/${itemId}/cancel`,
  cancelShipment: (shipmentId: string): string => `/api/delivery/shipments/${shipmentId}/cancel`,
  createShipment: (orderId: string): string => `/api/delivery/orders/${orderId}/shipments`,
  history: "/api/delivery/books/history",
  historySummary: "/api/delivery/books/history/summary",
  inTransit: "/api/delivery/books/in-transit",
  inTransitSummary: "/api/delivery/books/in-transit/summary",
  markInTransit: (shipmentId: string): string => `/api/delivery/shipments/${shipmentId}/in-transit`,
  markReadyForPickup: (shipmentId: string): string =>
    `/api/delivery/shipments/${shipmentId}/ready-for-pickup`,
  moveItems: (orderId: string): string => `/api/delivery/orders/${orderId}/items/move`,
  order: (orderId: string): string => `/api/delivery/orders/${orderId}`,
  orders: "/api/delivery/orders",
  receiveBooks: "/api/delivery/books/receive",
  receiveShipment: (shipmentId: string): string => `/api/delivery/shipments/${shipmentId}/receive`,
  statistics: "/api/delivery/orders/statistics",
  statisticsActiveAge: "/api/delivery/orders/statistics/active-age",
  updateShipment: (shipmentId: string): string => `/api/delivery/shipments/${shipmentId}`,
} as const;

export const STATISTICS_FIXTURE_MONTH = {
  current: "2026-03",
  lastYear: "2025-03",
  previous: "2026-02",
} as const;

export const STATISTICS_FIXTURE_STORE = {
  amazon: "Amazon DE",
  depository: "Book Depository",
  depot: "Book Depot",
  gift: "Gift Shop",
  yakaboo: "Yakaboo",
} as const;

export type StatisticsFixture = {
  cancelled: BookOrderView;
  dollar: BookOrderView;
  euro: BookOrderView;
  free: BookOrderView;
  lastYear: BookOrderView;
  manualMismatch: BookOrderView;
  multiShipment: BookOrderView;
  partiallyCancelled: BookOrderView;
  previousMonth: BookOrderView;
  unknownPrice: BookOrderView;
};

export async function cancelBooksOfOrder({
  accessToken,
  app,
  bookIds,
  view,
}: AuthedApp & { bookIds: string[]; view: BookOrderView }): Promise<BookOrderView> {
  let latest = view;
  for (const bookId of bookIds) {
    const res = await postJson({
      accessToken,
      app,
      path: ORDER_ROUTES.cancelItem(itemOf({ bookId, view }).id),
    });
    if (res.status !== OK_STATUS) {
      throw new Error(
        `cancelling ${bookId} failed with ${res.status}: ${JSON.stringify(res.body)}`,
      );
    }
    latest = res.body;
  }
  return latest;
}

export async function createBook({
  accessToken,
  app,
  author = "Frank Herbert",
  title,
}: AuthedApp & { author?: string; title: string }): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ authors: [{ name: author }], title });
  if (typeof res.body.id !== "string") {
    throw new Error(`book creation failed with status ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.id;
}

export async function createBooks({
  accessToken,
  app,
  titles,
}: AuthedApp & { titles: string[] }): Promise<string[]> {
  const bookIds: string[] = [];
  for (const title of titles) {
    bookIds.push(await createBook({ accessToken, app, title }));
  }
  return bookIds;
}

export async function createOrder({
  accessToken,
  app,
  input,
}: AuthedApp & { input: CreateBookOrderInput }): Promise<BookOrderView> {
  const res = await postJson({ accessToken, app, body: input, path: ORDER_ROUTES.orders });
  if (typeof res.body.id !== "string") {
    throw new Error(`order creation failed with status ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export function deleteJson({ accessToken, app, path }: AuthedApp & { path: string }): request.Test {
  return request(app.getHttpServer()).delete(path).set("Authorization", `Bearer ${accessToken}`);
}

export function getJson({ accessToken, app, path }: AuthedApp & { path: string }): request.Test {
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

export function isoDay(offset: number): string {
  return format(addDays(new Date(), offset), ISO_DATE_FORMAT);
}

export function isoDayOfPreviousMonth(dayOffset: number): string {
  return format(addDays(subMonths(startOfMonth(new Date()), 1), dayOffset), ISO_DATE_FORMAT);
}

export function itemOf({
  bookId,
  view,
}: {
  bookId: string;
  view: BookOrderView;
}): BookOrderView["items"][number] {
  const item = view.items.find((candidate) => candidate.bookId === bookId);
  if (item === undefined) {
    throw new Error(`book ${bookId} has no item in order ${view.id}`);
  }
  return item;
}

export async function ownershipOf({
  accessToken,
  app,
  bookId,
}: AuthedApp & { bookId: string }): Promise<string> {
  const res = await getJson({ accessToken, app, path: `/api/books/${bookId}` });
  if (typeof res.body.ownershipStatus !== "string") {
    throw new Error(`book ${bookId} read failed with status ${res.status}`);
  }
  return res.body.ownershipStatus;
}

export function patchJson({
  accessToken,
  app,
  body,
  path,
}: AuthedApp & { body: object; path: string }): request.Test {
  return request(app.getHttpServer())
    .patch(path)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

export function postJson({
  accessToken,
  app,
  body,
  path,
}: AuthedApp & { body?: object; path: string }): request.Test {
  const test = request(app.getHttpServer())
    .post(path)
    .set("Authorization", `Bearer ${accessToken}`);
  return body === undefined ? test : test.send(body);
}

export function previousMonthKey(): string {
  return format(subMonths(startOfMonth(new Date()), 1), MONTH_FORMAT);
}

export async function seedStatisticsFixture({
  accessToken,
  app,
}: AuthedApp): Promise<StatisticsFixture> {
  const authed = { accessToken, app };
  const day = (dayOfMonth: string): string => `${STATISTICS_FIXTURE_MONTH.current}-${dayOfMonth}`;

  const multiShipmentBooks = await createBooks({
    ...authed,
    titles: ["Stat Multi A", "Stat Multi B", "Stat Multi C"],
  });
  const multiShipment = await createOrder({
    ...authed,
    input: {
      currency: "UAH",
      deliveryPrice: 100,
      discount: 80,
      items: [
        { bookId: multiShipmentBooks[0] ?? "", price: 300 },
        { bookId: multiShipmentBooks[1] ?? "", price: 500 },
        { bookId: multiShipmentBooks[2] ?? "", price: 200 },
      ],
      orderDate: day("04"),
      shipments: [
        { bookIds: multiShipmentBooks.slice(0, 2), trackingNumber: "NP-STAT-A" },
        { bookIds: multiShipmentBooks.slice(2), trackingNumber: "NP-STAT-B" },
      ],
      storeName: STATISTICS_FIXTURE_STORE.yakaboo,
    },
  });

  const partialBooks = await createBooks({
    ...authed,
    titles: ["Stat Kept", "Stat Dropped"],
  });
  const partiallyCancelled = await cancelBooksOfOrder({
    ...authed,
    bookIds: [partialBooks[1] ?? ""],
    view: await createOrder({
      ...authed,
      input: {
        currency: "UAH",
        items: [
          { bookId: partialBooks[0] ?? "", price: 400 },
          { bookId: partialBooks[1] ?? "", price: 600 },
        ],
        orderDate: day("05"),
        storeName: STATISTICS_FIXTURE_STORE.yakaboo,
      },
    }),
  });

  const mismatchBooks = await createBooks({
    ...authed,
    titles: ["Stat Mismatch A", "Stat Mismatch B"],
  });
  const manualMismatch = await createOrder({
    ...authed,
    input: {
      currency: "UAH",
      items: mismatchBooks.map((bookId) => ({ bookId, price: 300 })),
      orderDate: day("06"),
      storeName: STATISTICS_FIXTURE_STORE.depot,
      totalAmount: 999,
    },
  });

  const unpricedBookId = await createBook({ ...authed, title: "Stat Unpriced" });
  const unknownPrice = await createOrder({
    ...authed,
    input: {
      currency: "UAH",
      items: [{ bookId: unpricedBookId }],
      orderDate: day("07"),
      storeName: STATISTICS_FIXTURE_STORE.depot,
    },
  });

  const giftBooks = await createBooks({ ...authed, titles: ["Stat Gift A", "Stat Gift B"] });
  const free = await createOrder({
    ...authed,
    input: {
      currency: "UAH",
      items: giftBooks.map((bookId) => ({ bookId, price: 0 })),
      orderDate: day("08"),
      storeName: STATISTICS_FIXTURE_STORE.gift,
      totalAmount: 0,
    },
  });

  const euroBooks = await createBooks({ ...authed, titles: ["Stat Euro A", "Stat Euro B"] });
  const euro = await createOrder({
    ...authed,
    input: {
      currency: "EUR",
      deliveryPrice: 5,
      items: [
        { bookId: euroBooks[0] ?? "", price: 15 },
        { bookId: euroBooks[1] ?? "", price: 25 },
      ],
      orderDate: day("09"),
      storeName: STATISTICS_FIXTURE_STORE.amazon,
    },
  });

  const dollarBookId = await createBook({ ...authed, title: "Stat Dollar" });
  const dollar = await createOrder({
    ...authed,
    input: {
      currency: "USD",
      discount: 4,
      items: [{ bookId: dollarBookId, price: 40 }],
      orderDate: day("10"),
      storeName: STATISTICS_FIXTURE_STORE.depository,
    },
  });

  const voidBooks = await createBooks({ ...authed, titles: ["Stat Void A", "Stat Void B"] });
  const cancelled = await cancelBooksOfOrder({
    ...authed,
    bookIds: voidBooks,
    view: await createOrder({
      ...authed,
      input: {
        currency: "UAH",
        items: voidBooks.map((bookId) => ({ bookId, price: 150 })),
        orderDate: day("12"),
        storeName: STATISTICS_FIXTURE_STORE.yakaboo,
      },
    }),
  });

  const previousMonthBookId = await createBook({ ...authed, title: "Stat Old Active" });
  const previousMonth = await createOrder({
    ...authed,
    input: {
      currency: "UAH",
      items: [{ bookId: previousMonthBookId, price: 250 }],
      orderDate: `${STATISTICS_FIXTURE_MONTH.previous}-10`,
      shipments: [{ bookIds: [previousMonthBookId], trackingNumber: "NP-STAT-OLD" }],
      storeName: STATISTICS_FIXTURE_STORE.yakaboo,
    },
  });

  const lastYearBookId = await createBook({ ...authed, title: "Stat Last Year" });
  const lastYear = await createOrder({
    ...authed,
    input: {
      currency: "UAH",
      items: [{ bookId: lastYearBookId, price: 700 }],
      orderDate: `${STATISTICS_FIXTURE_MONTH.lastYear}-11`,
      storeName: STATISTICS_FIXTURE_STORE.yakaboo,
    },
  });

  return {
    cancelled,
    dollar,
    euro,
    free,
    lastYear,
    manualMismatch,
    multiShipment,
    partiallyCancelled,
    previousMonth,
    unknownPrice,
  };
}

export function shipmentOf({
  bookId,
  view,
}: {
  bookId: string;
  view: BookOrderView;
}): BookOrderView["shipments"][number] {
  const item = itemOf({ bookId, view });
  const shipment = view.shipments.find((candidate) => candidate.id === item.shipmentId);
  if (shipment === undefined) {
    throw new Error(`book ${bookId} is not loaded into any shipment of order ${view.id}`);
  }
  return shipment;
}
