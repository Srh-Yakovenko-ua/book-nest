import type { INestApplication } from "@nestjs/common";

import { subDays } from "date-fns";
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

const NONEXISTENT_BOOK_ID = "33333333-3333-4333-8333-333333333333";

function addToQueue(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/reading-queue")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function buildQueueABCD(
  accessToken: string,
): Promise<{ bookA: string; bookB: string; bookC: string; bookD: string }> {
  const bookA = await createOwnedBook(accessToken, { title: "A" });
  const bookB = await createOwnedBook(accessToken, { title: "B" });
  const bookC = await createOwnedBook(accessToken, { title: "C" });
  const bookD = await createOwnedBook(accessToken, { title: "D" });
  for (const bookId of [bookA, bookB, bookC, bookD]) {
    expect((await addToQueue(accessToken, { bookId, placement: "end" })).status).toBe(200);
  }
  return { bookA, bookB, bookC, bookD };
}

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function createOwnedBook(
  accessToken: string,
  overrides: Record<string, unknown>,
): Promise<string> {
  const res = await createBook(accessToken, {
    authors: [{ name: "Frank Herbert" }],
    title: "Book",
    ...overrides,
  });
  expect(res.status).toBe(201);
  return res.body.id;
}

function getBook(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${bookId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getQueue(accessToken: string, query = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/reading-queue${query}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getSummary(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/reading-queue/summary")
    .set("Authorization", `Bearer ${accessToken}`);
}

function getVolumeSummary(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/reading-queue/volume-summary")
    .set("Authorization", `Bearer ${accessToken}`);
}

function positionsByTitle(res: request.Response): Array<[string, number]> {
  const items = res.body.items as Array<{ book: { title: string }; position: number }>;
  return items.map((item) => [item.book.title, item.position]);
}

function removeFromQueue(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .delete(`/api/reading-queue/${bookId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function reorder(accessToken: string, order: string[]): request.Test {
  return request(app.getHttpServer())
    .put("/api/reading-queue/reorder")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ order });
}

function seedReadingEvent(input: {
  bookId: string;
  date: Date;
  pagesRead: number;
}): Promise<unknown> {
  return prisma.bookReadingProgressEvent.create({
    data: {
      bookId: input.bookId,
      date: input.date,
      page: input.pagesRead,
      pagesRead: input.pagesRead,
    },
  });
}

async function seedSummaryQueue(accessToken: string): Promise<void> {
  for (const ownershipStatus of ["owned", "none", "want_to_buy"] as const) {
    const res = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus,
      title: `Standalone ${ownershipStatus}`,
    });
    expect(res.status).toBe(201);
  }

  const partOne = await createBook(accessToken, {
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    newSeries: { name: "Dune" },
    ownershipStatus: "owned",
    partNumber: 1,
    readingStatus: "not_started",
    title: "Dune",
  });
  expect(partOne.status).toBe(201);
  const seriesId = partOne.body.series.id;

  for (const partNumber of [2, 3]) {
    const res = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      bookType: "series_part",
      ownershipStatus: "owned",
      partNumber,
      readingStatus: "not_started",
      seriesId,
      title: `Dune ${partNumber}`,
    });
    expect(res.status).toBe(201);
  }
}

function startReading(
  accessToken: string,
  bookId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/reading-queue/${bookId}/start-reading`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
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

describe("GET /api/reading-queue filters", () => {
  async function seedQueue(accessToken: string) {
    await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 100,
      publicationYear: 1965,
      title: "Dune",
    });
    await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Ursula Le Guin" }],
      pagesCount: 300,
      publicationYear: 1969,
      title: "The Left Hand of Darkness",
    });
  }

  it("narrows the queue by search while reporting the untouched total", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedQueue(accessToken);

    const res = await getQueue(accessToken, "?q=Dune");

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.items.map((item: { book: { title: string } }) => item.book.title)).toEqual([
      "Dune",
    ]);
  });

  it("keeps the manual queue order inside a filtered result", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedQueue(accessToken);

    const res = await getQueue(accessToken, "?pagesMin=50");

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { position: number }) => item.position)).toEqual([1, 2]);
  });

  it("filters the queue by publication year range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedQueue(accessToken);

    const res = await getQueue(accessToken, "?yearMin=1966&yearMax=1970");

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].book.title).toBe("The Left Hand of Darkness");
  });

  it("filters the queue by reading status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedQueue(accessToken);

    const res = await getQueue(accessToken, "?status=not_started");

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.totalCount).toBe(2);
  });

  it("returns nothing when a filter matches no queued book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedQueue(accessToken);

    const res = await getQueue(accessToken, "?pagesMin=5000");

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.count).toBe(0);
    expect(res.body.totalCount).toBe(2);
  });

  it("rejects an inverted range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getQueue(accessToken, "?pagesMin=500&pagesMax=100");

    expect(res.status).toBe(400);
  });

  it("rejects an unknown filter value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getQueue(accessToken, "?status=not_a_status");

    expect(res.status).toBe(400);
  });
});

