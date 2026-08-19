import type { BookOrderHistorySummaryView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { DeliveryModule } from "../delivery.module.js";
import { getJson, ORDER_ROUTES } from "./book-order.fixtures.js";

type SeededItem = {
  cancelled?: boolean;
  received?: boolean;
  seriesId?: string;
  title: string;
  trashedBook?: boolean;
  withShipment?: string;
};

const RECEIVED_AT = new Date("2026-08-01T10:00:00.000Z");
const CANCELLED_AT = new Date("2026-08-02T10:00:00.000Z");
const TRASHED_AT = new Date("2026-08-03T10:00:00.000Z");

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

async function historySummary(): Promise<BookOrderHistorySummaryView> {
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.historySummary,
  });
  expect(res.status).toBe(200);
  return res.body as BookOrderHistorySummaryView;
}

async function seedOrder({ items, storeName }: { items: SeededItem[]; storeName: string }) {
  const prisma = app.get(PrismaService);
  const order = await prisma.bookOrder.create({
    data: { storeName, userId: reader.userId },
  });

  const shipmentIds = new Map<string, string>();
  for (const item of items) {
    if (item.withShipment === undefined || shipmentIds.has(item.withShipment)) continue;
    const shipment = await prisma.shipment.create({ data: { orderId: order.id } });
    shipmentIds.set(item.withShipment, shipment.id);
  }

  for (const item of items) {
    const book = await prisma.book.create({
      data: {
        deletedAt: item.trashedBook === true ? TRASHED_AT : null,
        seriesId: item.seriesId ?? null,
        title: item.title,
        userId: reader.userId,
      },
    });
    await prisma.bookOrderItem.create({
      data: {
        bookId: book.id,
        cancelledAt: item.cancelled === true ? CANCELLED_AT : null,
        orderId: order.id,
        receivedAt: item.received === true ? RECEIVED_AT : null,
        shipmentId:
          item.withShipment === undefined ? null : (shipmentIds.get(item.withShipment) ?? null),
      },
    });
  }

  return order.id;
}

async function seedSeries({ name, trashed = false }: { name: string; trashed?: boolean }) {
  const series = await app.get(PrismaService).series.create({
    data: {
      deletedAt: trashed ? TRASHED_AT : null,
      name,
      normalizedName: name.toLowerCase(),
      userId: reader.userId,
    },
  });
  return series.id;
}

describe("history summary counts books", () => {
  it("counts only books that actually reached a terminal state", async () => {
    await seedOrder({
      items: [
        { received: true, title: "Received" },
        { cancelled: true, title: "Cancelled" },
        { title: "Still ordered" },
        { title: "On its way", withShipment: "a" },
      ],
      storeName: "Yakaboo",
    });

    const summary = await historySummary();

    expect(summary.receivedBooksCount).toBe(1);
    expect(summary.cancelledBooksCount).toBe(1);
  });

  it("counts a partially received order the moment its first book arrives", async () => {
    await seedOrder({
      items: [{ received: true, title: "Arrived" }, { title: "Still coming" }],
      storeName: "Yakaboo",
    });

    const summary = await historySummary();

    expect(summary.receivedBooksCount).toBe(1);
    expect(summary.receivedOrdersCount).toBe(1);
  });

  it("leaves out books whose own record was moved to the trash", async () => {
    await seedOrder({
      items: [
        { received: true, title: "Visible" },
        { received: true, title: "Trashed", trashedBook: true },
      ],
      storeName: "Yakaboo",
    });

    const summary = await historySummary();

    expect(summary.receivedBooksCount).toBe(1);
  });
});

describe("history summary counts orders and parcels", () => {
  it("counts each order once however many of its books arrived", async () => {
    await seedOrder({
      items: [
        { received: true, title: "First" },
        { received: true, title: "Second" },
      ],
      storeName: "Yakaboo",
    });
    await seedOrder({ items: [{ received: true, title: "Third" }], storeName: "Amazon" });

    const summary = await historySummary();

    expect(summary.receivedBooksCount).toBe(3);
    expect(summary.receivedOrdersCount).toBe(2);
  });

  it("counts the parcels the received books arrived in, ignoring books recorded without one", async () => {
    await seedOrder({
      items: [
        { received: true, title: "Packed together A", withShipment: "first" },
        { received: true, title: "Packed together B", withShipment: "first" },
        { received: true, title: "Own parcel", withShipment: "second" },
        { received: true, title: "No parcel" },
        { title: "Unreceived parcel", withShipment: "third" },
      ],
      storeName: "Yakaboo",
    });

    const summary = await historySummary();

    expect(summary.receivedShipmentsCount).toBe(2);
  });

  it("counts an order among the cancelled ones as soon as a single book is cancelled", async () => {
    await seedOrder({
      items: [
        { cancelled: true, title: "Dropped" },
        { received: true, title: "Kept" },
      ],
      storeName: "Yakaboo",
    });

    const summary = await historySummary();

    expect(summary.cancelledOrdersCount).toBe(1);
    expect(summary.receivedOrdersCount).toBe(1);
  });
});

