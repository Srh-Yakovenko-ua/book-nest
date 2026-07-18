import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";
import { BookDeliveriesRepository } from "../infrastructure/book-deliveries.repository.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FUTURE_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10);

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule]);
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

function cancelDelivery(
  accessToken: string,
  bookId: string,
  deliveryId: string,
  body?: Record<string, unknown>,
): request.Test {
  const req = request(app.getHttpServer())
    .post(`/api/books/${bookId}/deliveries/${deliveryId}/cancel`)
    .set("Authorization", `Bearer ${accessToken}`);
  return body === undefined ? req : req.send(body);
}

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function createDelivery(
  accessToken: string,
  bookId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${bookId}/deliveries`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function listDeliveries(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${bookId}/deliveries`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function receiveDelivery(
  accessToken: string,
  bookId: string,
  deliveryId: string,
  body?: Record<string, unknown>,
): request.Test {
  const req = request(app.getHttpServer())
    .post(`/api/books/${bookId}/deliveries/${deliveryId}/receive`)
    .set("Authorization", `Bearer ${accessToken}`);
  return body === undefined ? req : req.send(body);
}

async function seedBookWithDelivery(
  accessToken: string,
  bookBody: Record<string, unknown> = {},
): Promise<{ bookId: string; deliveryId: string }> {
  const created = await createBook(accessToken, {
    authors: [{ name: "Frank Herbert" }],
    title: "Dune",
    ...bookBody,
  });
  const res = await createDelivery(accessToken, created.body.id, {
    orderDate: "2026-01-20",
    storeName: "Yakaboo",
  });
  return { bookId: created.body.id, deliveryId: res.body.delivery.active.id };
}

function updateDelivery(
  accessToken: string,
  bookId: string,
  deliveryId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/books/${bookId}/deliveries/${deliveryId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("POST /api/books/:id/deliveries authorization", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/books/${MISSING_UUID}/deliveries`)
      .send({ orderDate: "2026-01-20", storeName: "Yakaboo" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed book id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createDelivery(accessToken, "not-a-uuid", { storeName: "Yakaboo" });

    expect(res.status).toBe(400);
  });

  it("returns 404 for a book that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createDelivery(accessToken, MISSING_UUID, {
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the book belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await createDelivery(stranger.accessToken, created.body.id, {
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/books/:id/deliveries validation", () => {
  it("returns 400 when the store name is missing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createDelivery(accessToken, created.body.id, { orderDate: "2026-01-20" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "storeName" })]),
    );
  });

  it("returns 400 when the order date is missing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createDelivery(accessToken, created.body.id, { storeName: "Yakaboo" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "orderDate" })]),
    );
  });

  it("returns 400 when the order date is in the future", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createDelivery(accessToken, created.body.id, {
      orderDate: FUTURE_DATE,
      storeName: "Yakaboo",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "orderDate" })]),
    );
  });

  it("returns 400 when the expected delivery date is before the order date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createDelivery(accessToken, created.body.id, {
      expectedDeliveryDate: "2026-01-10",
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "expectedDeliveryDate" })]),
    );
  });

  it("returns 400 for a tracking url with a non-http(s) scheme", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createDelivery(accessToken, created.body.id, {
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
      trackingUrl: "ftp://track.example.com",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "trackingUrl" })]),
    );
  });
});

describe("POST /api/books/:id/deliveries preconditions", () => {
  it("returns 409 when the book already has an active delivery", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await seedBookWithDelivery(accessToken);

    const res = await createDelivery(accessToken, bookId, {
      orderDate: "2026-01-20",
      storeName: "Second Store",
    });

    expect(res.status).toBe(409);
  });

  it("returns 409 when the book is already owned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await createDelivery(accessToken, created.body.id, {
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
    });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/books/:id/deliveries side effects", () => {
  it("creates an ordered delivery and marks the book as in transit", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createDelivery(accessToken, created.body.id, {
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
    });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("in_transit");
    expect(res.body.delivery.active).toMatchObject({
      status: "ordered",
      storeName: "Yakaboo",
    });
    expect(res.body.delivery.active.id).toMatch(UUID_PATTERN);
    expect(res.body.delivery.totalCount).toBe(1);
    expect(res.body.delivery.latest.id).toBe(res.body.delivery.active.id);
  });

  it("allows starting a delivery from a want_to_buy book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      title: "Dune",
    });

    const res = await createDelivery(accessToken, created.body.id, {
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
    });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("in_transit");
    expect(res.body.delivery.active.status).toBe("ordered");
  });

  it("repairs an in_transit book that has no delivery record by creating one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    await prisma.book.update({
      data: { ownershipStatus: "in_transit" },
      where: { id: created.body.id },
    });

    const res = await createDelivery(accessToken, created.body.id, {
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
    });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("in_transit");
    expect(res.body.delivery.active.status).toBe("ordered");
    expect(res.body.delivery.totalCount).toBe(1);
  });
});

describe("PATCH /api/books/:id/deliveries/:deliveryId", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/books/${MISSING_UUID}/deliveries/${MISSING_UUID}`)
      .send({ storeName: "New Store" });

    expect(res.status).toBe(401);
  });

  it("returns 404 for a delivery that does not exist on the book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateDelivery(accessToken, created.body.id, MISSING_UUID, {
      storeName: "New Store",
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the delivery belongs to another user's book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const seeded = await seedBookWithDelivery(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerBook = await createBook(stranger.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateDelivery(
      stranger.accessToken,
      strangerBook.body.id,
      seeded.deliveryId,
      { storeName: "New Store" },
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 when the body carries a terminal status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await updateDelivery(accessToken, bookId, deliveryId, { status: "received" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "status" })]),
    );
  });

  it("edits the fields of an active delivery", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await updateDelivery(accessToken, bookId, deliveryId, {
      status: "in_transit",
      storeName: "Nova Poshta Store",
    });

    expect(res.status).toBe(200);
    expect(res.body.delivery.active).toMatchObject({
      status: "in_transit",
      storeName: "Nova Poshta Store",
    });
  });

  it("clears a nullable field when the body sends null", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const delivery = await createDelivery(accessToken, created.body.id, {
      orderDate: "2026-01-20",
      orderNumber: "ORD-1",
      storeName: "Yakaboo",
    });

    const res = await updateDelivery(
      accessToken,
      created.body.id,
      delivery.body.delivery.active.id,
      {
        orderNumber: null,
      },
    );

    expect(res.status).toBe(200);
    expect(res.body.delivery.active.orderNumber).toBeNull();
  });

  it("leaves omitted fields untouched", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await updateDelivery(accessToken, bookId, deliveryId, { note: "left a note" });

    expect(res.status).toBe(200);
    expect(res.body.delivery.active).toMatchObject({ note: "left a note", storeName: "Yakaboo" });
  });

  it("returns 409 when the delivery is no longer active", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);
    await receiveDelivery(accessToken, bookId, deliveryId);

    const res = await updateDelivery(accessToken, bookId, deliveryId, { storeName: "New Store" });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/books/:id/deliveries/:deliveryId/receive", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).post(
      `/api/books/${MISSING_UUID}/deliveries/${MISSING_UUID}/receive`,
    );

    expect(res.status).toBe(401);
  });

  it("returns 404 when the delivery belongs to another user's book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const seeded = await seedBookWithDelivery(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerBook = await createBook(stranger.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await receiveDelivery(
      stranger.accessToken,
      strangerBook.body.id,
      seeded.deliveryId,
    );

    expect(res.status).toBe(404);
  });

  it("marks the delivery received and the book owned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await receiveDelivery(accessToken, bookId, deliveryId);

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("owned");
    expect(res.body.delivery.active).toBeNull();
    expect(res.body.delivery.latest).toMatchObject({ id: deliveryId, status: "received" });
    expect(res.body.delivery.latest.receivedAt).not.toBeNull();
    expect(res.body.delivery.totalCount).toBe(1);
  });

  it("stamps the received date with now when no receivedAt is supplied", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);
    const before = Date.now();

    const res = await receiveDelivery(accessToken, bookId, deliveryId, {});
    const after = Date.now();

    expect(res.status).toBe(200);
    const receivedAt = new Date(res.body.delivery.latest.receivedAt).getTime();
    expect(receivedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(receivedAt).toBeLessThanOrEqual(after + 1000);
  });

  it("persists a supplied past received date instead of now", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await receiveDelivery(accessToken, bookId, deliveryId, {
      receivedAt: "2026-02-10",
    });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("owned");
    expect(res.body.delivery.latest).toMatchObject({ id: deliveryId, status: "received" });
    expect(res.body.delivery.latest.receivedAt).toBe("2026-02-10T00:00:00.000Z");
    const row = await prisma.bookDelivery.findFirstOrThrow({ where: { id: deliveryId } });
    expect(row.receivedAt).toEqual(new Date("2026-02-10T00:00:00.000Z"));
  });

  it("returns 400 when the supplied received date is in the future", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await receiveDelivery(accessToken, bookId, deliveryId, { receivedAt: FUTURE_DATE });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "receivedAt" })]),
    );
  });

  it("returns 400 for a malformed received date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await receiveDelivery(accessToken, bookId, deliveryId, {
      receivedAt: "10/02/2026",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "receivedAt" })]),
    );
  });

  it("returns 409 when the delivery is already received", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);
    await receiveDelivery(accessToken, bookId, deliveryId);

    const res = await receiveDelivery(accessToken, bookId, deliveryId);

    expect(res.status).toBe(409);
  });

  it("returns 409 for an already-received delivery even with a supplied received date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);
    await receiveDelivery(accessToken, bookId, deliveryId, {});

    const res = await receiveDelivery(accessToken, bookId, deliveryId, {
      receivedAt: "2026-02-10",
    });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/books/:id/deliveries/:deliveryId/cancel", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).post(
      `/api/books/${MISSING_UUID}/deliveries/${MISSING_UUID}/cancel`,
    );

    expect(res.status).toBe(401);
  });

  it("cancels the delivery and keeps the book as want_to_buy by default", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await cancelDelivery(accessToken, bookId, deliveryId, {});

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("want_to_buy");
    expect(res.body.delivery.active).toBeNull();
    expect(res.body.delivery.latest).toMatchObject({ id: deliveryId, status: "cancelled" });
    expect(res.body.delivery.latest.cancelledAt).not.toBeNull();
  });

  it("returns the book to none when keepAsWantToBuy is false", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await cancelDelivery(accessToken, bookId, deliveryId, { keepAsWantToBuy: false });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("none");
    expect(res.body.delivery.latest.status).toBe("cancelled");
  });

  it("retains the delivery fields after cancelling", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const delivery = await createDelivery(accessToken, created.body.id, {
      orderDate: "2026-01-20",
      orderNumber: "ORD-1",
      storeName: "Yakaboo",
    });

    const res = await cancelDelivery(
      accessToken,
      created.body.id,
      delivery.body.delivery.active.id,
      {},
    );

    expect(res.status).toBe(200);
    expect(res.body.delivery.latest).toMatchObject({
      orderNumber: "ORD-1",
      status: "cancelled",
      storeName: "Yakaboo",
    });
  });

  it("returns 409 when the delivery is already cancelled", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);
    await cancelDelivery(accessToken, bookId, deliveryId, {});

    const res = await cancelDelivery(accessToken, bookId, deliveryId, {});

    expect(res.status).toBe(409);
  });
});

