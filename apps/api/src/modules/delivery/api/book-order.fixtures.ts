import type { BookOrderView, CreateBookOrderInput } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { addDays, endOfWeek, format, startOfMonth, subMonths } from "date-fns";
import request from "supertest";

type AuthedApp = {
  accessToken: string;
  app: INestApplication;
};

const ISO_DATE_FORMAT = "yyyy-MM-dd";
const MONDAY = 1;
const MONTH_FORMAT = "yyyy-MM";

export const ORDER_ROUTES = {
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
  updateShipment: (shipmentId: string): string => `/api/delivery/shipments/${shipmentId}`,
} as const;

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

export function getJson({ accessToken, app, path }: AuthedApp & { path: string }): request.Test {
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

export function isoDay(offset: number): string {
  return format(addDays(new Date(), offset), ISO_DATE_FORMAT);
}

export function isoDayOfPreviousMonth(dayOffset: number): string {
  return format(addDays(subMonths(startOfMonth(new Date()), 1), dayOffset), ISO_DATE_FORMAT);
}

export function isoSundayOfThisWeek(): string {
  return format(endOfWeek(new Date(), { weekStartsOn: MONDAY }), ISO_DATE_FORMAT);
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
