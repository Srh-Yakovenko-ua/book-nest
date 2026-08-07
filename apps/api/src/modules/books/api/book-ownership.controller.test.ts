import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const TODAY = new Date().toISOString().slice(0, 10);
const PAST_PURCHASE_DATE = "2025-01-15";
const FUTURE_PURCHASE_DATE = "2999-12-31";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule]);
  app = context.app;
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

function addStoreLink(
  accessToken: string,
  bookId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${bookId}/store-links`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function listStoreLinks(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${bookId}/store-links`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function ownershipAction(
  accessToken: string,
  id: string,
  action: string,
  body?: Record<string, unknown>,
): request.Test {
  const req = request(app.getHttpServer())
    .post(`/api/books/${id}/ownership/${action}`)
    .set("Authorization", `Bearer ${accessToken}`);
  return body === undefined ? req : req.send(body);
}

describe("POST /api/books/:id/ownership/mark-owned", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).post(
      `/api/books/${MISSING_UUID}/ownership/mark-owned`,
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed book id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await ownershipAction(accessToken, "not-a-uuid", "mark-owned");

    expect(res.status).toBe(400);
  });

  it("returns 404 for a book that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await ownershipAction(accessToken, MISSING_UUID, "mark-owned");

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

    const res = await ownershipAction(stranger.accessToken, created.body.id, "mark-owned");

    expect(res.status).toBe(404);
  });

  it("marks a book with no ownership as owned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "mark-owned");

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("owned");
  });

  it("marks a want-to-buy book as owned and clears its planned purchase info", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      purchaseInfo: { currency: "UAH", expectedPrice: 299.99, storeName: "Yakaboo" },
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "mark-owned");

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("owned");
    expect(res.body.purchaseInfo).toBeNull();
  });

  it("returns 409 when the book is already owned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "mark-owned");

    expect(res.status).toBe(409);
  });

  it("leaves reading status and favorite untouched when marking owned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      isFavorite: true,
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "mark-owned");

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("reading");
    expect(res.body.isFavorite).toBe(true);
  });
});

describe("POST /api/books/:id/ownership/remove-owned", () => {
  it("removes ownership from an owned book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "remove-owned");

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("none");
  });

  it("returns 409 when the book is not owned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "remove-owned");

    expect(res.status).toBe(409);
  });

  it("deletes the purchase row on remove-owned so re-entry starts fresh", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      purchaseInfo: { currency: "UAH", expectedPrice: 299.99, storeName: "Yakaboo" },
      title: "Dune",
    });

    await ownershipAction(accessToken, created.body.id, "mark-bought", {});
    const removed = await ownershipAction(accessToken, created.body.id, "remove-owned");

    expect(removed.status).toBe(200);
    expect(removed.body.ownershipStatus).toBe("none");
    expect(removed.body.purchaseInfo).toBeNull();

    const reentered = await ownershipAction(accessToken, created.body.id, "want-to-buy", {});

    expect(reentered.status).toBe(200);
    expect(reentered.body.ownershipStatus).toBe("want_to_buy");
    expect(reentered.body.purchaseInfo).toBeNull();
  });
});

describe("POST /api/books/:id/ownership/remove-from-wishlist", () => {
  it("removes a want-to-buy book from the wishlist and keeps its store links", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      title: "Dune",
    });
    await addStoreLink(accessToken, created.body.id, {
      currency: "UAH",
      price: 299.99,
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "remove-from-wishlist");

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("none");

    const links = await listStoreLinks(accessToken, created.body.id);

    expect(links.status).toBe(200);
    expect(links.body.storeLinks).toHaveLength(1);
    expect(links.body.storeLinks[0]).toMatchObject({
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });
  });

  it("returns 409 with a NOT_IN_WISHLIST code when the book is not in the wishlist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "remove-from-wishlist");

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("NOT_IN_WISHLIST");
  });

  it("returns 404 when the book belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      title: "Dune",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await ownershipAction(
      stranger.accessToken,
      created.body.id,
      "remove-from-wishlist",
    );

    expect(res.status).toBe(404);
  });
});