describe("history summary counts completed orders", () => {
  it("counts an order whose books all reached a terminal state", async () => {
    await seedOrder({ items: [{ received: true, title: "All received" }], storeName: "A" });
    await seedOrder({
      items: [
        { received: true, title: "Mixed received" },
        { cancelled: true, title: "Mixed cancelled" },
      ],
      storeName: "B",
    });
    await seedOrder({ items: [{ cancelled: true, title: "All cancelled" }], storeName: "C" });

    const summary = await historySummary();

    expect(summary.completedOrdersCount).toBe(3);
    expect(summary.completedWithoutCancellationsCount).toBe(1);
    expect(summary.completedWithCancellationsCount).toBe(2);
  });

  it("holds back an order that still carries a book on its way", async () => {
    await seedOrder({
      items: [
        { received: true, title: "Here" },
        { title: "Not here yet", withShipment: "a" },
      ],
      storeName: "Yakaboo",
    });

    const summary = await historySummary();

    expect(summary.completedOrdersCount).toBe(0);
  });

  it("ignores a pending book whose record was trashed, matching what the history list shows", async () => {
    await seedOrder({
      items: [
        { received: true, title: "Here" },
        { title: "Pending but trashed", trashedBook: true },
      ],
      storeName: "Yakaboo",
    });

    const summary = await historySummary();

    expect(summary.completedOrdersCount).toBe(1);
    expect(summary.completedWithoutCancellationsCount).toBe(1);
  });

  it("counts no completed order when the caller has no history at all", async () => {
    const summary = await historySummary();

    expect(summary).toMatchObject({
      cancelledBooksCount: 0,
      cancelledOrdersCount: 0,
      completedOrdersCount: 0,
      completedWithCancellationsCount: 0,
      completedWithoutCancellationsCount: 0,
      receivedBooksCount: 0,
      receivedOrdersCount: 0,
      receivedSeriesBooksCount: 0,
      receivedSeriesCount: 0,
      receivedShipmentsCount: 0,
      receivedStandaloneBooksCount: 0,
    });
  });
});

describe("history summary counts topped-up series", () => {
  it("counts a series once however many of its books arrived", async () => {
    const dune = await seedSeries({ name: "Dune" });
    const earthsea = await seedSeries({ name: "Earthsea" });
    await seedOrder({
      items: [
        { received: true, seriesId: dune, title: "Dune I" },
        { received: true, seriesId: dune, title: "Dune II" },
        { received: true, seriesId: earthsea, title: "Earthsea I" },
        { received: true, title: "Standalone" },
      ],
      storeName: "Yakaboo",
    });

    const summary = await historySummary();

    expect(summary.receivedSeriesCount).toBe(2);
    expect(summary.receivedSeriesBooksCount).toBe(3);
    expect(summary.receivedStandaloneBooksCount).toBe(1);
  });

  it("leaves out a series that was moved to the trash and counts its book as standalone", async () => {
    const trashed = await seedSeries({ name: "Retired", trashed: true });
    await seedOrder({
      items: [{ received: true, seriesId: trashed, title: "Orphan" }],
      storeName: "Yakaboo",
    });

    const summary = await historySummary();

    expect(summary.receivedSeriesCount).toBe(0);
    expect(summary.receivedSeriesBooksCount).toBe(0);
    expect(summary.receivedStandaloneBooksCount).toBe(1);
  });

  it("never counts a series a cancelled or pending book belongs to", async () => {
    const dune = await seedSeries({ name: "Dune" });
    await seedOrder({
      items: [
        { cancelled: true, seriesId: dune, title: "Cancelled part" },
        { seriesId: dune, title: "Pending part" },
      ],
      storeName: "Yakaboo",
    });

    const summary = await historySummary();

    expect(summary.receivedSeriesCount).toBe(0);
  });

  it("splits every received book between the series and the standalone tally", async () => {
    const dune = await seedSeries({ name: "Dune" });
    await seedOrder({
      items: [
        { received: true, seriesId: dune, title: "In a series" },
        { received: true, title: "Alone" },
        { received: true, title: "Also alone" },
      ],
      storeName: "Yakaboo",
    });

    const summary = await historySummary();

    expect(summary.receivedSeriesBooksCount + summary.receivedStandaloneBooksCount).toBe(
      summary.receivedBooksCount,
    );
  });
});
