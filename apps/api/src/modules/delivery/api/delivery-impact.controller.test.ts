import type { InTransitImpactView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { SeriesModule } from "../../series/series.module.js";
import { DeliveryModule } from "../delivery.module.js";
import { createOrder, getJson } from "./book-order.fixtures.js";

const IMPACT_ROUTE = "/api/delivery/books/in-transit/impact";

let context: AuthTestContext;
let app: INestApplication;
let reader: AuthenticatedUser;

beforeAll(async () => {
  context = await createAuthTestContext([
    AuthModule,
    BooksModule,
    ListsModule,
    SeriesModule,
    DeliveryModule,
  ]);
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

type AddedBook = { id: string; seriesId: string };

async function addBook(body: Record<string, unknown>): Promise<AddedBook> {
  const res = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${reader.accessToken}`)
    .send({ authors: [{ name: "Robin Hobb" }], ...body });
  if (typeof res.body.id !== "string") {
    throw new Error(`book creation failed with status ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.id, seriesId: res.body.series?.id ?? "" };
}

async function impact(): Promise<InTransitImpactView> {
  const res = await getJson({ accessToken: reader.accessToken, app, path: IMPACT_ROUTE });
  expect(res.status).toBe(200);
  return res.body;
}

async function order(bookIds: string[]): Promise<void> {
  await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      items: bookIds.map((bookId) => ({ bookId })),
      storeName: "Yakaboo",
      totalAmount: 500,
    },
  });
}

describe("GET /api/delivery/books/in-transit/impact", () => {
  it("requires authentication", async () => {
    const res = await request(app.getHttpServer()).get(IMPACT_ROUTE);

    expect(res.status).toBe(401);
  });

  it("reports nothing when no book is on its way", async () => {
    await addBook({ ownershipStatus: "owned", title: "Assassin's Apprentice" });

    expect(await impact()).toEqual({ items: [] });
  });

  it("reports a series that the arriving book completes", async () => {
    const first = await addBook({
      bookType: "series_part",
      newSeries: { name: "Farseer", status: "completed", totalBooks: 2 },
      ownershipStatus: "owned",
      partNumber: 1,
      title: "Assassin's Apprentice",
    });
    const second = await addBook({
      bookType: "series_part",
      partNumber: 2,
      seriesId: first.seriesId,
      title: "Royal Assassin",
    });

    await order([second.id]);

    expect((await impact()).items).toContainEqual({
      booksCount: 1,
      kind: "series_completed",
      seriesCount: 1,
    });
  });

  it("leaves out a series that still misses a copy nobody is delivering", async () => {
    const first = await addBook({
      bookType: "series_part",
      newSeries: { name: "Farseer", status: "completed", totalBooks: 3 },
      ownershipStatus: "owned",
      partNumber: 1,
      title: "Assassin's Apprentice",
    });
    const second = await addBook({
      bookType: "series_part",
      partNumber: 2,
      seriesId: first.seriesId,
      title: "Royal Assassin",
    });
    await addBook({
      bookType: "series_part",
      ownershipStatus: "want_to_buy",
      partNumber: 3,
      seriesId: first.seriesId,
      title: "Assassin's Quest",
    });

    await order([second.id]);

    expect((await impact()).items).not.toContainEqual(
      expect.objectContaining({ kind: "series_completed" }),
    );
  });

  it("reports a queued book that receiving makes readable", async () => {
    const queued = await addBook({ addToReadingQueue: true, title: "Ship of Magic" });

    await order([queued.id]);

    expect((await impact()).items).toContainEqual({
      booksCount: 1,
      highPriorityCount: 0,
      kind: "queue_available",
    });
  });

  it("ignores a book whose order item was already cancelled", async () => {
    const queued = await addBook({ addToReadingQueue: true, title: "Ship of Magic" });
    const view = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: { items: [{ bookId: queued.id }], storeName: "Yakaboo", totalAmount: 500 },
    });
    const item = view.items.find((candidate) => candidate.bookId === queued.id);

    await request(app.getHttpServer())
      .post(`/api/delivery/items/${item?.id ?? ""}/cancel`)
      .set("Authorization", `Bearer ${reader.accessToken}`)
      .send({});

    expect(await impact()).toEqual({ items: [] });
  });

  it("keeps another user's deliveries out of the report", async () => {
    const queued = await addBook({ addToReadingQueue: true, title: "Ship of Magic" });
    await order([queued.id]);

    const stranger = await context.registerVerifyAndLogin();
    const res = await getJson({ accessToken: stranger.accessToken, app, path: IMPACT_ROUTE });

    expect(res.body).toEqual({ items: [] });
  });
});
