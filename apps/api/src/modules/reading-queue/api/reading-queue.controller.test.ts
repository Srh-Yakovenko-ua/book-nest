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

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function getQueue(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/reading-queue")
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
