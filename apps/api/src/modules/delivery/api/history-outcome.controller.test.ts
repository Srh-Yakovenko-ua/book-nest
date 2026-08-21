import type {
  BookOrderHistoryOutcomeView,
  BookOrderHistorySummaryView,
  Nullable,
  OwnershipStatus,
  ReadingStatus,
} from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { DeliveryModule } from "../delivery.module.js";
import { getJson, ORDER_ROUTES } from "./book-order.fixtures.js";

type SeededBook = {
  ownershipStatus?: OwnershipStatus;
  partNumber?: number;
  queuePosition?: number;
  readingStatus?: ReadingStatus;
  receivedAt?: Date;
  seriesId?: string;
  title: string;
  trashedBook?: boolean;
  withShipment?: string;
};

const NOT_TRASHED = { deletedAt: null, purgeAt: null } as const;
const TRASHED_AT = new Date("2026-08-03T10:00:00.000Z");

let context: AuthTestContext;
let app: INestApplication;
let reader: AuthenticatedUser;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, DeliveryModule]);
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

async function historyOutcome(): Promise<BookOrderHistoryOutcomeView> {
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.historyOutcome,
  });
  expect(res.status).toBe(200);
  return res.body as BookOrderHistoryOutcomeView;
}

async function latestReceipt(): Promise<BookOrderHistorySummaryView["latestReceipt"]> {
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.historySummary,
  });
  expect(res.status).toBe(200);
  return (res.body as BookOrderHistorySummaryView).latestReceipt;
}

async function seedOrder({
  books,
  receivedShipments = [],
  storeName,
}: {
  books: SeededBook[];
  receivedShipments?: string[];
  storeName: string;
}): Promise<{ orderId: string; shipmentIds: Map<string, string> }> {
  const prisma = app.get(PrismaService);
  const order = await prisma.bookOrder.create({ data: { storeName, userId: reader.userId } });

  const shipmentIds = new Map<string, string>();
  for (const item of books) {
    if (item.withShipment === undefined || shipmentIds.has(item.withShipment)) continue;
    const shipment = await prisma.shipment.create({
      data: {
        deliveryServiceName: "Nova Poshta",
        orderId: order.id,
        receivedAt: receivedShipments.includes(item.withShipment)
          ? (item.receivedAt ?? null)
          : null,
      },
    });
    shipmentIds.set(item.withShipment, shipment.id);
  }

  for (const item of books) {
    const book = await prisma.book.create({
      data: {
        ...(item.trashedBook === true ? TRASH_RETENTION.stamp(TRASHED_AT) : NOT_TRASHED),
        ownershipStatus: item.ownershipStatus ?? "owned",
        partNumber: item.partNumber ?? null,
        queuePosition: item.queuePosition ?? null,
        readingStatus: item.readingStatus ?? "not_started",
        seriesId: item.seriesId ?? null,
        title: item.title,
        userId: reader.userId,
      },
    });
    await prisma.bookOrderItem.create({
      data: {
        bookId: book.id,
        orderId: order.id,
        receivedAt: item.receivedAt ?? null,
        shipmentId:
          item.withShipment === undefined ? null : (shipmentIds.get(item.withShipment) ?? null),
      },
    });
  }

  return { orderId: order.id, shipmentIds };
}

async function seedSeries({
  name,
  totalBooks = null,
}: {
  name: string;
  totalBooks?: Nullable<number>;
}): Promise<string> {
  const series = await app.get(PrismaService).series.create({
    data: {
      ...NOT_TRASHED,
      name,
      normalizedName: name.toLowerCase(),
      totalBooks,
      userId: reader.userId,
    },
  });
  return series.id;
}