describe("POST /api/books/:id/ownership/want-to-buy", () => {
  it("marks a book as want to buy with an empty body and no purchase row", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "want-to-buy", {});

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("want_to_buy");
    expect(res.body.purchaseInfo).toBeNull();
  });

  it("tracks the given store as a link and leaves purchase info empty", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "want-to-buy", {
      storeLink: {
        currency: "UAH",
        price: 299.99,
        storeName: "Yakaboo",
        url: "https://yakaboo.ua/dune",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("want_to_buy");
    expect(res.body.purchaseInfo).toBeNull();

    const links = await listStoreLinks(accessToken, created.body.id);
    expect(links.body.storeLinks).toHaveLength(1);
    expect(links.body.storeLinks[0]).toMatchObject({
      currency: "UAH",
      price: 299.99,
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });
  });

  it("refreshes the price instead of failing when the url is already tracked", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    await addStoreLink(accessToken, created.body.id, {
      price: 500,
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "want-to-buy", {
      storeLink: { price: 299.99, storeName: "Yakaboo", url: "https://yakaboo.ua/dune" },
    });

    expect(res.status).toBe(200);

    const links = await listStoreLinks(accessToken, created.body.id);
    expect(links.body.storeLinks).toHaveLength(1);
    expect(links.body.storeLinks[0].price).toBe(299.99);
  });

  it("returns 409 when the book is not in the none ownership state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "want-to-buy", {});

    expect(res.status).toBe(409);
  });

  it("returns 400 for a negative expected price", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "want-to-buy", {
      storeLink: { price: -1, storeName: "Yakaboo", url: "https://yakaboo.ua/dune" },
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "storeLink.price" })]),
    );
  });

  it("accepts a zero expected price", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "want-to-buy", {
      storeLink: { price: 0, storeName: "Yakaboo", url: "https://yakaboo.ua/dune" },
    });

    expect(res.status).toBe(200);

    const links = await listStoreLinks(accessToken, created.body.id);
    expect(links.body.storeLinks[0].price).toBe(0);
  });
});

describe("POST /api/books/:id/ownership/mark-bought", () => {
  it("marks a want-to-buy book as owned, stamps the purchase date, and retains purchase fields", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      purchaseInfo: { currency: "UAH", expectedPrice: 299.99, storeName: "Yakaboo" },
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "mark-bought", {});

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("owned");
    expect(res.body.purchaseInfo).toMatchObject({
      currency: "UAH",
      expectedPrice: 299.99,
      purchasedAt: TODAY,
      storeName: "Yakaboo",
    });
  });

  it("overrides store, price, and currency from the body and stamps the given past date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      purchaseInfo: {
        currency: "UAH",
        expectedPrice: 299.99,
        note: "wishlist",
        storeName: "Yakaboo",
        storeUrl: "https://yakaboo.ua",
      },
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "mark-bought", {
      currency: "EUR",
      expectedPrice: 180.5,
      purchasedAt: PAST_PURCHASE_DATE,
      storeName: "Book Depository",
    });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("owned");
    expect(res.body.purchaseInfo).toEqual({
      currency: "EUR",
      expectedPrice: 180.5,
      note: "wishlist",
      purchasedAt: PAST_PURCHASE_DATE,
      storeName: "Book Depository",
      storeUrl: "https://yakaboo.ua",
    });
  });

  it("keeps the planned note and store url untouched when the body omits them", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      purchaseInfo: {
        currency: "UAH",
        expectedPrice: 299.99,
        note: "wishlist",
        storeName: "Yakaboo",
        storeUrl: "https://yakaboo.ua",
      },
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "mark-bought", {});

    expect(res.status).toBe(200);
    expect(res.body.purchaseInfo).toEqual({
      currency: "UAH",
      expectedPrice: 299.99,
      note: "wishlist",
      purchasedAt: TODAY,
      storeName: "Yakaboo",
      storeUrl: "https://yakaboo.ua",
    });
  });

  it("creates a purchase row with only the purchase date when the book had none", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "mark-bought", {});

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("owned");
    expect(res.body.purchaseInfo).toEqual({
      currency: null,
      expectedPrice: null,
      note: null,
      purchasedAt: TODAY,
      storeName: null,
      storeUrl: null,
    });
  });

  it("returns 400 with errorsMessages for a future purchase date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "mark-bought", {
      purchasedAt: FUTURE_PURCHASE_DATE,
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "purchasedAt" })]),
    );
  });

  it("returns 409 when the book is not in the want-to-buy state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await ownershipAction(accessToken, created.body.id, "mark-bought", {});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("NOT_IN_WISHLIST");
  });
});