describe("GET /api/reading-queue", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/reading-queue");

    expect(res.status).toBe(401);
  });

  it("returns an empty queue for an authenticated user with no queued books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getQueue(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0, items: [], totalCount: 0, totalPagesCount: 0 });
  });

  it("returns only the queued books ordered by ascending position with count and total pages", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 100,
      title: "Dune",
    });
    await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 250,
      title: "Dune Messiah",
    });
    await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 50,
      title: "Children of Dune",
    });
    await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 999,
      title: "God Emperor of Dune",
    });

    const res = await getQueue(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(res.body.totalPagesCount).toBe(400);
    expect(res.body.items.map((item: { position: number }) => item.position)).toEqual([1, 2, 3]);
    expect(res.body.items.map((item: { book: { title: string } }) => item.book.title)).toEqual([
      "Dune",
      "Dune Messiah",
      "Children of Dune",
    ]);
  });

  it("does not expose another user's queued book in the caller's queue", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await createBook(stranger.accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Isaac Asimov" }],
      pagesCount: 300,
      title: "Foundation",
    });
    await createBook(owner.accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 100,
      title: "Dune",
    });

    const res = await getQueue(owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Dune");
  });
});

describe("POST /api/reading-queue", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/reading-queue")
      .send({ bookId: NONEXISTENT_BOOK_ID, placement: "end" });

    expect(res.status).toBe(401);
  });

  it("returns 400 with a bookId error when the bookId is not a uuid", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await addToQueue(accessToken, { bookId: "not-a-uuid", placement: "end" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "bookId" })]),
    );
  });

  it("returns 400 with a position error when specific placement omits the position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await addToQueue(accessToken, {
      bookId: NONEXISTENT_BOOK_ID,
      placement: "specific",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "position" })]),
    );
  });

  it("returns 404 when the book does not exist in the user library", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await addToQueue(accessToken, { bookId: NONEXISTENT_BOOK_ID, placement: "end" });

    expect(res.status).toBe(404);
  });

  it("adds a book at the end and returns the queue with the book at position 1", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createOwnedBook(accessToken, { pagesCount: 100, title: "Dune" });

    const res = await addToQueue(accessToken, { bookId: bookA, placement: "end" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ count: 1, totalPagesCount: 100 });
    expect(positionsByTitle(res)).toEqual([["Dune", 1]]);
  });

  it("returns 409 when the book is already in the queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createOwnedBook(accessToken, { title: "Dune" });
    const first = await addToQueue(accessToken, { bookId: bookA, placement: "end" });
    expect(first.status).toBe(200);

    const res = await addToQueue(accessToken, { bookId: bookA, placement: "end" });

    expect(res.status).toBe(409);
  });

  it("inserts a book at the start and shifts the existing book down", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createOwnedBook(accessToken, { title: "A" });
    const bookB = await createOwnedBook(accessToken, { title: "B" });
    const addA = await addToQueue(accessToken, { bookId: bookA, placement: "end" });
    expect(addA.status).toBe(200);

    const res = await addToQueue(accessToken, { bookId: bookB, placement: "start" });

    expect(res.status).toBe(200);
    expect(positionsByTitle(res)).toEqual([
      ["B", 1],
      ["A", 2],
    ]);
  });

  it("inserts a book at a specific position and shifts later books down", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createOwnedBook(accessToken, { title: "A" });
    const bookB = await createOwnedBook(accessToken, { title: "B" });
    const bookC = await createOwnedBook(accessToken, { title: "C" });
    const addA = await addToQueue(accessToken, { bookId: bookA, placement: "end" });
    expect(addA.status).toBe(200);
    const addB = await addToQueue(accessToken, { bookId: bookB, placement: "start" });
    expect(addB.status).toBe(200);

    const res = await addToQueue(accessToken, {
      bookId: bookC,
      placement: "specific",
      position: 2,
    });

    expect(res.status).toBe(200);
    expect(positionsByTitle(res)).toEqual([
      ["B", 1],
      ["C", 2],
      ["A", 3],
    ]);
  });

  it("returns 422 and leaves the queue unchanged when a specific position is out of range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createOwnedBook(accessToken, { title: "A" });
    const bookB = await createOwnedBook(accessToken, { title: "B" });
    const bookC = await createOwnedBook(accessToken, { title: "C" });
    const bookD = await createOwnedBook(accessToken, { title: "D" });
    expect((await addToQueue(accessToken, { bookId: bookA, placement: "end" })).status).toBe(200);
    expect((await addToQueue(accessToken, { bookId: bookB, placement: "end" })).status).toBe(200);
    expect((await addToQueue(accessToken, { bookId: bookC, placement: "end" })).status).toBe(200);

    const res = await addToQueue(accessToken, {
      bookId: bookD,
      placement: "specific",
      position: 99,
    });

    expect(res.status).toBe(422);
    const after = await getQueue(accessToken);
    expect(positionsByTitle(after)).toEqual([
      ["A", 1],
      ["B", 2],
      ["C", 3],
    ]);
  });

  it("appends a book at the boundary position of count + 1", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createOwnedBook(accessToken, { title: "A" });
    const bookB = await createOwnedBook(accessToken, { title: "B" });
    const bookC = await createOwnedBook(accessToken, { title: "C" });
    const bookD = await createOwnedBook(accessToken, { title: "D" });
    expect((await addToQueue(accessToken, { bookId: bookA, placement: "end" })).status).toBe(200);
    expect((await addToQueue(accessToken, { bookId: bookB, placement: "end" })).status).toBe(200);
    expect((await addToQueue(accessToken, { bookId: bookC, placement: "end" })).status).toBe(200);

    const res = await addToQueue(accessToken, {
      bookId: bookD,
      placement: "specific",
      position: 4,
    });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(4);
    expect(positionsByTitle(res)).toEqual([
      ["A", 1],
      ["B", 2],
      ["C", 3],
      ["D", 4],
    ]);
  });

  it("returns 404 when adding a book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const ownerBook = await createOwnedBook(owner.accessToken, { title: "Dune" });

    const res = await addToQueue(stranger.accessToken, { bookId: ownerBook, placement: "end" });

    expect(res.status).toBe(404);
  });

  it("keeps each user's queue isolated when both add their own books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const ownerBook = await createOwnedBook(owner.accessToken, { pagesCount: 100, title: "Dune" });
    const strangerBook = await createOwnedBook(stranger.accessToken, {
      pagesCount: 300,
      title: "Foundation",
    });
    expect(
      (await addToQueue(owner.accessToken, { bookId: ownerBook, placement: "end" })).status,
    ).toBe(200);
    expect(
      (await addToQueue(stranger.accessToken, { bookId: strangerBook, placement: "end" })).status,
    ).toBe(200);

    const ownerQueue = await getQueue(owner.accessToken);

    expect(ownerQueue.body.count).toBe(1);
    expect(positionsByTitle(ownerQueue)).toEqual([["Dune", 1]]);
  });
});

