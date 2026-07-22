import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ReadingQueueModule } from "../reading-queue.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ReadingQueueModule]);
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

async function buildQueueOfFour(
  accessToken: string,
): Promise<{ bookA: string; bookB: string; bookC: string; bookD: string }> {
  const bookA = await createQueuedBook(accessToken, "A");
  const bookB = await createQueuedBook(accessToken, "B");
  const bookC = await createQueuedBook(accessToken, "C");
  const bookD = await createQueuedBook(accessToken, "D");
  return { bookA, bookB, bookC, bookD };
}

function bulkReadingStatus(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .patch("/api/books/bulk/reading-status")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function changeReadingStatus(
  accessToken: string,
  bookId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${bookId}/reading-status`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function createQueuedBook(
  accessToken: string,
  title: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const res = await createBook(accessToken, {
    addToReadingQueue: true,
    authors: [{ name: "Frank Herbert" }],
    pagesCount: 300,
    title,
    ...overrides,
  });
  expect(res.status).toBe(201);
  return res.body.id;
}

function getQueue(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/reading-queue")
    .set("Authorization", `Bearer ${accessToken}`);
}

function positionsByTitle(res: request.Response): Array<[string, number]> {
  const items = res.body.items as Array<{ book: { title: string }; position: number }>;
  return items.map((item) => [item.book.title, item.position]);
}

function statusesInQueue(res: request.Response): string[] {
  const items = res.body.items as Array<{ book: { readingStatus: string } }>;
  return items.map((item) => item.book.readingStatus);
}

function titlesInQueue(res: request.Response): string[] {
  const items = res.body.items as Array<{ book: { title: string } }>;
  return items.map((item) => item.book.title);
}

function updateBook(
  accessToken: string,
  bookId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/books/${bookId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function updateReadingProgress(
  accessToken: string,
  bookId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${bookId}/reading-progress`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("reading-queue invariant — closing a book clears its queue placement", () => {
  it("path 1 — reading-status finished removes the book and resequences the queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookB } = await buildQueueOfFour(accessToken);

    const res = await changeReadingStatus(accessToken, bookB, { status: "finished" });
    expect(res.status).toBe(200);

    const queue = await getQueue(accessToken);
    expect(queue.body.count).toBe(3);
    expect(positionsByTitle(queue)).toEqual([
      ["A", 1],
      ["C", 2],
      ["D", 3],
    ]);
  });

  it("path 1 — reading-status dnf removes the book and resequences the queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookB } = await buildQueueOfFour(accessToken);

    const res = await changeReadingStatus(accessToken, bookB, { status: "dnf" });
    expect(res.status).toBe(200);

    const queue = await getQueue(accessToken);
    expect(queue.body.count).toBe(3);
    expect(positionsByTitle(queue)).toEqual([
      ["A", 1],
      ["C", 2],
      ["D", 3],
    ]);
  });

  it("path 2 — reading-progress markAsFinished removes the book and resequences the queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookB } = await buildQueueOfFour(accessToken);

    const res = await updateReadingProgress(accessToken, bookB, {
      currentPage: 100,
      markAsFinished: true,
    });
    expect(res.status).toBe(200);

    const queue = await getQueue(accessToken);
    expect(queue.body.count).toBe(3);
    expect(positionsByTitle(queue)).toEqual([
      ["A", 1],
      ["C", 2],
      ["D", 3],
    ]);
  });

  it("path 3 — PATCH /api/books/:id readingStatus finished removes the book and resequences", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookB } = await buildQueueOfFour(accessToken);

    const res = await updateBook(accessToken, bookB, { readingStatus: "finished" });
    expect(res.status).toBe(200);

    const queue = await getQueue(accessToken);
    expect(queue.body.count).toBe(3);
    expect(positionsByTitle(queue)).toEqual([
      ["A", 1],
      ["C", 2],
      ["D", 3],
    ]);
  });

  it("path 4 — bulk reading-status finished on scattered positions leaves a gap-free run", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookB, bookD } = await buildQueueOfFour(accessToken);

    const res = await bulkReadingStatus(accessToken, {
      bookIds: [bookB, bookD],
      readingStatus: "finished",
    });
    expect(res.status).toBe(200);

    const queue = await getQueue(accessToken);
    expect(queue.body.count).toBe(2);
    expect(positionsByTitle(queue)).toEqual([
      ["A", 1],
      ["C", 2],
    ]);
  });

  it("path 5 — a book created finished with addToReadingQueue never enters the queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await buildQueueOfFour(accessToken);

    const res = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      readingStatus: "finished",
      title: "E",
    });
    expect(res.status).toBe(201);
    expect(res.body.isInReadingQueue).toBe(false);

    const queue = await getQueue(accessToken);
    expect(queue.body.count).toBe(4);
    expect(positionsByTitle(queue)).toEqual([
      ["A", 1],
      ["B", 2],
      ["C", 3],
      ["D", 4],
    ]);
  });
});