describe("POST /api/books/:id/deliveries/:deliveryId/cancel cancel reason", () => {
  it("persists a trimmed cancel reason and returns it on the cancelled delivery", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await cancelDelivery(accessToken, bookId, deliveryId, {
      cancelReason: "  Out   of stock  ",
    });

    expect(res.status).toBe(200);
    expect(res.body.delivery.latest.cancelReason).toBe("Out of stock");
    const row = await prisma.bookDelivery.findFirstOrThrow({ where: { id: deliveryId } });
    expect(row.cancelReason).toBe("Out of stock");
  });

  it("stores a null cancel reason when none is provided", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await cancelDelivery(accessToken, bookId, deliveryId, {});

    expect(res.status).toBe(200);
    expect(res.body.delivery.latest.cancelReason).toBeNull();
    const row = await prisma.bookDelivery.findFirstOrThrow({ where: { id: deliveryId } });
    expect(row.cancelReason).toBeNull();
  });

  it("collapses a whitespace-only cancel reason to null", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await cancelDelivery(accessToken, bookId, deliveryId, { cancelReason: "   " });

    expect(res.status).toBe(200);
    expect(res.body.delivery.latest.cancelReason).toBeNull();
  });

  it("returns 400 for a cancel reason longer than 500 characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await cancelDelivery(accessToken, bookId, deliveryId, {
      cancelReason: "a".repeat(501),
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "cancelReason" })]),
    );
  });

  it("returns 400 for a cancel reason containing an HTML tag", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, deliveryId } = await seedBookWithDelivery(accessToken);

    const res = await cancelDelivery(accessToken, bookId, deliveryId, {
      cancelReason: "Cancelled <script>alert(1)</script>",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "cancelReason" })]),
    );
  });

  it("exposes a null cancel reason on an active delivery", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createDelivery(accessToken, created.body.id, {
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
    });

    expect(res.status).toBe(200);
    expect(res.body.delivery.active.cancelReason).toBeNull();
  });
});