describe("DELETE /api/reading-queue/:bookId", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).delete(
      `/api/reading-queue/${NONEXISTENT_BOOK_ID}`,
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when the bookId param is not a uuid", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await removeFromQueue(accessToken, "not-a-uuid");

    expect(res.status).toBe(400);
  });

  it("returns 404 with the not-in-queue message when the owned book is not in the queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createOwnedBook(accessToken, { title: "Dune" });

    const res = await removeFromQueue(accessToken, bookA);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Книга не в черзі читання");
  });

  it("returns 404 when removing a book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const ownerBook = await createOwnedBook(owner.accessToken, { title: "Dune" });
    expect(
      (await addToQueue(owner.accessToken, { bookId: ownerBook, placement: "end" })).status,
    ).toBe(200);

    const res = await removeFromQueue(stranger.accessToken, ownerBook);

    expect(res.status).toBe(404);
  });

  it("does not affect the owner's queue when another user attempts to remove the owner's book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const ownerBook = await createOwnedBook(owner.accessToken, { title: "Dune" });
    expect(
      (await addToQueue(owner.accessToken, { bookId: ownerBook, placement: "end" })).status,
    ).toBe(200);

    await removeFromQueue(stranger.accessToken, ownerBook);

    const ownerQueue = await getQueue(owner.accessToken);
    expect(ownerQueue.body.count).toBe(1);
    expect(positionsByTitle(ownerQueue)).toEqual([["Dune", 1]]);
  });

  it("re-sequences the tail without gaps as books are removed down to an empty queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createOwnedBook(accessToken, { title: "A" });
    const bookB = await createOwnedBook(accessToken, { title: "B" });
    const bookC = await createOwnedBook(accessToken, { title: "C" });
    const bookD = await createOwnedBook(accessToken, { title: "D" });
    for (const bookId of [bookA, bookB, bookC, bookD]) {
      expect((await addToQueue(accessToken, { bookId, placement: "end" })).status).toBe(200);
    }

    const afterB = await removeFromQueue(accessToken, bookB);
    expect(afterB.status).toBe(200);
    expect(afterB.body.count).toBe(3);
    expect(positionsByTitle(afterB)).toEqual([
      ["A", 1],
      ["C", 2],
      ["D", 3],
    ]);

    const afterA = await removeFromQueue(accessToken, bookA);
    expect(afterA.status).toBe(200);
    expect(positionsByTitle(afterA)).toEqual([
      ["C", 1],
      ["D", 2],
    ]);

    expect((await removeFromQueue(accessToken, bookC)).status).toBe(200);
    const afterD = await removeFromQueue(accessToken, bookD);
    expect(afterD.status).toBe(200);
    expect(afterD.body).toEqual({ count: 0, items: [], totalCount: 0, totalPagesCount: 0 });
  });

  it("keeps the book in the library with its reading and ownership statuses after queue removal", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createOwnedBook(accessToken, {
      ownershipStatus: "owned",
      readingStatus: "reading",
      title: "Dune",
    });
    expect((await addToQueue(accessToken, { bookId, placement: "end" })).status).toBe(200);

    const removed = await removeFromQueue(accessToken, bookId);
    expect(removed.status).toBe(200);

    const res = await getBook(accessToken, bookId);
    expect(res.status).toBe(200);
    expect(res.body.isInReadingQueue).toBe(false);
    expect(res.body.readingStatus).toBe("reading");
    expect(res.body.ownershipStatus).toBe("owned");
  });

  it("clears the priority and reason detail fields when a high-priority book is removed from the queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createOwnedBook(accessToken, {
      addToReadingQueue: true,
      queuePriority: "high",
      queuePriorityReason: "book_club",
      queuePriorityTargetDate: "2026-08-24",
      title: "Dune",
    });

    const removed = await removeFromQueue(accessToken, bookId);
    expect(removed.status).toBe(200);

    const res = await getBook(accessToken, bookId);
    expect(res.status).toBe(200);
    expect(res.body.isInReadingQueue).toBe(false);
    expect(res.body.queuePriority).toBeNull();
    expect(res.body.queuePriorityReason).toBeNull();
    expect(res.body.queuePriorityReasonCustomText).toBeNull();
    expect(res.body.queuePriorityTargetDate).toBeNull();
  });

  it("rejects a reason detail patch on a book after it was removed from the queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createOwnedBook(accessToken, {
      addToReadingQueue: true,
      queuePriority: "high",
      queuePriorityReason: "book_club",
      queuePriorityTargetDate: "2026-08-24",
      title: "Dune",
    });
    expect((await removeFromQueue(accessToken, bookId)).status).toBe(200);

    const res = await updateBook(accessToken, bookId, {
      queuePriorityReason: "event_or_deadline",
      queuePriorityTargetDate: "2026-09-01",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "queuePriorityReason" })]),
    );
  });
});

