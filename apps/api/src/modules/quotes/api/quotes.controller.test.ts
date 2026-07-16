import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { QuotesModule } from "../quotes.module.js";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, QuotesModule]);
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

async function addQuote(
  accessToken: string,
  bookId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await request(app.getHttpServer())
    .post(`/api/books/${bookId}/quotes`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
  if (res.status !== 201) {
    throw new Error(`quote creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function createBook(
  accessToken: string,
  body: Record<string, unknown> = {},
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ authors: [{ name: "Frank Herbert" }], title: "Dune", ...body });
  if (res.status !== 201) {
    throw new Error(`book creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id;
}

function listQuotes(accessToken: string, queryString = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/quotes${queryString}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function quotesSummary(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/quotes/summary")
    .set("Authorization", `Bearer ${accessToken}`);
}

function texts(body: { items: Array<{ text: string }> }): string[] {
  return body.items.map((item) => item.text);
}

describe("GET /api/quotes authorization", () => {
  it("returns 401 without an Authorization header for the list", async () => {
    const res = await request(app.getHttpServer()).get("/api/quotes");
    expect(res.status).toBe(401);
  });

  it("returns 401 without an Authorization header for the summary", async () => {
    const res = await request(app.getHttpServer()).get("/api/quotes/summary");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/quotes", () => {
  it("returns an empty page when the user has no quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listQuotes(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.totalCount).toBe(0);
  });

  it("lists quotes across books newest first with a book preview", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const dune = await createBook(accessToken);
    const hyperion = await createBook(accessToken, {
      authors: [{ name: "Dan Simmons" }],
      title: "Hyperion",
    });
    await addQuote(accessToken, dune, { text: "older" });
    await addQuote(accessToken, hyperion, { text: "newer" });

    const res = await listQuotes(accessToken);

    expect(texts(res.body)).toEqual(["newer", "older"]);
    expect(res.body.items[0].book).toMatchObject({
      cover: null,
      firstAuthorName: "Dan Simmons",
      title: "Hyperion",
    });
  });

  it("does not expose another user's quotes", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    await addQuote(owner.accessToken, bookId, { text: "secret" });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await listQuotes(stranger.accessToken);

    expect(res.body.items).toEqual([]);
  });

  it("filters by the bookId query param", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const dune = await createBook(accessToken);
    const hyperion = await createBook(accessToken, { title: "Hyperion" });
    await addQuote(accessToken, dune, { text: "from dune" });
    await addQuote(accessToken, hyperion, { text: "from hyperion" });

    const res = await listQuotes(accessToken, `?bookId=${dune}`);

    expect(texts(res.body)).toEqual(["from dune"]);
  });
});

describe("GET /api/quotes filters", () => {
  async function seedMixed(accessToken: string, bookId: string): Promise<void> {
    await addQuote(accessToken, bookId, { isFavorite: true, text: "favorite" });
    await addQuote(accessToken, bookId, { isSpoiler: true, text: "spoiler" });
    await addQuote(accessToken, bookId, { comment: "thoughts", text: "commented" });
    await addQuote(accessToken, bookId, { text: "plain" });
  }

  it("filters favorites, spoilers, non-spoilers and commented quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await seedMixed(accessToken, bookId);

    const favorites = await listQuotes(accessToken, "?filter=favorites");
    const spoilers = await listQuotes(accessToken, "?filter=with_spoiler");
    const noSpoilers = await listQuotes(accessToken, "?filter=no_spoiler");
    const commented = await listQuotes(accessToken, "?filter=with_comment");

    expect(texts(favorites.body)).toEqual(["favorite"]);
    expect(texts(spoilers.body)).toEqual(["spoiler"]);
    expect(texts(noSpoilers.body).sort()).toEqual(["commented", "favorite", "plain"]);
    expect(texts(commented.body)).toEqual(["commented"]);
  });

  it("returns only quotes without a comment for filter=without_comment", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await seedMixed(accessToken, bookId);

    const withoutComment = await listQuotes(accessToken, "?filter=without_comment");

    expect(texts(withoutComment.body).sort()).toEqual(["favorite", "plain", "spoiler"]);
  });
});

describe("GET /api/quotes sorting", () => {
  it("sorts oldest first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addQuote(accessToken, bookId, { text: "one" });
    await addQuote(accessToken, bookId, { text: "two" });

    const res = await listQuotes(accessToken, "?sort=oldest");

    expect(texts(res.body)).toEqual(["one", "two"]);
  });

  it("sorts by page and puts quotes without a page last", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 500 });
    await addQuote(accessToken, bookId, { page: 200, text: "middle" });
    await addQuote(accessToken, bookId, { text: "no page" });
    await addQuote(accessToken, bookId, { page: 30, text: "early" });

    const res = await listQuotes(accessToken, "?sort=page");

    expect(texts(res.body)).toEqual(["early", "middle", "no page"]);
  });

  it("sorts by book title", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const zebra = await createBook(accessToken, { title: "Zebra" });
    const apple = await createBook(accessToken, { title: "Apple" });
    await addQuote(accessToken, zebra, { text: "z" });
    await addQuote(accessToken, apple, { text: "a" });

    const res = await listQuotes(accessToken, "?sort=book_title");

    expect(texts(res.body)).toEqual(["a", "z"]);
  });

  it("sorts by author name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const zed = await createBook(accessToken, { authors: [{ name: "Zed" }], title: "One" });
    const ann = await createBook(accessToken, { authors: [{ name: "Ann" }], title: "Two" });
    await addQuote(accessToken, zed, { text: "z" });
    await addQuote(accessToken, ann, { text: "a" });

    const res = await listQuotes(accessToken, "?sort=book_author");

    expect(texts(res.body)).toEqual(["a", "z"]);
  });

  it("sorts favorites first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addQuote(accessToken, bookId, { text: "plain" });
    await addQuote(accessToken, bookId, { isFavorite: true, text: "favorite" });

    const res = await listQuotes(accessToken, "?sort=favorites_first");

    expect(texts(res.body)).toEqual(["favorite", "plain"]);
  });

  it("sorts spoilers first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addQuote(accessToken, bookId, { text: "plain" });
    await addQuote(accessToken, bookId, { isSpoiler: true, text: "spoiler" });

    const res = await listQuotes(accessToken, "?sort=with_spoiler_first");

    expect(texts(res.body)).toEqual(["spoiler", "plain"]);
  });
});

