import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import { subDays } from "date-fns";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { BookLifecycleService } from "../application/book-lifecycle.service.js";
import type { BookPurgeReconciler } from "../application/book-purge.reconciler.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { StoragePort } from "../../media/domain/storage.port.js";
import { BooksModule } from "../books.module.js";
import { BOOK_PURGE_QUEUE_NAME } from "../domain/book-purge.js";

const addCalls: { data: unknown; name: string; opts: unknown }[] = [];
const removeCalls: string[] = [];

const queueStub = {
  add: (name: string, data: unknown, opts: unknown): Promise<void> => {
    addCalls.push({ data, name, opts });
    return Promise.resolve();
  },
  remove: (jobId: string): Promise<void> => {
    removeCalls.push(jobId);
    return Promise.resolve();
  },
};

const storageStub = {
  delete: (): Promise<void> => Promise.resolve(),
  get: (): Promise<Buffer> => Promise.resolve(Buffer.alloc(0)),
  publicUrl: (key: string): string => `http://test.local/${key}`,
  put: (): Promise<void> => Promise.resolve(),
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let lifecycleService: BookLifecycleService;
let reconciler: BookPurgeReconciler;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule],
    [
      { provide: StoragePort, useValue: storageStub },
      { provide: getQueueToken(BOOK_PURGE_QUEUE_NAME), useValue: queueStub },
    ],
  );
  app = context.app;
  prisma = app.get(PrismaService);
  const lifecycleModule = await import("../application/book-lifecycle.service.js");
  const reconcilerModule = await import("../application/book-purge.reconciler.js");
  lifecycleService = app.get(lifecycleModule.BookLifecycleService);
  reconciler = app.get(reconcilerModule.BookPurgeReconciler);
});

beforeEach(() => {
  context.reset();
  addCalls.length = 0;
  removeCalls.length = 0;
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

async function backdateDeletion(bookId: string, days: number): Promise<void> {
  await prisma.book.update({
    data: { deletedAt: subDays(new Date(), days) },
    where: { id: bookId },
  });
}

async function createBook(token: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function insertMedia(userId: string): Promise<string> {
  const asset = await prisma.mediaAsset.create({
    data: {
      contentType: "image/webp",
      height: 100,
      kind: "cover",
      sizeBytes: 1234,
      storageKey: `media/cover/${randomUUID()}/image.webp`,
      userId,
      width: 100,
    },
  });
  return asset.id;
}

describe("book purge scheduling", () => {
  it("enqueues a delayed purge job when the book is trashed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);

    expect(addCalls).toHaveLength(1);
    expect(addCalls[0]).toMatchObject({
      data: { bookId, userId },
      opts: { delay: TRASH_RETENTION.purgeDelayMs, jobId: bookId },
    });
  });

  it("cancels the queued purge when the book is restored", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);
    removeCalls.length = 0;

    await authed("post", `/api/books/${bookId}/restore`, accessToken).expect(HttpStatus.CREATED);

    expect(removeCalls).toEqual([bookId]);
  });

  it("schedules one purge per book moved to the trash in bulk", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, { title: "First" });
    const second = await createBook(accessToken, { title: "Second" });

    await authed("post", "/api/books/bulk/delete", accessToken)
      .send({ bookIds: [first, second] })
      .expect(HttpStatus.OK);

    expect(addCalls.map((call) => call.data)).toEqual([
      { bookId: first, userId },
      { bookId: second, userId },
    ]);
  });
});

describe("book purge execution", () => {
  it("physically deletes an overdue book and cascades its rows", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, {
      readingProgress: { currentPage: 10 },
      readingStatus: "reading",
    });
    expect(await prisma.bookAuthor.count({ where: { bookId } })).toBe(1);
    expect(await prisma.bookReadingProgress.count({ where: { bookId } })).toBe(1);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(bookId, TRASH_RETENTION.days + 1);

    await lifecycleService.purge({ bookId, userId });

    expect(await prisma.book.findUnique({ where: { id: bookId } })).toBeNull();
    expect(await prisma.bookAuthor.count({ where: { bookId } })).toBe(0);
    expect(await prisma.bookReadingProgress.count({ where: { bookId } })).toBe(0);
  });

  it("keeps a trashed book whose retention window has not elapsed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(bookId, TRASH_RETENTION.days - 1);

    await lifecycleService.purge({ bookId, userId });

    expect(await prisma.book.findUnique({ where: { id: bookId } })).not.toBeNull();
  });

  it("is a no-op for a book that was restored before the purge ran", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);
    await authed("post", `/api/books/${bookId}/restore`, accessToken).expect(HttpStatus.CREATED);

    await lifecycleService.purge({ bookId, userId });

    expect(await prisma.book.findUnique({ where: { id: bookId } })).not.toBeNull();
  });

  it("deletes the orphaned cover but keeps one still used by another book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const orphanedMediaId = await insertMedia(userId);
    const sharedMediaId = await insertMedia(userId);
    const purgedId = await createBook(accessToken, {
      coverMediaId: orphanedMediaId,
      title: "Purged",
    });
    const sharedId = await createBook(accessToken, {
      coverMediaId: sharedMediaId,
      title: "Shared",
    });
    await createBook(accessToken, { coverMediaId: sharedMediaId, title: "Also shared" });

    await authed("delete", `/api/books/${purgedId}`, accessToken).expect(HttpStatus.OK);
    await authed("delete", `/api/books/${sharedId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(purgedId, TRASH_RETENTION.days + 1);
    await backdateDeletion(sharedId, TRASH_RETENTION.days + 1);

    await lifecycleService.purge({ bookId: purgedId, userId });
    await lifecycleService.purge({ bookId: sharedId, userId });

    expect(await prisma.mediaAsset.findUnique({ where: { id: orphanedMediaId } })).toBeNull();
    expect(await prisma.mediaAsset.findUnique({ where: { id: sharedMediaId } })).not.toBeNull();
  });

  it("never purges a book belonging to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    await authed("delete", `/api/books/${bookId}`, owner.accessToken).expect(HttpStatus.OK);
    await backdateDeletion(bookId, TRASH_RETENTION.days + 1);

    await lifecycleService.purge({ bookId, userId: stranger.userId });

    expect(await prisma.book.findUnique({ where: { id: bookId } })).not.toBeNull();
  });
});

describe("book purge reconciler", () => {
  it("sweeps overdue books the delayed job never fired for and leaves fresh ones alone", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const overdueId = await createBook(accessToken, { title: "Overdue" });
    const freshId = await createBook(accessToken, { title: "Fresh" });

    await authed("delete", `/api/books/${overdueId}`, accessToken).expect(HttpStatus.OK);
    await authed("delete", `/api/books/${freshId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(overdueId, TRASH_RETENTION.days + 1);

    await reconciler.sweep();

    expect(await prisma.book.findUnique({ where: { id: overdueId } })).toBeNull();
    expect(await prisma.book.findUnique({ where: { id: freshId } })).not.toBeNull();
  });

  it("leaves active books untouched", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    await reconciler.sweep();

    expect(await prisma.book.findUnique({ where: { id: bookId } })).not.toBeNull();
  });
});