describe("latest receipt", () => {
  it("reports nothing while no book has been received", async () => {
    await seedOrder({ books: [{ title: "Still coming" }], storeName: "Yakaboo" });

    expect(await latestReceipt()).toBeNull();
  });

  it("takes the newest receipt even when its parcel is only partly received", async () => {
    await seedOrder({
      books: [{ receivedAt: new Date("2026-08-01T10:00:00.000Z"), title: "Older" }],
      storeName: "Amazon",
    });
    await seedOrder({
      books: [
        { receivedAt: new Date("2026-08-05T10:00:00.000Z"), title: "Newer", withShipment: "a" },
        { title: "Still in the same parcel", withShipment: "a" },
      ],
      storeName: "Yakaboo",
    });

    const receipt = await latestReceipt();

    expect(receipt?.storeName).toBe("Yakaboo");
    expect(receipt?.booksCount).toBe(1);
    expect(receipt?.receivedAt).toBe("2026-08-05T10:00:00.000Z");
    expect(receipt?.deliveryService?.name).toBe("Nova Poshta");
  });

  it("keeps a parcel-less receipt free of an invented parcel and service", async () => {
    await seedOrder({
      books: [
        { receivedAt: new Date("2026-08-05T09:00:00.000Z"), title: "First" },
        { receivedAt: new Date("2026-08-05T11:00:00.000Z"), title: "Second" },
      ],
      storeName: "Yakaboo",
    });

    const receipt = await latestReceipt();

    expect(receipt?.shipmentId).toBeNull();
    expect(receipt?.deliveryService).toBeNull();
    expect(receipt?.booksCount).toBe(2);
    expect(receipt?.sameDayCount).toBe(0);
  });

  it("counts the other receipt events of the same day", async () => {
    await seedOrder({
      books: [{ receivedAt: new Date("2026-08-05T08:00:00.000Z"), title: "From one store" }],
      storeName: "Amazon",
    });
    await seedOrder({
      books: [
        { receivedAt: new Date("2026-08-05T09:00:00.000Z"), title: "Parcel", withShipment: "a" },
        { receivedAt: new Date("2026-08-05T12:00:00.000Z"), title: "Loose" },
      ],
      receivedShipments: ["a"],
      storeName: "Yakaboo",
    });

    const receipt = await latestReceipt();

    expect(receipt?.booksCount).toBe(1);
    expect(receipt?.sameDayCount).toBe(2);
  });

  it("leaves out a book whose own record was moved to the trash", async () => {
    await seedOrder({
      books: [
        { receivedAt: new Date("2026-08-01T10:00:00.000Z"), title: "Visible" },
        {
          receivedAt: new Date("2026-08-09T10:00:00.000Z"),
          title: "Trashed",
          trashedBook: true,
        },
      ],
      storeName: "Yakaboo",
    });

    const receipt = await latestReceipt();

    expect(receipt?.receivedAt).toBe("2026-08-01T10:00:00.000Z");
  });
});

describe("received books waiting to be read", () => {
  it("leaves the block out while nothing has been received", async () => {
    await seedOrder({ books: [{ title: "Still coming" }], storeName: "Yakaboo" });

    expect((await historyOutcome()).unreadReceived).toBeNull();
  });

  it("counts only the received books nobody has opened yet", async () => {
    await seedOrder({
      books: [
        { readingStatus: "not_started", receivedAt: new Date(), title: "Untouched" },
        { readingStatus: "want_to_read", receivedAt: new Date(), title: "Planned" },
        { readingStatus: "reading", receivedAt: new Date(), title: "Open right now" },
        { readingStatus: "paused", receivedAt: new Date(), title: "Paused" },
        { readingStatus: "finished", receivedAt: new Date(), title: "Done" },
        { readingStatus: "dnf", receivedAt: new Date(), title: "Given up" },
        { readingStatus: "rereading", receivedAt: new Date(), title: "Again" },
        { readingStatus: "not_started", title: "Never ordered in" },
      ],
      storeName: "Yakaboo",
    });

    expect((await historyOutcome()).unreadReceived?.booksCount).toBe(2);
  });

  it("says how many of them already sit in the reading queue", async () => {
    await seedOrder({
      books: [
        { queuePosition: 2, receivedAt: new Date(), title: "Queued second" },
        { queuePosition: 1, receivedAt: new Date(), title: "Queued first" },
        { receivedAt: new Date(), title: "Unqueued" },
      ],
      storeName: "Yakaboo",
    });

    const outcome = await historyOutcome();

    expect(outcome.unreadReceived?.booksCount).toBe(3);
    expect(outcome.unreadReceived?.inQueueCount).toBe(2);
    expect(outcome.unreadReceived?.bookPreviews.map((book) => book.title)).toEqual([
      "Queued first",
      "Queued second",
      "Unqueued",
    ]);
  });

  it("reports everything read once no received book is waiting", async () => {
    await seedOrder({
      books: [{ readingStatus: "finished", receivedAt: new Date(), title: "Done" }],
      storeName: "Yakaboo",
    });

    const outcome = await historyOutcome();

    expect(outcome.unreadReceived).toEqual({
      bookPreviews: [],
      booksCount: 0,
      inQueueCount: 0,
    });
  });
});