describe("reading-queue invariant — edge cases", () => {
  it("takes no lock and shifts nothing on a progress update that does not close the book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createQueuedBook(accessToken, "A");
    const bookB = await createQueuedBook(accessToken, "B", {
      readingProgress: { currentPage: 20 },
      readingStatus: "reading",
    });
    const bookC = await createQueuedBook(accessToken, "C");
    const bookD = await createQueuedBook(accessToken, "D");
    expect([bookA, bookB, bookC, bookD]).toHaveLength(4);

    const res = await updateReadingProgress(accessToken, bookB, { currentPage: 50 });
    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("reading");

    const queue = await getQueue(accessToken);
    expect(queue.body.count).toBe(4);
    expect(positionsByTitle(queue)).toEqual([
      ["A", 1],
      ["B", 2],
      ["C", 3],
      ["D", 4],
    ]);
  });

  it("self-heals a historical closed book that is still stuck in the queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookB, bookD } = await buildQueueOfFour(accessToken);

    await prisma.book.update({ data: { readingStatus: "finished" }, where: { id: bookB } });

    const res = await changeReadingStatus(accessToken, bookD, { status: "finished" });
    expect(res.status).toBe(200);

    const queue = await getQueue(accessToken);
    expect(queue.body.count).toBe(2);
    expect(positionsByTitle(queue)).toEqual([
      ["A", 1],
      ["C", 2],
    ]);
    expect(statusesInQueue(queue)).not.toContain("finished");
  });

  it("is idempotent when an already-closed book is closed again", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookB } = await buildQueueOfFour(accessToken);

    const first = await changeReadingStatus(accessToken, bookB, { status: "finished" });
    expect(first.status).toBe(200);

    const second = await changeReadingStatus(accessToken, bookB, { status: "finished" });
    expect(second.status).toBe(200);

    const queue = await getQueue(accessToken);
    expect(queue.body.count).toBe(3);
    expect(positionsByTitle(queue)).toEqual([
      ["A", 1],
      ["C", 2],
      ["D", 3],
    ]);
  });

  it("nulls all five priority fields when a prioritized book is closed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createQueuedBook(accessToken, "Prioritized", {
      queuePriority: "high",
      queuePriorityReason: "reading_goal",
    });

    const before = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
    expect(before.queuePosition).not.toBeNull();
    expect(before.queuePriority).toBe("high");
    expect(before.queuePriorityReason).toBe("reading_goal");

    const res = await changeReadingStatus(accessToken, bookId, { status: "finished" });
    expect(res.status).toBe(200);

    const after = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
    expect(after.queuePosition).toBeNull();
    expect(after.queuePriority).toBeNull();
    expect(after.queuePriorityReason).toBeNull();
    expect(after.queuePriorityReasonCustomText).toBeNull();
    expect(after.queuePriorityTargetDate).toBeNull();
  });

  it("resequences a queue with deliberate gaps into a gap-free run", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookA, bookB, bookC, bookD } = await buildQueueOfFour(accessToken);

    await prisma.book.update({ data: { queuePosition: 1 }, where: { id: bookA } });
    await prisma.book.update({ data: { queuePosition: 3 }, where: { id: bookB } });
    await prisma.book.update({ data: { queuePosition: 7 }, where: { id: bookC } });

    const res = await changeReadingStatus(accessToken, bookD, { status: "finished" });
    expect(res.status).toBe(200);

    const queue = await getQueue(accessToken);
    expect(queue.body.count).toBe(3);
    expect(positionsByTitle(queue)).toEqual([
      ["A", 1],
      ["B", 2],
      ["C", 3],
    ]);
  });

  it("does not touch another user's queue when closing a book", async () => {
    const userA = await context.registerVerifyAndLogin();
    const userB = await context.registerVerifyAndLogin();

    const booksA = await buildQueueOfFour(userA.accessToken);
    await createQueuedBook(userB.accessToken, "B1");
    await createQueuedBook(userB.accessToken, "B2");
    await createQueuedBook(userB.accessToken, "B3");

    const res = await changeReadingStatus(userA.accessToken, booksA.bookB, { status: "finished" });
    expect(res.status).toBe(200);

    const queueB = await getQueue(userB.accessToken);
    expect(queueB.body.count).toBe(3);
    expect(positionsByTitle(queueB)).toEqual([
      ["B1", 1],
      ["B2", 2],
      ["B3", 3],
    ]);

    const queueA = await getQueue(userA.accessToken);
    expect(queueA.body.count).toBe(3);
    expect(positionsByTitle(queueA)).toEqual([
      ["A", 1],
      ["C", 2],
      ["D", 3],
    ]);
  });

  it("does not return a book to the queue when its status becomes rereading", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookB } = await buildQueueOfFour(accessToken);

    const finish = await changeReadingStatus(accessToken, bookB, { status: "finished" });
    expect(finish.status).toBe(200);

    const reread = await changeReadingStatus(accessToken, bookB, { status: "rereading" });
    expect(reread.status).toBe(200);

    const queue = await getQueue(accessToken);
    expect(queue.body.count).toBe(3);
    expect(titlesInQueue(queue)).not.toContain("B");
    expect(positionsByTitle(queue)).toEqual([
      ["A", 1],
      ["C", 2],
      ["D", 3],
    ]);
  });
});
