import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { NotesModule } from "../../notes/notes.module.js";
import { QuotesModule } from "../../quotes/quotes.module.js";
import { BooksModule } from "../books.module.js";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, NotesModule, QuotesModule]);
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

function authed(
  method: "delete" | "get" | "patch" | "post",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, body: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
    ...body,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createBookNotes(token: string, bookId: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const res = await authed("post", `/api/books/${bookId}/notes`, token).send({
      text: "A strong scene worth remembering",
    });
    expect(res.status).toBe(HttpStatus.CREATED);
  }
}

async function createBookQuote(token: string, bookId: string): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/quotes`, token).send({
    text: "Fear is the mind-killer",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createBookQuotes(token: string, bookId: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    ids.push(await createBookQuote(token, bookId));
  }
  return ids;
}

async function quotesCountOf(token: string, bookId: string): Promise<number> {
  const res = await authed("get", `/api/books/${bookId}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body.quotesCount;
}

async function trashQuote(token: string, bookId: string, quoteId: string): Promise<void> {
  await authed("delete", `/api/books/${bookId}/quotes/${quoteId}`, token).expect(HttpStatus.OK);
}

describe("GET /api/books/:id quotesCount", () => {
  it("returns 0 for a book without quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const res = await authed("get", `/api/books/${bookId}`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({ id: bookId, quotesCount: 0, title: "Dune" });
  });

  it("returns 11 for a book with 11 active quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createBookQuotes(accessToken, bookId, 11);

    expect(await quotesCountOf(accessToken, bookId)).toBe(11);
  });

  it("keeps quotesCount and notesCount independent of each other", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createBookQuotes(accessToken, bookId, 11);
    await createBookNotes(accessToken, bookId, 2);

    const res = await authed("get", `/api/books/${bookId}`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({ notesCount: 2, quotesCount: 11 });
  });

  it("counts only the requested book's quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const otherBookId = await createBook(accessToken, { title: "Hyperion" });
    await createBookQuotes(accessToken, bookId, 2);
    await createBookQuotes(accessToken, otherBookId, 3);

    expect(await quotesCountOf(accessToken, bookId)).toBe(2);
  });

  it("does not count soft-deleted quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const trashedId = await createBookQuote(accessToken, bookId);
    const trashedAgainId = await createBookQuote(accessToken, bookId);
    await createBookQuotes(accessToken, bookId, 3);
    await trashQuote(accessToken, bookId, trashedId);
    await trashQuote(accessToken, bookId, trashedAgainId);

    expect(await quotesCountOf(accessToken, bookId)).toBe(3);
  });

  it("counts a trashed quote again once it is restored", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const restoredId = await createBookQuote(accessToken, bookId);
    await createBookQuotes(accessToken, bookId, 2);
    await trashQuote(accessToken, bookId, restoredId);
    await authed("post", `/api/books/${bookId}/quotes/${restoredId}/restore`, accessToken).expect(
      HttpStatus.NO_CONTENT,
    );

    expect(await quotesCountOf(accessToken, bookId)).toBe(3);
  });

  it("does not let another user's quotes on their own book leak into the owner's count", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    await createBookQuote(owner.accessToken, bookId);
    const strangerBookId = await createBook(stranger.accessToken);
    await createBookQuotes(stranger.accessToken, strangerBookId, 3);

    expect(await quotesCountOf(owner.accessToken, bookId)).toBe(1);
  });

  it("rejects another user's attempt to add a quote to the owner's book and keeps the count", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    await createBookQuote(owner.accessToken, bookId);

    const strangerAttempt = await authed(
      "post",
      `/api/books/${bookId}/quotes`,
      stranger.accessToken,
    ).send({ text: "Not my book" });

    expect(strangerAttempt.status).toBe(HttpStatus.NOT_FOUND);
    expect(await quotesCountOf(owner.accessToken, bookId)).toBe(1);
  });

  it("returns 404 without quotesCount when another user requests the owner's book with quotes", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    await createBookQuotes(owner.accessToken, bookId, 2);

    const res = await authed("get", `/api/books/${bookId}`, stranger.accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body).not.toHaveProperty("quotesCount");
  });

  it("returns 404 without quotesCount for a trashed book that still holds quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createBookQuotes(accessToken, bookId, 2);
    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);

    const res = await authed("get", `/api/books/${bookId}`, accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body).not.toHaveProperty("quotesCount");
  });

  it("counts the quotes of a trashed book again once the book is restored", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createBookQuotes(accessToken, bookId, 2);
    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);
    await authed("post", `/api/books/${bookId}/restore`, accessToken).expect(HttpStatus.CREATED);

    expect(await quotesCountOf(accessToken, bookId)).toBe(2);
  });

  it("matches the totalCount of the quotes archive filtered by the same book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const otherBookId = await createBook(accessToken, { title: "Hyperion" });
    const trashedId = await createBookQuote(accessToken, bookId);
    await createBookQuotes(accessToken, bookId, 3);
    await trashQuote(accessToken, bookId, trashedId);
    await createBookQuotes(accessToken, otherBookId, 2);

    const archive = await authed("get", `/api/quotes?book=${bookId}`, accessToken);

    expect(archive.status).toBe(HttpStatus.OK);
    expect(archive.body.totalCount).toBe(3);
    expect(await quotesCountOf(accessToken, bookId)).toBe(archive.body.totalCount);
  });
});

describe("book responses other than GET /api/books/:id carry no quotesCount", () => {
  it("does not add quotesCount to book list items", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createBookQuotes(accessToken, bookId, 2);

    const res = await authed("get", "/api/books", accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ id: bookId });
    expect(res.body.items[0]).not.toHaveProperty("quotesCount");
  });

  it("does not add quotesCount to the POST /api/books response", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("post", "/api/books", accessToken).send({
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body).toMatchObject({ title: "Dune" });
    expect(res.body).not.toHaveProperty("quotesCount");
  });

  it("does not add quotesCount to the PATCH /api/books/:id response of a book with quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createBookQuotes(accessToken, bookId, 2);

    const res = await authed("patch", `/api/books/${bookId}`, accessToken).send({
      title: "Dune Messiah",
    });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({ id: bookId, title: "Dune Messiah" });
    expect(res.body).not.toHaveProperty("quotesCount");
  });

  it("does not add quotesCount to the POST /api/books/:id/restore response of a book with quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createBookQuotes(accessToken, bookId, 2);
    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);

    const res = await authed("post", `/api/books/${bookId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body).toMatchObject({ id: bookId });
    expect(res.body).not.toHaveProperty("quotesCount");
  });
});
