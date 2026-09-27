import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
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

function genreCountsOf(items: { booksCount: number; key: string }[]): Record<string, number> {
  return Object.fromEntries(items.map((genre) => [genre.key, genre.booksCount]));
}

async function seedSystemGenre({ key, name }: { key: string; name: string }): Promise<string> {
  const genre = await app.get(PrismaService).genre.create({
    data: {
      groupKey: "fiction",
      groupName: "Fiction",
      isDefault: true,
      key,
      name,
      normalizedName: name.toLowerCase(),
      userId: null,
    },
    select: { key: true },
  });
  return genre.key;
}

describe("a trashed book disappears from every derived surface", () => {
  it("leaves the reading queue on delete and comes back outside it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { addToReadingQueue: true });

    const queued = await authed("get", "/api/reading-queue", accessToken);
    expect(queued.body.items).toHaveLength(1);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);

    const afterDelete = await authed("get", "/api/reading-queue", accessToken);
    expect(afterDelete.body.items).toEqual([]);

    await authed("post", `/api/books/${bookId}/restore`, accessToken).expect(HttpStatus.CREATED);

    const afterRestore = await authed("get", "/api/reading-queue", accessToken);
    expect(afterRestore.body.items).toEqual([]);

    const book = await authed("get", `/api/books/${bookId}`, accessToken);
    expect(book.body.isInReadingQueue).toBe(false);
  });

  it("closes its queue slot so the remaining books stay densely numbered", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, { addToReadingQueue: true, title: "First" });
    await createBook(accessToken, { addToReadingQueue: true, title: "Second" });
    await createBook(accessToken, { addToReadingQueue: true, title: "Third" });

    await authed("delete", `/api/books/${first}`, accessToken).expect(HttpStatus.OK);

    const queue = await authed("get", "/api/reading-queue", accessToken);
    expect(queue.body.items.map((item: { position: number }) => item.position)).toEqual([1, 2]);
  });

  it("stops counting towards genre and tag statistics", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const trashedGenreKey = await seedSystemGenre({ key: "space-opera", name: "Space opera" });
    const liveGenreKey = await seedSystemGenre({ key: "cozy-mystery", name: "Cozy mystery" });
    const bookId = await createBook(accessToken, { genres: [trashedGenreKey, liveGenreKey] });
    await createBook(accessToken, { genres: [liveGenreKey], tags: [], title: "Live" });

    const genresBefore = await authed("get", "/api/genres/stats", accessToken);
    expect(genreCountsOf(genresBefore.body.items)).toEqual({
      [liveGenreKey]: 2,
      [trashedGenreKey]: 1,
    });

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);

    const genresAfter = await authed("get", "/api/genres/stats", accessToken);
    expect(genresAfter.body.totalCount).toBe(1);
    expect(genreCountsOf(genresAfter.body.items)).toEqual({ [liveGenreKey]: 1 });

    const tagsAfter = await authed("get", "/api/tags/catalog", accessToken);
    expect(
      tagsAfter.body.items.map((tag: { booksCount: number; name: string }) => ({
        booksCount: tag.booksCount,
        name: tag.name,
      })),
    ).toEqual([{ booksCount: 0, name: "classic" }]);
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
