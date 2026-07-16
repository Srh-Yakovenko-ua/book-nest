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
const MAX_STORE_LINKS = 20;

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

async function createDune(accessToken: string): Promise<string> {
  const created = await createBook(accessToken, {
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "want_to_buy",
    title: "Dune",
  });
  return created.body.id;
}

function editStoreLink(
  accessToken: string,
  bookId: string,
  linkId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/books/${bookId}/store-links/${linkId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function listStoreLinks(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${bookId}/store-links`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function removeStoreLink(accessToken: string, bookId: string, linkId: string): request.Test {
  return request(app.getHttpServer())
    .delete(`/api/books/${bookId}/store-links/${linkId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

describe("POST /api/books/:id/store-links", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).post(`/api/books/${MISSING_UUID}/store-links`);

    expect(res.status).toBe(401);
  });

  it("creates a store link and returns its view", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createDune(accessToken);

    const res = await addStoreLink(accessToken, bookId, {
      currency: "UAH",
      price: 299.99,
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      bookId,
      currency: "UAH",
      price: 299.99,
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });
    expect(typeof res.body.id).toBe("string");
  });

  it("defaults the currency to UAH when only a price is given", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createDune(accessToken);

    const res = await addStoreLink(accessToken, bookId, {
      price: 150,
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.currency).toBe("UAH");
  });

  it("returns 404 for a book that belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createDune(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await addStoreLink(stranger.accessToken, bookId, {
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });

    expect(res.status).toBe(404);
  });

  it("returns 409 when the same URL is added twice", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createDune(accessToken);
    await addStoreLink(accessToken, bookId, {
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });

    const res = await addStoreLink(accessToken, bookId, {
      storeName: "Yakaboo Mirror",
      url: "https://yakaboo.ua/dune",
    });

    expect(res.status).toBe(409);
  });

  it("returns 409 when the per-book link limit is reached", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createDune(accessToken);
    for (let index = 0; index < MAX_STORE_LINKS; index += 1) {
      await addStoreLink(accessToken, bookId, {
        storeName: `Store ${index}`,
        url: `https://store-${index}.example.com/dune`,
      });
    }

    const res = await addStoreLink(accessToken, bookId, {
      storeName: "One too many",
      url: "https://store-overflow.example.com/dune",
    });

    expect(res.status).toBe(409);
  });

  it("returns 400 for a non-https URL", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createDune(accessToken);

    const res = await addStoreLink(accessToken, bookId, {
      storeName: "Yakaboo",
      url: "http://yakaboo.ua/dune",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-positive price", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createDune(accessToken);

    const res = await addStoreLink(accessToken, bookId, {
      price: 0,
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when the store name is missing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createDune(accessToken);

    const res = await addStoreLink(accessToken, bookId, {
      url: "https://yakaboo.ua/dune",
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/books/:id/store-links", () => {
  it("returns the store links with the derived best offer", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createDune(accessToken);
    await addStoreLink(accessToken, bookId, {
      currency: "UAH",
      price: 349,
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });
    await addStoreLink(accessToken, bookId, {
      currency: "UAH",
      price: 199.5,
      storeName: "Book24",
      url: "https://book24.ua/dune",
    });
    await addStoreLink(accessToken, bookId, {
      storeName: "No price",
      url: "https://nostore.example.com/dune",
    });

    const res = await listStoreLinks(accessToken, bookId);

    expect(res.status).toBe(200);
    expect(res.body.storeLinks).toHaveLength(3);
    expect(res.body.bestOffer).toEqual({ currency: "UAH", price: 199.5 });
  });

  it("returns an empty list and a null best offer for a book with no links", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createDune(accessToken);

    const res = await listStoreLinks(accessToken, bookId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bestOffer: null, storeLinks: [] });
  });

  it("returns 404 for a book that belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createDune(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await listStoreLinks(stranger.accessToken, bookId);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/books/:id/store-links/:linkId", () => {
  it("edits an existing store link", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createDune(accessToken);
    const created = await addStoreLink(accessToken, bookId, {
      currency: "UAH",
      price: 299.99,
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });

    const res = await editStoreLink(accessToken, bookId, created.body.id, {
      currency: "EUR",
      price: 12.5,
      storeName: "Book Depository",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      currency: "EUR",
      price: 12.5,
      storeName: "Book Depository",
      url: "https://yakaboo.ua/dune",
    });
  });

  it("returns 404 for a store link that belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createDune(owner.accessToken);
    const created = await addStoreLink(owner.accessToken, bookId, {
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await editStoreLink(stranger.accessToken, bookId, created.body.id, {
      storeName: "Hijacked",
    });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/books/:id/store-links/:linkId", () => {
  it("removes a store link and returns 204", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createDune(accessToken);
    const created = await addStoreLink(accessToken, bookId, {
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });

    const res = await removeStoreLink(accessToken, bookId, created.body.id);

    expect(res.status).toBe(204);

    const after = await listStoreLinks(accessToken, bookId);
    expect(after.body.storeLinks).toHaveLength(0);
  });

  it("returns 404 for a store link that belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createDune(owner.accessToken);
    const created = await addStoreLink(owner.accessToken, bookId, {
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await removeStoreLink(stranger.accessToken, bookId, created.body.id);

    expect(res.status).toBe(404);

    const after = await listStoreLinks(owner.accessToken, bookId);
    expect(after.body.storeLinks).toHaveLength(1);
  });
});
