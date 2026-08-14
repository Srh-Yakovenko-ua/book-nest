import type { INestApplication } from "@nestjs/common";

import { readFile } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { createBook } from "../api/book-order.fixtures.js";
import { DeliveryModule } from "../delivery.module.js";

type LegacySeed = {
  bookId: string;
  cancelledAt?: Date;
  cancelReason?: string;
  currency?: string;
  deliveryService?: string;
  expectedDeliveryDate?: Date;
  note?: string;
  orderDate?: Date;
  orderNumber?: string;
  price?: number;
  receivedAt?: Date;
  status?: string;
  storeName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
};

const MIGRATION_SQL_URL = new URL(
  "../../../../prisma/migrations/20260812211812_migrate_book_deliveries_to_orders/migration.sql",
  import.meta.url,
);

const ORDER_DATE = new Date("2026-05-04T00:00:00.000Z");
const EXPECTED_DATE = new Date("2026-05-11T00:00:00.000Z");
const TRANSACTION_TIMEOUT_MS = 30000;

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reader: AuthenticatedUser;
let migrationStatements: string[];

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, DeliveryModule]);
  app = context.app;
  prisma = app.get(PrismaService);
  migrationStatements = splitSqlStatements(await readFile(MIGRATION_SQL_URL, "utf8"));
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

