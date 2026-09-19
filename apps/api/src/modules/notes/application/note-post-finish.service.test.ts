import type { INestApplication } from "@nestjs/common";

import { defaultUserProfileSettings } from "@app/shared";
import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { addDaysToIsoDate, toZonedIsoDate } from "../../../core/iso-date.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { insertFinishedReadingCycle } from "../../../test/reading-cycles.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { QuotePostFinishService } from "../../quotes/application/quote-post-finish.service.js";
import { QUOTE_PURGE_QUEUE_NAME } from "../../quotes/domain/quote-purge.js";
import { QuotesModule } from "../../quotes/quotes.module.js";
import { SeriesModule } from "../../series/series.module.js";
import { NotesModule } from "../notes.module.js";
import { NotePostFinishService } from "./note-post-finish.service.js";

const queueStub = {
  add: (): Promise<void> => Promise.resolve(),
  remove: (): Promise<void> => Promise.resolve(),
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let service: NotePostFinishService;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule, SeriesModule, NotesModule, QuotesModule],
    [{ provide: getQueueToken(QUOTE_PURGE_QUEUE_NAME), useValue: queueStub }],
  );
  app = context.app;
  prisma = app.get(PrismaService);
  service = app.get(NotePostFinishService);
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

async function addNote(
  token: string,
  bookId: string,
  flags: { isFavorite?: boolean; isPinned?: boolean; isSpoiler?: boolean } = {},
): Promise<string> {
  const res = await authed(`/api/books/${bookId}/notes`, token).send({ text: "A note", ...flags });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function addQuote(token: string, bookId: string): Promise<void> {
  const res = await authed(`/api/books/${bookId}/quotes`, token).send({ text: "A quote" });
  expect(res.status).toBe(HttpStatus.CREATED);
}

function authed(path: string, token: string): request.Test {
  return request(app.getHttpServer()).post(path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, title: string): Promise<string> {
  const res = await authed("/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function daysAgo(days: number): string {
  return addDaysToIsoDate(
    toZonedIsoDate({ instant: new Date(), timeZone: defaultUserProfileSettings.timezone }),
    -days,
  );
}

describe("NotePostFinishService.selectPostFinish", () => {
  it("recaps the latest finished book holding notes, spoilers included", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await addNote(accessToken, bookId, { isFavorite: true, isPinned: true });
    await addNote(accessToken, bookId, { isPinned: true });
    await addNote(accessToken, bookId, { isSpoiler: true });
    const readingCycleId = await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: daysAgo(3),
      userId,
    });
    const emptyBookId = await createBook(accessToken, "Messiah");
    await insertFinishedReadingCycle(prisma, {
      bookId: emptyBookId,
      finishedIsoDate: daysAgo(1),
      userId,
    });

    await expect(service.selectPostFinish({ userId })).resolves.toEqual({
      book: { author: "Frank Herbert", cover: null, id: bookId, title: "Dune" },
      favoritesCount: 1,
      finishedAt: daysAgo(3),
      notesCount: 3,
      pinnedCount: 2,
      readingCycleId,
    });
  });

  it("drops a cycle finished outside the last thirty local days", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await addNote(accessToken, bookId);
    await insertFinishedReadingCycle(prisma, { bookId, finishedIsoDate: daysAgo(31), userId });

    await expect(service.selectPostFinish({ userId })).resolves.toBeNull();
  });

  it("keeps the notes recap and the quotes recap independent", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await addNote(accessToken, bookId);
    await addQuote(accessToken, bookId);
    const readingCycleId = await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: daysAgo(2),
      userId,
    });
    const quotePostFinish = app.get(QuotePostFinishService);

    await quotePostFinish.recordReview({ input: { readingCycleId }, userId });
    await expect(service.selectPostFinish({ userId })).resolves.toMatchObject({ readingCycleId });

    await prisma.quotePostFinishReview.deleteMany();
    await service.recordReview({ input: { readingCycleId }, userId });
    await expect(service.selectPostFinish({ userId })).resolves.toBeNull();
    await expect(quotePostFinish.selectPostFinish({ userId })).resolves.toMatchObject({
      readingCycleId,
    });
  });
});

describe("NotePostFinishService.recordReview", () => {
  it("stays idempotent and hides the recap", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await addNote(accessToken, bookId);
    const readingCycleId = await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: daysAgo(1),
      userId,
    });

    await service.recordReview({ input: { readingCycleId }, userId });
    await service.recordReview({ input: { readingCycleId }, userId });

    await expect(prisma.notePostFinishReview.count()).resolves.toBe(1);
    await expect(service.selectPostFinish({ userId })).resolves.toBeNull();
  });

  it("rejects another reader's reading cycle", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken, "Dune");
    const readingCycleId = await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: daysAgo(1),
      userId: owner.userId,
    });
    const stranger = await context.registerVerifyAndLogin({ email: "stranger@example.com" });

    await expect(
      service.recordReview({ input: { readingCycleId }, userId: stranger.userId }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(prisma.notePostFinishReview.count()).resolves.toBe(0);
  });
});
