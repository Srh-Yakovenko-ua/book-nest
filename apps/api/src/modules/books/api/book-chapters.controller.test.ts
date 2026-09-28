import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../books.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

type ChapterUsageResult = {
  chapter: string;
  count: number;
};

const TRASHED_AT = new Date("2026-01-01T00:00:00.000Z");
const PURGE_AT = new Date("2026-02-01T00:00:00.000Z");

function trashStamps(deleted: boolean): { deletedAt: Nullable<Date>; purgeAt: Nullable<Date> } {
  return deleted
    ? { deletedAt: TRASHED_AT, purgeAt: PURGE_AT }
    : { deletedAt: null, purgeAt: null };
}

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let timelineOrder = 0;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule]);
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  context.reset();
  timelineOrder = 0;
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function createBook(userId: string): Promise<string> {
  const book = await prisma.book.create({
    data: {
      firstAuthorName: "",
      readingStatus: "not_started",
      title: `Book ${randomUUID()}`,
      userId,
    },
  });
  return book.id;
}

async function createNote(
  userId: string,
  bookId: string,
  chapter: null | string,
  options: { deleted?: boolean } = {},
): Promise<void> {
  await prisma.note.create({
    data: {
      bookId,
      chapter,
      ...trashStamps(options.deleted === true),
      entityType: "book",
      text: `note ${randomUUID()}`,
      userId,
    },
  });
}

async function createQuote(
  userId: string,
  bookId: string,
  chapter: null | string,
  options: { deleted?: boolean } = {},
): Promise<void> {
  await prisma.quote.create({
    data: {
      bookId,
      chapter,
      ...trashStamps(options.deleted === true),
      text: `quote ${randomUUID()}`,
      userId,
    },
  });
}

async function createSeries(userId: string): Promise<string> {
  const name = `Series ${randomUUID()}`;
  const series = await prisma.series.create({
    data: { name, normalizedName: name.toLowerCase(), userId },
  });
  return series.id;
}

async function createSeriesNote(userId: string, seriesId: string, chapter: string): Promise<void> {
  await prisma.note.create({
    data: {
      chapter,
      entityType: "series",
      seriesId,
      text: `series note ${randomUUID()}`,
      userId,
    },
  });
}

async function createTimeline(bookId: string): Promise<string> {
  const timeline = await prisma.bookTimeline.create({
    data: { bookId, colorKey: "sky", isDefault: true, name: "Main", position: 1 },
  });
  return timeline.id;
}

async function createTimelineEvent(
  bookId: string,
  timelineId: string,
  chapter: null | string,
): Promise<void> {
  timelineOrder += 1;
  await prisma.bookTimelineEvent.create({
    data: {
      bookId,
      bookOrder: timelineOrder,
      chapter,
      timelineId,
      timelineOrder,
      title: `event ${timelineOrder}`,
    },
  });
}

function getChapters(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${bookId}/chapters`)
    .set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/books/:bookId/chapters", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(`/api/books/${randomUUID()}/chapters`);

    expect(res.status).toBe(401);
  });

  it("returns 404 when the book does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getChapters(accessToken, MISSING_UUID);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignBook = await createBook(stranger.userId);
    const timelineId = await createTimeline(foreignBook);
    await createTimelineEvent(foreignBook, timelineId, "Розділ 1");

    const res = await getChapters(owner.accessToken, foreignBook);

    expect(res.status).toBe(404);
  });

  it("returns an empty array for a book with no chapters at all", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(userId);
    await createNote(userId, bookId, null);
    await createQuote(userId, bookId, null);

    const res = await getChapters(accessToken, bookId);

    expect(res.status).toBe(200);
    expect(res.body.chapters).toEqual<ChapterUsageResult[]>([]);
  });

  it("merges the three sources case-insensitively and sorts by usage", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(userId);
    const timelineId = await createTimeline(bookId);
    await createNote(userId, bookId, "Розділ 1");
    await createNote(userId, bookId, "розділ 1");
    await createQuote(userId, bookId, "Розділ 1");
    await createQuote(userId, bookId, "   ");
    await createTimelineEvent(bookId, timelineId, "РОЗДІЛ 1");
    await createTimelineEvent(bookId, timelineId, "Пролог");

    const res = await getChapters(accessToken, bookId);

    expect(res.status).toBe(200);
    expect(res.body.chapters).toEqual<ChapterUsageResult[]>([
      { chapter: "Розділ 1", count: 4 },
      { chapter: "Пролог", count: 1 },
    ]);
  });

  it("excludes soft-deleted notes and quotes while still counting timeline events", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(userId);
    const timelineId = await createTimeline(bookId);
    await createNote(userId, bookId, "Розділ 5", { deleted: true });
    await createQuote(userId, bookId, "Розділ 5", { deleted: true });
    await createNote(userId, bookId, "Розділ 6");
    await createTimelineEvent(bookId, timelineId, "Розділ 5");

    const res = await getChapters(accessToken, bookId);

    expect(res.status).toBe(200);
    expect(res.body.chapters).toEqual<ChapterUsageResult[]>([
      { chapter: "Розділ 5", count: 1 },
      { chapter: "Розділ 6", count: 1 },
    ]);
  });

  it("ignores chapters recorded against another book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(userId);
    const otherBookId = await createBook(userId);
    const seriesId = await createSeries(userId);
    await createNote(userId, bookId, "Розділ 1");
    await createNote(userId, otherBookId, "Розділ 2");
    await createSeriesNote(userId, seriesId, "Розділ 3");

    const res = await getChapters(accessToken, bookId);

    expect(res.status).toBe(200);
    expect(res.body.chapters).toEqual<ChapterUsageResult[]>([{ chapter: "Розділ 1", count: 1 }]);
  });
});
