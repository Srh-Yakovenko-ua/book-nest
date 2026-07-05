import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const TODAY = new Date().toISOString().slice(0, 10);
const FUTURE_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10);

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule]);
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

function changeReadingStatus(
  accessToken: string,
  id: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${id}/reading-status`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function updateReadingProgress(
  accessToken: string,
  id: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${id}/reading-progress`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("POST /api/books/:id/reading-status authorization", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/books/${MISSING_UUID}/reading-status`)
      .send({ status: "reading" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed book id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await changeReadingStatus(accessToken, "not-a-uuid", { status: "reading" });

    expect(res.status).toBe(400);
  });

  it("returns 404 for a book that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await changeReadingStatus(accessToken, MISSING_UUID, { status: "reading" });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the book belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await changeReadingStatus(stranger.accessToken, created.body.id, {
      status: "reading",
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/books/:id/reading-status validation", () => {
  it("returns 400 when the status is missing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, {});

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "status" })]),
    );
  });

  it("returns 400 for a rating that is not a multiple of 0.5", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, {
      rating: 0.7,
      status: "finished",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "rating" })]),
    );
  });

  it("returns 400 for a date in the future", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, {
      date: FUTURE_DATE,
      status: "reading",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "date" })]),
    );
  });

  it("returns 422 when the current page exceeds the page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 100,
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, {
      currentPage: 150,
      status: "reading",
    });

    expect(res.status).toBe(422);
  });
});

describe("POST /api/books/:id/reading-status side effects", () => {
  it("moves the book to reading and defaults the start date to today", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, { status: "reading" });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("reading");
    expect(res.body.readingProgress.startedAt).toBe(TODAY);
  });

  it("uses the explicit date as the start date instead of today", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, {
      date: "2026-01-15",
      status: "reading",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress.startedAt).toBe("2026-01-15");
  });

  it("moves the book to want_to_read without creating a progress row", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, {
      status: "want_to_read",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("want_to_read");
    expect(res.body.readingProgress).toBeNull();
  });

  it("snaps the current page to the page count when finishing a book with a page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingProgress: { currentPage: 100 },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, { status: "finished" });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("finished");
    expect(res.body.readingProgress.currentPage).toBe(300);
    expect(res.body.readingProgress.finishedAt).toBe(TODAY);
  });

  it("leaves the current page null when finishing a book without a page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, { status: "finished" });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress.currentPage).toBeNull();
    expect(res.body.readingProgress.finishedAt).toBe(TODAY);
  });

  it("records the rating when finishing a book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingProgress: { currentPage: 100 },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, {
      rating: 9,
      status: "finished",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress.rating).toBe(9);
  });

  it("stamps the paused date and carries the current page and note when pausing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, {
      currentPage: 120,
      note: "pausing here",
      status: "paused",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("paused");
    expect(res.body.readingProgress).toMatchObject({
      currentPage: 120,
      note: "pausing here",
      pausedAt: TODAY,
    });
  });

  it("stamps the abandoned date and carries the current page and note when marking dnf", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, {
      currentPage: 60,
      note: "not for me",
      status: "dnf",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("dnf");
    expect(res.body.readingProgress).toMatchObject({
      abandonedAt: TODAY,
      currentPage: 60,
      note: "not for me",
    });
  });

  it("keeps the original start date when re-entering reading", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingProgress: { currentPage: 20, startedAt: "2026-01-10" },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, {
      currentPage: 25,
      date: "2026-03-01",
      status: "reading",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress.startedAt).toBe("2026-01-10");
    expect(res.body.readingProgress.currentPage).toBe(25);
  });

  it("clears the current page when resetting back to not_started", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingProgress: { currentPage: 80 },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, {
      resetProgress: true,
      status: "not_started",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("not_started");
    expect(res.body.readingProgress.currentPage).toBeNull();
  });

  it("clears finished markers when a rated finished book is reset to not_started", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingProgress: { currentPage: 120, startedAt: "2026-01-10" },
      readingStatus: "reading",
      title: "Dune",
    });

    const finished = await changeReadingStatus(accessToken, created.body.id, {
      rating: 9,
      status: "finished",
    });
    expect(finished.body.readingProgress).toMatchObject({ finishedAt: TODAY, rating: 9 });

    const res = await changeReadingStatus(accessToken, created.body.id, {
      resetProgress: true,
      status: "not_started",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("not_started");
    expect(res.body.readingProgress).toMatchObject({
      abandonedAt: null,
      currentPage: null,
      finishedAt: null,
      pausedAt: null,
      rating: null,
      startedAt: null,
    });
  });

  it("keeps the saved current page when returning to not_started without a reset", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingProgress: { currentPage: 80 },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, { status: "not_started" });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("not_started");
    expect(res.body.readingProgress.currentPage).toBe(80);
  });

  it("leaves favorite and ownership untouched when the reading status changes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      isFavorite: true,
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await changeReadingStatus(accessToken, created.body.id, { status: "reading" });

    expect(res.status).toBe(200);
    expect(res.body.isFavorite).toBe(true);
    expect(res.body.ownershipStatus).toBe("owned");
  });
});

describe("POST /api/books/:id/reading-progress", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/books/${MISSING_UUID}/reading-progress`)
      .send({ currentPage: 10 });

    expect(res.status).toBe(401);
  });

  it("returns 404 when the book belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await updateReadingProgress(stranger.accessToken, created.body.id, {
      currentPage: 10,
    });

    expect(res.status).toBe(404);
  });

  it("returns 400 when the current page is missing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateReadingProgress(accessToken, created.body.id, {});

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "currentPage" })]),
    );
  });

  it("records the current page and defaults the update date to today", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingProgress: { currentPage: 50 },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateReadingProgress(accessToken, created.body.id, { currentPage: 120 });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("reading");
    expect(res.body.readingProgress.currentPage).toBe(120);
    expect(res.body.readingProgress.lastProgressUpdateAt).toBe(TODAY);
  });

  it("stores the explicit update date instead of today", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingProgress: { currentPage: 50 },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateReadingProgress(accessToken, created.body.id, {
      currentPage: 120,
      updateDate: "2026-03-15",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress.lastProgressUpdateAt).toBe("2026-03-15");
  });

  it("auto-transitions a not_started book to reading and stamps the start date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingStatus: "not_started",
      title: "Dune",
    });

    const res = await updateReadingProgress(accessToken, created.body.id, { currentPage: 30 });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("reading");
    expect(res.body.readingProgress.currentPage).toBe(30);
    expect(res.body.readingProgress.startedAt).toBe(TODAY);
  });

  it("auto-transitions a want_to_read book to reading", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingStatus: "want_to_read",
      title: "Dune",
    });

    const res = await updateReadingProgress(accessToken, created.body.id, { currentPage: 30 });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("reading");
  });

  it("forces the page to the page count and finishes the book when markAsFinished is set", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingProgress: { currentPage: 50 },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateReadingProgress(accessToken, created.body.id, {
      currentPage: 100,
      markAsFinished: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("finished");
    expect(res.body.readingProgress.currentPage).toBe(300);
    expect(res.body.readingProgress.finishedAt).toBe(TODAY);
  });

  it("does not auto-change a paused book on a plain progress update", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingProgress: { currentPage: 50, pausedAt: "2026-01-10" },
      readingStatus: "paused",
      title: "Dune",
    });

    const res = await updateReadingProgress(accessToken, created.body.id, { currentPage: 120 });

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("paused");
    expect(res.body.readingProgress.currentPage).toBe(120);
  });

  it("returns 422 when the current page exceeds the page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 100,
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateReadingProgress(accessToken, created.body.id, { currentPage: 150 });

    expect(res.status).toBe(422);
  });

  it("returns 422 when the current page is lower than the saved progress", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingProgress: { currentPage: 100 },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateReadingProgress(accessToken, created.body.id, { currentPage: 50 });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Current page cannot be lower than the saved progress");
  });
});