describe("GET /api/quotes search", () => {
  async function seedSearchable(accessToken: string): Promise<void> {
    const dune = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      originalTitle: "Dune Original",
      title: "Dune",
    });
    const hyperion = await createBook(accessToken, {
      authors: [{ name: "Dan Simmons" }],
      title: "Hyperion",
    });
    await addQuote(accessToken, dune, {
      chapter: "Arrakis",
      comment: "about spice",
      page: 87,
      text: "Fear is the mind-killer",
    });
    await addQuote(accessToken, hyperion, { text: "Shrike stands watch" });
  }

  it("searches by quote text", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchable(accessToken);

    const res = await listQuotes(accessToken, "?q=mind-killer");

    expect(texts(res.body)).toEqual(["Fear is the mind-killer"]);
  });

  it("searches by comment, chapter, book title, author and page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchable(accessToken);

    const byComment = await listQuotes(accessToken, "?q=spice");
    const byChapter = await listQuotes(accessToken, "?q=arrakis");
    const byTitle = await listQuotes(accessToken, "?q=hyperion");
    const byAuthor = await listQuotes(accessToken, "?q=herbert");
    const byPage = await listQuotes(accessToken, "?q=87");

    expect(texts(byComment.body)).toEqual(["Fear is the mind-killer"]);
    expect(texts(byChapter.body)).toEqual(["Fear is the mind-killer"]);
    expect(texts(byTitle.body)).toEqual(["Shrike stands watch"]);
    expect(texts(byAuthor.body)).toEqual(["Fear is the mind-killer"]);
    expect(texts(byPage.body)).toEqual(["Fear is the mind-killer"]);
  });

  it("searches by a co-author who is not the first author", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const collab = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }, { name: "Brian Herbert Jr" }],
      title: "Dune Messiah",
    });
    await addQuote(accessToken, collab, { text: "The past is prologue" });

    const res = await listQuotes(accessToken, "?q=brian");

    expect(res.status).toBe(200);
    expect(texts(res.body)).toEqual(["The past is prologue"]);
  });

  it("does not error on a numeric search larger than any storable page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchable(accessToken);

    const res = await listQuotes(accessToken, "?q=9780441013593");

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.totalCount).toBe(0);
  });
});

describe("GET /api/quotes pagination and validation", () => {
  it("paginates and reports totals", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addQuote(accessToken, bookId, { text: "one" });
    await addQuote(accessToken, bookId, { text: "two" });
    await addQuote(accessToken, bookId, { text: "three" });

    const res = await listQuotes(accessToken, "?pageSize=2&pageNumber=2&sort=oldest");

    expect(res.body.items).toHaveLength(1);
    expect(texts(res.body)).toEqual(["three"]);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(2);
    expect(res.body.pagesCount).toBe(2);
    expect(res.body.totalCount).toBe(3);
  });

  it("rejects invalid filter, sort and oversized page size", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const badFilter = await listQuotes(accessToken, "?filter=bogus");
    const badSort = await listQuotes(accessToken, "?sort=bogus");
    const bigPage = await listQuotes(accessToken, "?pageSize=101");

    expect(badFilter.status).toBe(400);
    expect(badSort.status).toBe(400);
    expect(bigPage.status).toBe(400);
  });
});

describe("GET /api/quotes/summary", () => {
  it("returns zeros when there are no quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await quotesSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      favoritesCount: 0,
      spoilerCount: 0,
      topAuthor: null,
      topBook: null,
      totalCount: 0,
      withCommentCount: 0,
      withoutSpoilerCount: 0,
    });
  });

  it("aggregates counts and the top book and author", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const dune = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const hyperion = await createBook(accessToken, {
      authors: [{ name: "Dan Simmons" }],
      title: "Hyperion",
    });
    await addQuote(accessToken, dune, { isFavorite: true, text: "a" });
    await addQuote(accessToken, dune, { comment: "note", isSpoiler: true, text: "b" });
    await addQuote(accessToken, dune, { text: "c" });
    await addQuote(accessToken, hyperion, { text: "d" });

    const res = await quotesSummary(accessToken);

    expect(res.body).toEqual({
      favoritesCount: 1,
      spoilerCount: 1,
      topAuthor: { name: "Frank Herbert", quotesCount: 3 },
      topBook: { id: dune, quotesCount: 3, title: "Dune" },
      totalCount: 4,
      withCommentCount: 1,
      withoutSpoilerCount: 3,
    });
  });
});
