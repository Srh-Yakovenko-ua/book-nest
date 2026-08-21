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
  isoDay,
  itemOf,
  ORDER_ROUTES,
  postJson,
  shipmentOf,
} from "../api/book-order.fixtures.js";
import { DeliveryModule } from "../delivery.module.js";
import { ShipmentsRepository } from "./shipments.repository.js";

type TwoBookParcel = {
  bookIds: string[];
  order: BookOrderView;
  shipmentId: string;
};

const RECEIVED_AT = new Date("2026-08-10T12:00:00.000Z");

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let repository: ShipmentsRepository;
let reader: AuthenticatedUser;
let parcel: TwoBookParcel;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, DeliveryModule]);
  app = context.app;
  prisma = app.get(PrismaService);
  repository = app.get(ShipmentsRepository);
});

beforeEach(async () => {
  context.reset();
  reader = await context.registerVerifyAndLogin();
  parcel = await seedTwoBookParcel();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function cancelItem(bookId: string): Promise<unknown> {
  return postJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.cancelItem(itemOf({ bookId, view: parcel.order }).id),
  });
}

function closeSettledParcel(): Promise<number> {
  return repository.receiveWithoutPendingItems({
    receivedAt: RECEIVED_AT,
    shipmentIds: [parcel.shipmentId],
    userId: reader.userId,
  });
}

function receiveBooks(bookIds: string[]): Promise<unknown> {
  return postJson({
    accessToken: reader.accessToken,
    app,
    body: { bookIds },
    path: ORDER_ROUTES.receiveBooks,
  });
}

async function seedTwoBookParcel(): Promise<TwoBookParcel> {
  const bookIds = await createBooks({
    accessToken: reader.accessToken,
    app,
    titles: ["Parcel One", "Parcel Two"],
  });
  const order = await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      items: bookIds.map((bookId) => ({ bookId, price: 150 })),
      orderDate: isoDay(-5),
      shipments: [{ bookIds, expectedDeliveryDate: isoDay(3) }],
      storeName: "Yakaboo",
    },
  });

  return { bookIds, order, shipmentId: shipmentOf({ bookId: bookIds[0] ?? "", view: order }).id };
}

function shipmentStatus(): Promise<{ receivedAt: Date | null; status: string }> {
  return prisma.shipment.findUniqueOrThrow({
    select: { receivedAt: true, status: true },
    where: { id: parcel.shipmentId },
  });
}

describe("ShipmentsRepository.receiveWithoutPendingItems", () => {
  it("closes a parcel whose books have all arrived", async () => {
    await receiveBooks(parcel.bookIds);

    await expect(closeSettledParcel()).resolves.toBe(0);
    await expect(shipmentStatus()).resolves.toMatchObject({ status: "received" });
  });

  it("leaves a parcel open while one of its books is still on the way", async () => {
    await receiveBooks([parcel.bookIds[0] ?? ""]);

    await expect(shipmentStatus()).resolves.toMatchObject({ status: "ordered" });
  });

  it("refuses to close a parcel whose books were all cancelled", async () => {
    for (const bookId of parcel.bookIds) {
      await cancelItem(bookId);
    }

    await expect(closeSettledParcel()).resolves.toBe(0);
    await expect(shipmentStatus()).resolves.toMatchObject({
      receivedAt: null,
      status: "ordered",
    });
  });

  it("closes a parcel where one book arrived and the other was cancelled", async () => {
    await cancelItem(parcel.bookIds[1] ?? "");
    await receiveBooks([parcel.bookIds[0] ?? ""]);

    await expect(shipmentStatus()).resolves.toMatchObject({ status: "received" });
  });

  it("never closes a parcel of another reader", async () => {
    const stranger = await context.registerVerifyAndLogin();
    await receiveBooks(parcel.bookIds);
    await prisma.shipment.update({
      data: { receivedAt: null, status: "ordered" },
      where: { id: parcel.shipmentId },
    });

    const closed = await repository.receiveWithoutPendingItems({
      receivedAt: RECEIVED_AT,
      shipmentIds: [parcel.shipmentId],
      userId: stranger.userId,
    });

    expect(closed).toBe(0);
    await expect(shipmentStatus()).resolves.toMatchObject({ status: "ordered" });
  });
});