describe("PUT /api/reading-queue/reorder", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .put("/api/reading-queue/reorder")
      .send({ order: [NONEXISTENT_BOOK_ID] });

    expect(res.status).toBe(401);
  });

  it("returns 400 when the order contains a malformed uuid", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await reorder(accessToken, ["not-a-uuid", NONEXISTENT_BOOK_ID]);

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: expect.stringMatching(/^order/) })]),
    );
  });

  it("re-sequences positions to the requested order in the response body", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookA, bookB, bookC, bookD } = await buildQueueABCD(accessToken);

    const res = await reorder(accessToken, [bookD, bookB, bookA, bookC]);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(4);
    expect(positionsByTitle(res)).toEqual([
      ["D", 1],
      ["B", 2],
      ["A", 3],
      ["C", 4],
    ]);
  });

  it("persists the reordered positions for subsequent reads", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookA, bookB, bookC, bookD } = await buildQueueABCD(accessToken);
    expect((await reorder(accessToken, [bookD, bookB, bookA, bookC])).status).toBe(200);

    const after = await getQueue(accessToken);

    expect(positionsByTitle(after)).toEqual([
      ["D", 1],
      ["B", 2],
      ["A", 3],
      ["C", 4],
    ]);
  });

  it("returns 422 and leaves the queue unchanged when the order contains a duplicate id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookA, bookC, bookD } = await buildQueueABCD(accessToken);

    const res = await reorder(accessToken, [bookD, bookD, bookA, bookC]);

    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Некоректний порядок черги");
    const after = await getQueue(accessToken);
    expect(positionsByTitle(after)).toEqual([
      ["A", 1],
      ["B", 2],
      ["C", 3],
      ["D", 4],
    ]);
  });

  it("returns 422 and leaves the queue unchanged when the order omits a queued id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookA, bookB, bookD } = await buildQueueABCD(accessToken);

    const res = await reorder(accessToken, [bookD, bookB, bookA]);

    expect(res.status).toBe(422);
    const after = await getQueue(accessToken);
    expect(positionsByTitle(after)).toEqual([
      ["A", 1],
      ["B", 2],
      ["C", 3],
      ["D", 4],
    ]);
  });

  it("returns 422 and leaves the queue unchanged when the order includes a non-queued uuid", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookA, bookB, bookD } = await buildQueueABCD(accessToken);

    const res = await reorder(accessToken, [bookD, bookB, bookA, NONEXISTENT_BOOK_ID]);

    expect(res.status).toBe(422);
    const after = await getQueue(accessToken);
    expect(positionsByTitle(after)).toEqual([
      ["A", 1],
      ["B", 2],
      ["C", 3],
      ["D", 4],
    ]);
  });

  it("returns 422 and does not affect another user's queue when reordering with their book id", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const ownerQueue = await buildQueueABCD(owner.accessToken);
    const strangerBook = await createOwnedBook(stranger.accessToken, { title: "S" });
    expect(
      (await addToQueue(stranger.accessToken, { bookId: strangerBook, placement: "end" })).status,
    ).toBe(200);

    const res = await reorder(owner.accessToken, [
      ownerQueue.bookD,
      ownerQueue.bookB,
      ownerQueue.bookA,
      strangerBook,
    ]);

    expect(res.status).toBe(422);
    const strangerAfter = await getQueue(stranger.accessToken);
    expect(positionsByTitle(strangerAfter)).toEqual([["S", 1]]);
  });
});