describe("GET /api/books/:id/deliveries", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get(`/api/books/${MISSING_UUID}/deliveries`);

    expect(res.status).toBe(401);
  });

  it("returns 404 when the book belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await listDeliveries(stranger.accessToken, created.body.id);

    expect(res.status).toBe(404);
  });

  it("returns an empty array for a book with no deliveries", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await listDeliveries(accessToken, created.body.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists deliveries newest first and includes terminal rows", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const first = await createDelivery(accessToken, created.body.id, {
      orderDate: "2026-01-10",
      storeName: "First Store",
    });
    await cancelDelivery(accessToken, created.body.id, first.body.delivery.active.id, {});
    await createDelivery(accessToken, created.body.id, {
      orderDate: "2026-01-20",
      storeName: "Second Store",
    });

    const res = await listDeliveries(accessToken, created.body.id);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ status: "ordered", storeName: "Second Store" });
    expect(res.body[1]).toMatchObject({ status: "cancelled", storeName: "First Store" });
  });
});

describe("book_deliveries active partial unique index", () => {
  it("rejects a second active delivery row inserted directly for the same book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    await prisma.bookDelivery.create({
      data: { bookId: created.body.id, status: "ordered", storeName: "First", userId },
    });

    await expect(
      prisma.bookDelivery.create({
        data: { bookId: created.body.id, status: "in_transit", storeName: "Second", userId },
      }),
    ).rejects.toThrow();
  });
});

