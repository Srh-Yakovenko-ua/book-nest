import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { DeliveryModule } from "../../delivery/delivery.module.js";
import { GenresModule } from "../../genres/genres.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { LoansModule } from "../../loans/loans.module.js";
import { PublishersModule } from "../../publishers/publishers.module.js";
import { QuotesModule } from "../../quotes/quotes.module.js";
import { ReadingQueueModule } from "../../reading-queue/reading-queue.module.js";
import { SeriesModule } from "../../series/series.module.js";
import { TagsModule } from "../../tags/tags.module.js";
import { BooksModule } from "../books.module.js";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([
    AuthModule,
    BooksModule,
    SeriesModule,
    QuotesModule,
    ListsModule,
    TagsModule,
    GenresModule,
    PublishersModule,
    ReadingQueueModule,
    DeliveryModule,
    LoansModule,
  ]);
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

async function createBook(token: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    tags: ["classic"],
    title: "Dune",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createGenre(token: string): Promise<string> {
  const res = await authed("post", "/api/genres", token).send({ name: "Space opera" });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.key;
}

describe("a trashed book disappears from every derived surface", () => {
  it("drops out of the reading queue and its summary", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { addToReadingQueue: true });

    const queued = await authed("get", "/api/reading-queue", accessToken);
    expect(queued.body.items).toHaveLength(1);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);

    const afterDelete = await authed("get", "/api/reading-queue", accessToken);
    expect(afterDelete.body.items).toEqual([]);

    await authed("post", `/api/books/${bookId}/restore`, accessToken).expect(HttpStatus.CREATED);

    const afterRestore = await authed("get", "/api/reading-queue", accessToken);
    expect(afterRestore.body.items).toHaveLength(1);
  });

  it("stops counting towards genre and tag statistics", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const genreKey = await createGenre(accessToken);
    const bookId = await createBook(accessToken, { genres: [genreKey] });

    const genresBefore = await authed("get", "/api/genres/stats", accessToken);
    expect(genresBefore.body.length).toBeGreaterThan(0);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);

    const genresAfter = await authed("get", "/api/genres/stats", accessToken);
    expect(genresAfter.body.every((genre: { booksCount: number }) => genre.booksCount === 0)).toBe(
      true,
    );

    const tagsAfter = await authed("get", "/api/tags/stats", accessToken);
    expect(tagsAfter.body.every((tag: { booksCount: number }) => tag.booksCount === 0)).toBe(true);
  });

  it("stops counting towards the publishers summary", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { publisherName: "Penguin" });

    const before = await authed("get", "/api/publishers/library/summary", accessToken);
    expect(before.body.booksWithPublisherCount).toBe(1);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);

    const after = await authed("get", "/api/publishers/library/summary", accessToken);
    expect(after.body.booksWithPublisherCount).toBe(0);
  });

  it("leaves the custom list it belonged to and comes back on restore", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const list = await authed("post", "/api/lists", accessToken).send({ name: "Summer" });
    expect(list.status).toBe(HttpStatus.CREATED);
    const bookId = await createBook(accessToken, { listIds: [list.body.id] });

    const before = await authed("get", `/api/lists/${list.body.id}`, accessToken);
    expect(before.body.books.totalCount).toBe(1);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);

    const after = await authed("get", `/api/lists/${list.body.id}`, accessToken);
    expect(after.body.books.totalCount).toBe(0);
    expect(after.body.bookCount).toBe(0);

    await authed("post", `/api/books/${bookId}/restore`, accessToken).expect(HttpStatus.CREATED);

    const restored = await authed("get", `/api/lists/${list.body.id}`, accessToken);
    expect(restored.body.books.totalCount).toBe(1);
  });

  it("disappears from the quotes archive and its summary", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const quote = await authed("post", `/api/books/${bookId}/quotes`, accessToken).send({
      text: "Fear is the mind-killer",
    });
    expect(quote.status).toBe(HttpStatus.CREATED);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);

    const archive = await authed("get", "/api/quotes", accessToken);
    expect(archive.body.totalCount).toBe(0);

    const summary = await authed("get", "/api/quotes/summary", accessToken);
    expect(summary.body.totalCount).toBe(0);
    expect(summary.body.topBook).toBeNull();
  });
});
