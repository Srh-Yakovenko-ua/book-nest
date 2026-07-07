import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ReadingQueueModule } from "../reading-queue.module.js";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ReadingQueueModule]);
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

const NONEXISTENT_BOOK_ID = "33333333-3333-4333-8333-333333333333";

function addToQueue(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/reading-queue")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
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

function getQueue(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/reading-queue")
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

describe("GET /api/reading-queue", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/reading-queue");

    expect(res.status).toBe(401);
  });

  it("returns an empty queue for an authenticated user with no queued books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getQueue(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0, items: [], totalPagesCount: 0 });
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
    expect(afterD.body).toEqual({ count: 0, items: [], totalPagesCount: 0 });
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
});