describe("concurrent delivery creation", () => {
  it("translates the losing double-POST into 409 rather than 500", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const [first, second] = await Promise.all([
      createDelivery(accessToken, created.body.id, { orderDate: "2026-01-20", storeName: "A" }),
      createDelivery(accessToken, created.body.id, { orderDate: "2026-01-20", storeName: "B" }),
    ]);

    expect([first.status, second.status].sort((left, right) => left - right)).toEqual([200, 409]);
  });
});

describe("applyRecordChange active-status guard", () => {
  it("reports not-active for a transition on a terminal delivery", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const seeded = await prisma.bookDelivery.create({
      data: {
        bookId: created.body.id,
        receivedAt: new Date(),
        status: "received",
        storeName: "Store",
        userId,
      },
    });
    const repository = app.get(BookDeliveriesRepository);

    await expect(
      repository.applyRecordChange(userId, created.body.id, seeded.id, {
        book: null,
        delivery: { note: "guard" },
      }),
    ).resolves.toBe("not-active");
  });

  it("reports not-found for a missing delivery", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const repository = app.get(BookDeliveriesRepository);

    await expect(
      repository.applyRecordChange(userId, created.body.id, MISSING_UUID, {
        book: null,
        delivery: { note: "guard" },
      }),
    ).resolves.toBe("not-found");
  });
});
