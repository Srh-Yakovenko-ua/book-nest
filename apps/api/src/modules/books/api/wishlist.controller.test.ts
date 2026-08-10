import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

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

type WishlistBook = { bestOffer: unknown; id: string; storeLinks: unknown[]; title: string };

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

function bookByTitle(books: WishlistBook[], title: string): WishlistBook {
  const found = books.find((book) => book.title === title);
  if (found === undefined) {
    throw new Error(`wishlist book not found: ${title}`);
  }
  return found;
}

async function createBook(accessToken: string, body: Record<string, unknown>): Promise<string> {
  const created = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ authors: [{ name: "Frank Herbert" }], ...body });
  return created.body.id;
}

function getWishlist(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/books/wishlist")
    .set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/books/wishlist", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/books/wishlist");

    expect(res.status).toBe(401);
  });

  it("resolves the static wishlist route instead of the :id handler", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getWishlist(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      books: [],
      summary: {
        booksCount: 0,
        counts: {
          addedLast30Days: 0,
          missingFromSeries: { booksCount: 0, seriesCount: 0 },
          nextInSeries: { booksCount: 0, seriesCount: 0 },
          waitingOverSixMonths: 0,
        },
        estimates: [],
        trackedStoresCount: 0,
      },
    });
  });

  it("returns only want_to_buy books enriched with store links, best offers and a summary", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const dune = await createBook(accessToken, { ownershipStatus: "want_to_buy", title: "Dune" });
    await addStoreLink(accessToken, dune, {
      currency: "UAH",
      price: 349,
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
    });
    await addStoreLink(accessToken, dune, {
      currency: "UAH",
      price: 199.5,
      storeName: "Book24",
      url: "https://book24.ua/dune",
    });

    const solaris = await createBook(accessToken, {
      ownershipStatus: "want_to_buy",
      title: "Solaris",
    });
    await addStoreLink(accessToken, solaris, {
      currency: "UAH",
      price: 250.5,
      storeName: "Bookzone",
      url: "https://bookzone.ua/solaris",
    });

    const neuromancer = await createBook(accessToken, {
      ownershipStatus: "want_to_buy",
      title: "Neuromancer",
    });
    await addStoreLink(accessToken, neuromancer, {
      currency: "USD",
      price: 19.99,
      storeName: "Amazon",
      url: "https://amazon.com/neuromancer",
    });

    await createBook(accessToken, { ownershipStatus: "want_to_buy", title: "Foundation" });
    await createBook(accessToken, { ownershipStatus: "owned", title: "Hyperion" });

    const res = await getWishlist(accessToken);

    expect(res.status).toBe(200);
    const books: WishlistBook[] = res.body.books;
    expect(books.map((book) => book.title).sort()).toEqual([
      "Dune",
      "Foundation",
      "Neuromancer",
      "Solaris",
    ]);

    const duneView = bookByTitle(books, "Dune");
    expect(duneView.storeLinks).toHaveLength(2);
    expect(duneView.bestOffer).toEqual({ currency: "UAH", price: 199.5 });
    expect(bookByTitle(books, "Neuromancer").bestOffer).toEqual({ currency: "USD", price: 19.99 });
    expect(bookByTitle(books, "Foundation").bestOffer).toBeNull();
    expect(bookByTitle(books, "Foundation").storeLinks).toEqual([]);

    expect(res.body.summary).toEqual({
      booksCount: 4,
      counts: {
        addedLast30Days: 4,
        missingFromSeries: { booksCount: 0, seriesCount: 0 },
        nextInSeries: { booksCount: 0, seriesCount: 0 },
        waitingOverSixMonths: 0,
      },
      estimates: [
        { average: 225, best: 199.5, booksCount: 2, currency: "UAH", total: 450 },
        { average: 19.99, best: 19.99, booksCount: 1, currency: "USD", total: 19.99 },
      ],
      trackedStoresCount: 4,
    });
  });

  it("never leaks wishlist books that belong to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    await createBook(owner.accessToken, { ownershipStatus: "want_to_buy", title: "Owner Book" });

    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await createBook(stranger.accessToken, {
      ownershipStatus: "want_to_buy",
      title: "Stranger Book",
    });

    const res = await getWishlist(owner.accessToken);

    expect(res.status).toBe(200);
    const titles = res.body.books.map((book: WishlistBook) => book.title);
    expect(titles).toEqual(["Owner Book"]);
  });
});