function runDataMigration(): Promise<void> {
  return prisma.$transaction(
    async (tx) => {
      for (const statement of migrationStatements) {
        await tx.$executeRawUnsafe(statement);
      }
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

async function seedLegacyDelivery(seed: LegacySeed): Promise<string> {
  const row = await prisma.bookDelivery.create({
    data: {
      bookId: seed.bookId,
      cancelledAt: seed.cancelledAt ?? null,
      cancelReason: seed.cancelReason ?? null,
      currency: seed.currency ?? "UAH",
      deliveryService: seed.deliveryService ?? null,
      expectedDeliveryDate: seed.expectedDeliveryDate ?? null,
      note: seed.note ?? null,
      orderDate: seed.orderDate ?? ORDER_DATE,
      orderNumber: seed.orderNumber ?? null,
      price: seed.price ?? null,
      receivedAt: seed.receivedAt ?? null,
      status: seed.status ?? "ordered",
      storeName: seed.storeName ?? "Yakaboo",
      trackingNumber: seed.trackingNumber ?? null,
      trackingUrl: seed.trackingUrl ?? null,
      userId: reader.userId,
    },
    select: { id: true },
  });
  return row.id;
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function titledBook(title: string): Promise<string> {
  return createBook({ accessToken: reader.accessToken, app, title });
}

describe("the legacy book_deliveries data migration", () => {
  it("folds two books sharing an order number into one order and one parcel", async () => {
    const first = await titledBook("Shared One");
    const second = await titledBook("Shared Two");
    await seedLegacyDelivery({
      bookId: first,
      orderNumber: "ORD-1",
      trackingNumber: "TRK-1",
    });
    await seedLegacyDelivery({
      bookId: second,
      orderNumber: "ORD-1",
      trackingNumber: "TRK-1",
    });

    await runDataMigration();

    const orders = await prisma.bookOrder.findMany({ include: { items: true, shipments: true } });
    expect(orders).toHaveLength(1);
    expect(orders[0]?.orderNumber).toBe("ORD-1");
    expect(orders[0]?.items).toHaveLength(2);
    expect(orders[0]?.shipments).toHaveLength(1);
  });

  it("folds rows with no order number but a shared tracking number into one order", async () => {
    const first = await titledBook("Tracked One");
    const second = await titledBook("Tracked Two");
    await seedLegacyDelivery({
      bookId: first,
      orderNumber: "   ",
      storeName: "Book Depot",
      trackingNumber: "TRK-2",
    });
    await seedLegacyDelivery({ bookId: second, storeName: "Book Depot", trackingNumber: "TRK-2" });

    await runDataMigration();

    const orders = await prisma.bookOrder.findMany({ include: { items: true, shipments: true } });
    expect(orders).toHaveLength(1);
    expect(orders[0]?.items).toHaveLength(2);
    expect(orders[0]?.shipments).toHaveLength(1);
  });

  it("treats a blank order number as no order number when grouping", async () => {
    const first = await titledBook("Blank One");
    const second = await titledBook("Blank Two");
    await seedLegacyDelivery({ bookId: first, orderNumber: "   ", storeName: "Book Depot" });
    await seedLegacyDelivery({ bookId: second, orderNumber: "   ", storeName: "Book Depot" });

    await runDataMigration();

    await expect(prisma.bookOrder.count()).resolves.toBe(2);
  });

  it("keeps rows that share nothing in separate orders", async () => {
    const first = await titledBook("Solo One");
    const second = await titledBook("Solo Two");
    await seedLegacyDelivery({ bookId: first, storeName: "Store A" });
    await seedLegacyDelivery({ bookId: second, storeName: "Store B" });

    await runDataMigration();

    const orders = await prisma.bookOrder.findMany({ include: { items: true, shipments: true } });
    expect(orders).toHaveLength(2);
    expect(orders.map((order) => order.items.length)).toEqual([1, 1]);
    expect(orders.map((order) => order.shipments.length)).toEqual([1, 1]);
  });

  it("keeps a cancelled row and its re-order apart even under one order number", async () => {
    const bookId = await titledBook("Reordered");
    await seedLegacyDelivery({
      bookId,
      cancelledAt: new Date("2026-05-05T10:00:00.000Z"),
      cancelReason: "Out of stock",
      orderNumber: "ORD-9",
      status: "cancelled",
    });
    await seedLegacyDelivery({ bookId, orderNumber: "ORD-9", status: "ordered" });

    await runDataMigration();

    const orders = await prisma.bookOrder.findMany({ include: { items: true } });
    expect(orders).toHaveLength(2);
    expect(orders.every((order) => order.orderNumber === "ORD-9")).toBe(true);
    const items = await prisma.bookOrderItem.findMany({ where: { bookId } });
    expect(items).toHaveLength(2);
    expect(items.filter((item) => item.cancelledAt !== null)).toHaveLength(1);
    expect(
      items.filter((item) => item.cancelledAt === null && item.receivedAt === null),
    ).toHaveLength(1);
  });

  it("carries every field of a legacy row over to the new model", async () => {
    const bookId = await titledBook("Full House");
    const receivedAt = new Date("2026-05-12T09:30:00.000Z");
    const legacyId = await seedLegacyDelivery({
      bookId,
      currency: "USD",
      deliveryService: "Nova Poshta",
      expectedDeliveryDate: EXPECTED_DATE,
      note: "Leave at the desk",
      orderDate: ORDER_DATE,
      orderNumber: "ORD-FULL",
      price: 349.5,
      receivedAt,
      status: "received",
      storeName: "Yakaboo",
      trackingNumber: "TRK-FULL",
      trackingUrl: "https://novaposhta.ua/tracking/TRK-FULL",
    });

    await runDataMigration();

    const item = await prisma.bookOrderItem.findUniqueOrThrow({
      include: { order: true, shipment: true },
      where: { id: legacyId },
    });
    expect(item).toMatchObject({
      bookId,
      cancelledAt: null,
      cancelReason: null,
      receivedAt,
    });
    expect(Number(item.price)).toBe(349.5);
    expect(item.order).toMatchObject({
      currency: "USD",
      orderDate: ORDER_DATE,
      orderNumber: "ORD-FULL",
      storeName: "Yakaboo",
      userId: reader.userId,
    });
    expect(item.shipment).toMatchObject({
      cancelledAt: null,
      cancelReason: null,
      deliveryServiceName: "Nova Poshta",
      expectedDeliveryDate: EXPECTED_DATE,
      note: "Leave at the desk",
      receivedAt,
      status: "received",
      trackingNumber: "TRK-FULL",
      trackingUrl: "https://novaposhta.ua/tracking/TRK-FULL",
    });
  });

  it("refuses to run when a legacy row carries a status the new model has no rule for", async () => {
    const bookId = await titledBook("Unknown Status");
    await seedLegacyDelivery({ bookId, status: "lost_in_transit" });

    await expect(runDataMigration()).rejects.toThrow();
    await expect(prisma.bookOrder.count()).resolves.toBe(0);
  });

  it("leaves the legacy rows exactly where they were", async () => {
    const bookId = await titledBook("Untouched");
    const legacyId = await seedLegacyDelivery({ bookId, orderNumber: "ORD-KEEP", price: 120 });

    await runDataMigration();

    const legacy = await prisma.bookDelivery.findUniqueOrThrow({ where: { id: legacyId } });
    expect(legacy).toMatchObject({ bookId, orderNumber: "ORD-KEEP", status: "ordered" });
    await expect(prisma.bookDelivery.count()).resolves.toBe(1);
  });
});