describe("POST /api/reading-queue/:bookId/start-reading", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/reading-queue/${NONEXISTENT_BOOK_ID}/start-reading`)
      .send({ removeFromQueue: true });

    expect(res.status).toBe(401);
  });

  it("returns 400 when the bookId param is not a uuid", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await startReading(accessToken, "not-a-uuid", { removeFromQueue: true });

    expect(res.status).toBe(400);
  });

  it("returns 400 with a removeFromQueue error when the flag is missing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createOwnedBook(accessToken, { title: "Dune" });

    const res = await startReading(accessToken, bookId, {});

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "removeFromQueue" })]),
    );
  });

  it("returns 404 when starting a book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const ownerBook = await createOwnedBook(owner.accessToken, { title: "Dune" });

    const res = await startReading(stranger.accessToken, ownerBook, { removeFromQueue: false });

    expect(res.status).toBe(404);
  });

  it("removes the started book and re-sequences the remaining queue when removeFromQueue is true", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createOwnedBook(accessToken, { title: "A" });
    const bookB = await createOwnedBook(accessToken, { title: "B" });
    expect((await addToQueue(accessToken, { bookId: bookA, placement: "end" })).status).toBe(200);
    expect((await addToQueue(accessToken, { bookId: bookB, placement: "end" })).status).toBe(200);

    const res = await startReading(accessToken, bookA, { removeFromQueue: true });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(positionsByTitle(res)).toEqual([["B", 1]]);
  });

  it("marks the started book as reading and out of the queue in the book view when removeFromQueue is true", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createOwnedBook(accessToken, { title: "A" });
    const bookB = await createOwnedBook(accessToken, { title: "B" });
    expect((await addToQueue(accessToken, { bookId: bookA, placement: "end" })).status).toBe(200);
    expect((await addToQueue(accessToken, { bookId: bookB, placement: "end" })).status).toBe(200);
    expect((await startReading(accessToken, bookA, { removeFromQueue: true })).status).toBe(200);

    const res = await getBook(accessToken, bookA);

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("reading");
    expect(res.body.isInReadingQueue).toBe(false);
  });

  it("keeps the book queued at the same position with a reading status when removeFromQueue is false", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createOwnedBook(accessToken, { title: "Dune" });
    expect((await addToQueue(accessToken, { bookId, placement: "end" })).status).toBe(200);

    const res = await startReading(accessToken, bookId, { removeFromQueue: false });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].position).toBe(1);
    expect(res.body.items[0].book.id).toBe(bookId);
    expect(res.body.items[0].book.readingStatus).toBe("reading");
  });

  it("reports the book as still in the queue and reading in the book view when removeFromQueue is false", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createOwnedBook(accessToken, { title: "Dune" });
    expect((await addToQueue(accessToken, { bookId, placement: "end" })).status).toBe(200);
    expect((await startReading(accessToken, bookId, { removeFromQueue: false })).status).toBe(200);

    const res = await getBook(accessToken, bookId);

    expect(res.status).toBe(200);
    expect(res.body.isInReadingQueue).toBe(true);
    expect(res.body.readingStatus).toBe("reading");
  });

  it("returns 200 without conflict when start-reading is called again on an already-reading queued book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createOwnedBook(accessToken, { title: "Dune" });
    expect((await addToQueue(accessToken, { bookId, placement: "end" })).status).toBe(200);
    expect((await startReading(accessToken, bookId, { removeFromQueue: false })).status).toBe(200);

    const res = await startReading(accessToken, bookId, { removeFromQueue: false });

    expect(res.status).toBe(200);
    expect(res.body.items[0].book.readingStatus).toBe("reading");
  });

  it("dequeues an already-reading book on a subsequent start-reading with removeFromQueue true", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createOwnedBook(accessToken, { title: "Dune" });
    expect((await addToQueue(accessToken, { bookId, placement: "end" })).status).toBe(200);
    expect((await startReading(accessToken, bookId, { removeFromQueue: false })).status).toBe(200);

    const res = await startReading(accessToken, bookId, { removeFromQueue: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0, items: [], totalCount: 0, totalPagesCount: 0 });
  });

  it("leaves the ownership status unchanged after starting reading", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createOwnedBook(accessToken, {
      ownershipStatus: "owned",
      title: "Dune",
    });
    expect((await addToQueue(accessToken, { bookId, placement: "end" })).status).toBe(200);
    expect((await startReading(accessToken, bookId, { removeFromQueue: false })).status).toBe(200);

    const res = await getBook(accessToken, bookId);

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("owned");
  });

  it("clears the priority and reason detail fields when start-reading removes a high-priority book from the queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createOwnedBook(accessToken, {
      addToReadingQueue: true,
      queuePriority: "high",
      queuePriorityReason: "book_club",
      queuePriorityTargetDate: "2026-08-24",
      title: "Dune",
    });

    expect((await startReading(accessToken, bookId, { removeFromQueue: true })).status).toBe(200);

    const res = await getBook(accessToken, bookId);
    expect(res.status).toBe(200);
    expect(res.body.isInReadingQueue).toBe(false);
    expect(res.body.queuePriority).toBeNull();
    expect(res.body.queuePriorityReason).toBeNull();
    expect(res.body.queuePriorityReasonCustomText).toBeNull();
    expect(res.body.queuePriorityTargetDate).toBeNull();
  });
});

describe("GET /api/reading-queue/summary", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/reading-queue/summary");

    expect(res.status).toBe(401);
  });

  it("aggregates the queue into consistent availability and series counts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSummaryQueue(accessToken);

    const res = await getSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      availableNowCount: 1,
      blockedBySeriesOrderCount: 2,
      seriesBooksCount: 2,
      seriesInQueueCount: 1,
      standaloneBooksCount: 3,
      totalCount: 5,
      unavailableByOwnership: { inTransit: 0, lentToSomeone: 0, none: 1, wantToBuy: 1 },
      unavailableCount: 2,
    });
  });

  it("keeps one user's summary isolated from another user's queue", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedSummaryQueue(owner.accessToken);

    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerBook = await createOwnedBook(stranger.accessToken, {
      ownershipStatus: "owned",
      title: "Foundation",
    });
    expect(
      (await addToQueue(stranger.accessToken, { bookId: strangerBook, placement: "end" })).status,
    ).toBe(200);

    const ownerSummary = await getSummary(owner.accessToken);
    expect(ownerSummary.body.totalCount).toBe(5);

    const strangerSummary = await getSummary(stranger.accessToken);
    expect(strangerSummary.body.totalCount).toBe(1);
    expect(strangerSummary.body.availableNowCount).toBe(1);
    expect(strangerSummary.body.seriesInQueueCount).toBe(0);
  });
});

describe("GET /api/reading-queue/volume-summary", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/reading-queue/volume-summary");

    expect(res.status).toBe(401);
  });

  it("returns exact volume numbers for a seeded queue without reading history", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    for (const pagesCount of [100, 200, 300]) {
      await createOwnedBook(accessToken, {
        addToReadingQueue: true,
        pagesCount,
        title: `Book ${pagesCount}`,
      });
    }
    await createOwnedBook(accessToken, {
      addToReadingQueue: true,
      formats: ["audiobook"],
      title: "Audiobook only",
    });
    await createOwnedBook(accessToken, {
      addToReadingQueue: true,
      formats: ["paper"],
      title: "Missing pages",
    });

    const res = await getVolumeSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.queueBooksCount).toBe(5);
    expect(res.body.coverage).toEqual({ calculatedBooks: 3, ratio: 0.75, totalBooks: 4 });
    expect(res.body.pages).toEqual({ invalidBooks: 0, knownRemaining: 600, missingBooks: 1 });
    expect(res.body.audiobookOnlyCount).toBe(1);
    expect(res.body.hasMissingData).toBe(true);
    expect(res.body.pace).toEqual({
      activeDaysInPeriod: 0,
      lastActivityAt: null,
      pagesPerCalendarDay: null,
      sourcePeriodDays: 0,
    });
    expect(res.body.estimate).toEqual({
      daysMax: null,
      daysMin: null,
      daysUntilForecast: 30,
      reasonUnavailable: "insufficient_history",
    });
  });

  it("excludes finished books that remain in the queue from the volume count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createOwnedBook(accessToken, { addToReadingQueue: true, pagesCount: 100, title: "One" });
    await createOwnedBook(accessToken, { addToReadingQueue: true, pagesCount: 100, title: "Two" });
    const doneBookId = await createOwnedBook(accessToken, {
      addToReadingQueue: true,
      pagesCount: 100,
      title: "Done",
    });
    await prisma.book.update({ data: { readingStatus: "finished" }, where: { id: doneBookId } });

    const queue = await getQueue(accessToken);
    expect(queue.body.count).toBe(3);

    const res = await getVolumeSummary(accessToken);
    expect(res.status).toBe(200);
    expect(res.body.queueBooksCount).toBe(2);
    expect(res.body.coverage.calculatedBooks).toBe(2);
    expect(res.body.pages.knownRemaining).toBe(200);
  });

  it("isolates one user's queue and reading history from another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const strangerBook = await createOwnedBook(stranger.accessToken, {
      addToReadingQueue: true,
      pagesCount: 500,
      title: "Stranger book",
    });
    for (const daysAgo of [1, 3, 5]) {
      await seedReadingEvent({
        bookId: strangerBook,
        date: subDays(new Date(), daysAgo),
        pagesRead: 50,
      });
    }

    const ownerBook = await createOwnedBook(owner.accessToken, {
      addToReadingQueue: true,
      pagesCount: 400,
      title: "Owner book",
    });
    await seedReadingEvent({ bookId: ownerBook, date: subDays(new Date(), 2), pagesRead: 80 });

    const res = await getVolumeSummary(owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.queueBooksCount).toBe(1);
    expect(res.body.pages.knownRemaining).toBe(400);
    expect(res.body.pace.activeDaysInPeriod).toBe(1);
    expect(res.body.pace.pagesPerCalendarDay).not.toBeNull();
  });

  it("matches the volume-summary route instead of the dynamic :bookId route", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getVolumeSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("queueBooksCount");
    expect(res.body).toHaveProperty("coverage");
    expect(res.body).toHaveProperty("estimate");
  });
});