describe("what the received books changed for series", () => {
  it("says nothing while the received books belong to no series", async () => {
    await seedOrder({
      books: [{ receivedAt: new Date(), title: "Standalone" }],
      storeName: "Yakaboo",
    });

    expect((await historyOutcome()).seriesInsights).toEqual([]);
  });

  it("stays silent when the received books only topped a series up", async () => {
    const seriesId = await seedSeries({ name: "Dune", totalBooks: 6 });
    await seedOrder({
      books: [
        { partNumber: 1, seriesId, title: "Dune" },
        { partNumber: 2, receivedAt: new Date(), seriesId, title: "Messiah" },
      ],
      storeName: "Yakaboo",
    });

    expect((await historyOutcome()).seriesInsights).toEqual([]);
  });

  it("counts the series a received book completed", async () => {
    const seriesId = await seedSeries({ name: "Dune", totalBooks: 2 });
    await seedOrder({
      books: [
        { partNumber: 1, seriesId, title: "Dune" },
        { partNumber: 2, receivedAt: new Date(), seriesId, title: "Messiah" },
      ],
      storeName: "Yakaboo",
    });

    expect((await historyOutcome()).seriesInsights).toEqual([
      { booksCount: 1, kind: "series_completed", seriesCount: 1 },
    ]);
  });

  it("counts the ownership gap a received middle part closed", async () => {
    const seriesId = await seedSeries({ name: "Dune", totalBooks: 6 });
    await seedOrder({
      books: [
        { partNumber: 1, seriesId, title: "Dune" },
        { partNumber: 2, receivedAt: new Date(), seriesId, title: "Messiah" },
        { partNumber: 3, seriesId, title: "Children" },
      ],
      storeName: "Yakaboo",
    });

    expect((await historyOutcome()).seriesInsights).toEqual([
      { booksCount: 1, kind: "series_gaps_closed", seriesCount: 1 },
    ]);
  });

  it("counts a series once, under the strongest thing that happened to it", async () => {
    const completed = await seedSeries({ name: "Dune", totalBooks: 2 });
    const gapped = await seedSeries({ name: "Foundation", totalBooks: 6 });
    const toppedUp = await seedSeries({ name: "Earthsea", totalBooks: 6 });
    await seedOrder({
      books: [
        { partNumber: 1, seriesId: completed, title: "Dune" },
        { partNumber: 2, receivedAt: new Date(), seriesId: completed, title: "Messiah" },
        { partNumber: 1, seriesId: gapped, title: "Foundation" },
        { partNumber: 2, receivedAt: new Date(), seriesId: gapped, title: "Empire" },
        { partNumber: 3, seriesId: gapped, title: "Second Foundation" },
        { partNumber: 1, seriesId: toppedUp, title: "Wizard" },
        { partNumber: 2, receivedAt: new Date(), seriesId: toppedUp, title: "Tombs" },
      ],
      storeName: "Yakaboo",
    });

    expect((await historyOutcome()).seriesInsights).toEqual([
      { booksCount: 1, kind: "series_completed", seriesCount: 1 },
      { booksCount: 1, kind: "series_gaps_closed", seriesCount: 1 },
      { booksCount: 1, kind: "series_topped_up", seriesCount: 1 },
    ]);
  });
});
