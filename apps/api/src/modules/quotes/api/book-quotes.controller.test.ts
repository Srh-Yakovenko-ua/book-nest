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

function addQuote(
  accessToken: string,
  bookId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${bookId}/quotes`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
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

function deleteQuote(accessToken: string, bookId: string, quoteId: string): request.Test {
  return request(app.getHttpServer())
    .delete(`/api/books/${bookId}/quotes/${quoteId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getBook(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${bookId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function listBookQuotes(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${bookId}/quotes`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function patchQuote(
  accessToken: string,
  bookId: string,
  quoteId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/books/${bookId}/quotes/${quoteId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("POST /api/books/:bookId/quotes", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/books/00000000-0000-4000-8000-000000000000/quotes")
      .send({ text: "hi" });

    expect(res.status).toBe(401);
  });

  it("creates a quote and returns it with a book preview", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const res = await addQuote(accessToken, bookId, {
      chapter: "Chapter III",
      comment: "unforgettable",
      isFavorite: true,
      isSpoiler: true,
      page: 42,
      text: "Fear is the mind-killer",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      book: { cover: null, firstAuthorName: "Frank Herbert", id: bookId, title: "Dune" },
      bookId,
      chapter: "Chapter III",
      comment: "unforgettable",
      isFavorite: true,
      isSpoiler: true,
      page: 42,
      text: "Fear is the mind-killer",
    });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("trims the text and rejects blank text", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const empty = await addQuote(accessToken, bookId, { text: "   " });
    const missing = await addQuote(accessToken, bookId, {});

    expect(empty.status).toBe(400);
    expect(missing.status).toBe(400);
  });

  it("rejects a non-positive or fractional page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const zero = await addQuote(accessToken, bookId, { page: 0, text: "x" });
    const negative = await addQuote(accessToken, bookId, { page: -5, text: "x" });
    const fractional = await addQuote(accessToken, bookId, { page: 2.5, text: "x" });

    expect(zero.status).toBe(400);
    expect(negative.status).toBe(400);
    expect(fractional.status).toBe(400);
  });

  it("rejects a page greater than the book's page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 100 });

    const res = await addQuote(accessToken, bookId, { page: 200, text: "x" });

    expect(res.status).toBe(400);
  });

  it("returns 404 when the book is not found", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await addQuote(accessToken, "00000000-0000-4000-8000-000000000000", { text: "x" });

    expect(res.status).toBe(404);
  });

  it("does not let a user attach a quote to another user's book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await addQuote(stranger.accessToken, bookId, { text: "sneaky" });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/books/:bookId/quotes", () => {
  it("lists the book's quotes newest first with summary counts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addQuote(accessToken, bookId, { isFavorite: true, text: "first" });
    await addQuote(accessToken, bookId, { isSpoiler: true, text: "second" });
    await addQuote(accessToken, bookId, { comment: "note", text: "third" });

    const res = await listBookQuotes(accessToken, bookId);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(3);
    expect(res.body.favoritesCount).toBe(1);
    expect(res.body.spoilerCount).toBe(1);
    expect(res.body.items.map((item: { text: string }) => item.text)).toEqual([
      "third",
      "second",
      "first",
    ]);
  });

  it("returns 404 for another user's book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await listBookQuotes(stranger.accessToken, bookId);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/books/:bookId/quotes/:quoteId", () => {
  it("edits the text, spoiler and favorite flags", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await addQuote(accessToken, bookId, { text: "before" });

    const res = await patchQuote(accessToken, bookId, created.body.id, {
      isFavorite: true,
      isSpoiler: true,
      text: "after",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isFavorite: true, isSpoiler: true, text: "after" });
  });

  it("updates only isFavorite and leaves the other fields intact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 500 });
    const created = await addQuote(accessToken, bookId, {
      chapter: "Chapter I",
      comment: "a note",
      isSpoiler: true,
      page: 12,
      text: "original",
    });

    const res = await patchQuote(accessToken, bookId, created.body.id, { isFavorite: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      chapter: "Chapter I",
      comment: "a note",
      isFavorite: true,
      isSpoiler: true,
      page: 12,
      text: "original",
    });
  });

  it("updates only isSpoiler without wiping the other fields", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 500 });
    const created = await addQuote(accessToken, bookId, {
      chapter: "Chapter I",
      comment: "a note",
      isFavorite: true,
      page: 12,
      text: "original",
    });

    const res = await patchQuote(accessToken, bookId, created.body.id, { isSpoiler: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      chapter: "Chapter I",
      comment: "a note",
      isFavorite: true,
      isSpoiler: true,
      page: 12,
      text: "original",
    });
  });

  it("clears only the chapter when it is set to null", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 500 });
    const created = await addQuote(accessToken, bookId, {
      chapter: "Chapter I",
      comment: "a note",
      page: 12,
      text: "original",
    });

    const res = await patchQuote(accessToken, bookId, created.body.id, { chapter: null });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      chapter: null,
      comment: "a note",
      page: 12,
      text: "original",
    });
  });

  it("keeps the quote favorite independent from the book favorite", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await addQuote(accessToken, bookId, { text: "line" });

    await patchQuote(accessToken, bookId, created.body.id, { isFavorite: true, text: "line" });

    const book = await getBook(accessToken, bookId);
    expect(book.body.isFavorite).toBe(false);
  });

  it("returns 404 when editing another user's quote", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    const created = await addQuote(owner.accessToken, bookId, { text: "mine" });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await patchQuote(stranger.accessToken, bookId, created.body.id, { text: "hacked" });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the quote belongs to a different book than the path", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const otherBookId = await createBook(accessToken, { title: "Hyperion" });
    const created = await addQuote(accessToken, bookId, { text: "line" });

    const res = await patchQuote(accessToken, otherBookId, created.body.id, { text: "line" });

    expect(res.status).toBe(404);
  });

  it("rejects a page greater than the book's page count on edit", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 80 });
    const created = await addQuote(accessToken, bookId, { text: "line" });

    const res = await patchQuote(accessToken, bookId, created.body.id, { page: 90, text: "line" });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/books/:bookId/quotes/:quoteId", () => {
  it("deletes the quote and removes it from both the book and global lists", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await addQuote(accessToken, bookId, { text: "temporary" });

    const deleteRes = await deleteQuote(accessToken, bookId, created.body.id);
    expect(deleteRes.status).toBe(204);

    const bookQuotes = await listBookQuotes(accessToken, bookId);
    expect(bookQuotes.body.totalCount).toBe(0);

    const global = await request(app.getHttpServer())
      .get("/api/quotes")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(global.body.totalCount).toBe(0);
  });

  it("returns 404 when deleting another user's quote", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    const created = await addQuote(owner.accessToken, bookId, { text: "mine" });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await deleteQuote(stranger.accessToken, bookId, created.body.id);

    expect(res.status).toBe(404);
  });
});
