import type { INestApplication } from "@nestjs/common";

import { defaultUserProfileSettings } from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { addDaysToIsoDate, parseIsoDate, toZonedIsoDate } from "../../../core/iso-date.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { SeriesModule } from "../../series/series.module.js";
import { encodeNoteImpressionKey } from "../domain/note-rediscovery.js";
import { NotesModule } from "../notes.module.js";
import { NoteRediscoveryService } from "./note-rediscovery.service.js";

const REDISCOVERABLE_AGE_DAYS = 60;
const FRESH_AGE_DAYS = 5;

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let service: NoteRediscoveryService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, SeriesModule, NotesModule]);
  app = context.app;
  prisma = app.get(PrismaService);
  service = app.get(NoteRediscoveryService);
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

function authed(method: "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, title: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createBookNote({
  ageDays = REDISCOVERABLE_AGE_DAYS,
  bookId,
  token,
  ...body
}: {
  ageDays?: number;
  bookId: string;
  isSpoiler?: boolean;
  token: string;
}): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/notes`, token).send({
    text: "A scene worth remembering",
    ...body,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  await prisma.note.update({
    data: { createdAt: subDays(new Date(), ageDays) },
    where: { id: res.body.id },
  });
  return res.body.id;
}

function impressionKeyOf(noteId: string): string {
  return encodeNoteImpressionKey({ contextKey: "all", noteId, surface: "books" });
}

function readerToday(): string {
  return toZonedIsoDate({ instant: new Date(), timeZone: defaultUserProfileSettings.timezone });
}

async function recordSeriesSurfaceImpression({
  noteId,
  shownOn,
  userId,
}: {
  noteId: string;
  shownOn: string;
  userId: string;
}): Promise<void> {
  await prisma.noteRediscoveryImpression.create({
    data: {
      contextKey: "series-context",
      noteId,
      shownOn: parseIsoDate(shownOn),
      sourceKey: "book:elsewhere",
      surface: "series",
      userId,
    },
  });
}

async function seedTwoEligibleNotes(token: string): Promise<string[]> {
  const bookId = await createBook(token, "Dune");
  return [await createBookNote({ bookId, token }), await createBookNote({ bookId, token })];
}

async function trash(noteId: string): Promise<void> {
  await prisma.note.update({
    data: { deletedAt: new Date(), purgeAt: new Date() },
    where: { id: noteId },
  });
}

describe("NoteRediscoveryService.selectBooksMemoryNote", () => {
  it("returns null while fewer than two book notes qualify", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    const trashedBookId = await createBook(accessToken, "Messiah");
    await createBookNote({ bookId, token: accessToken });
    await createBookNote({ bookId, isSpoiler: true, token: accessToken });
    await createBookNote({ ageDays: FRESH_AGE_DAYS, bookId, token: accessToken });
    await trash(await createBookNote({ bookId, token: accessToken }));
    await createBookNote({ bookId: trashedBookId, token: accessToken });
    await prisma.book.update({
      data: { deletedAt: new Date(), purgeAt: new Date() },
      where: { id: trashedBookId },
    });
    const series = await authed("post", "/api/series", accessToken).send({ name: "Earthsea" });
    await authed("post", `/api/series/${series.body.id}/notes`, accessToken).send({
      text: "Series",
    });
    await prisma.note.updateMany({
      data: { createdAt: subDays(new Date(), REDISCOVERABLE_AGE_DAYS) },
      where: { seriesId: series.body.id },
    });

    await expect(service.selectBooksMemoryNote({ userId })).resolves.toBeNull();
  });

  it("selects an eligible book note with its book source and writes nothing", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const noteIds = await seedTwoEligibleNotes(accessToken);

    const memory = await service.selectBooksMemoryNote({ userId });

    expect(noteIds).toContain(memory?.note.id);
    expect(memory?.source).toMatchObject({
      authors: [{ name: "Frank Herbert" }],
      seriesPosition: null,
      title: "Dune",
      type: "book",
    });
    expect(memory?.impressionKey).toBe(impressionKeyOf(memory?.note.id ?? ""));
    await expect(prisma.noteRediscoveryImpression.count()).resolves.toBe(0);
  });

  it("keeps the same-day pick after its impression is recorded", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedTwoEligibleNotes(accessToken);

    const before = await service.selectBooksMemoryNote({ userId });
    await service.recordImpression({
      input: { impressionKey: before?.impressionKey ?? "" },
      userId,
    });
    const after = await service.selectBooksMemoryNote({ userId });

    expect(after?.note.id).toBe(before?.note.id);
  });

  it.each([
    ["trashed", (noteId: string) => trash(noteId)],
    [
      "marked as a spoiler",
      async (noteId: string) => {
        await prisma.note.update({ data: { isSpoiler: true }, where: { id: noteId } });
      },
    ],
  ])("reselects once the picked note is %s", async (_label, makeIneligible) => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    const noteIds = [
      await createBookNote({ bookId, token: accessToken }),
      await createBookNote({ bookId, token: accessToken }),
      await createBookNote({ bookId, token: accessToken }),
    ];

    const before = await service.selectBooksMemoryNote({ userId });
    await service.recordImpression({
      input: { impressionKey: before?.impressionKey ?? "" },
      userId,
    });
    await makeIneligible(before?.note.id ?? "");
    const after = await service.selectBooksMemoryNote({ userId });

    expect(after?.note.id).not.toBe(before?.note.id);
    expect(noteIds).toContain(after?.note.id);
  });

  it("cools down a note shown on another surface on an earlier day", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const [shownElsewhere, fresh] = await seedTwoEligibleNotes(accessToken);
    await recordSeriesSurfaceImpression({
      noteId: shownElsewhere ?? "",
      shownOn: addDaysToIsoDate(readerToday(), -1),
      userId,
    });

    const memory = await service.selectBooksMemoryNote({ userId });

    expect(memory?.note.id).toBe(fresh);
  });

  it("keeps the same-day pick when another surface records an impression of it today", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedTwoEligibleNotes(accessToken);

    const before = await service.selectBooksMemoryNote({ userId });
    await recordSeriesSurfaceImpression({
      noteId: before?.note.id ?? "",
      shownOn: readerToday(),
      userId,
    });
    const after = await service.selectBooksMemoryNote({ userId });

    expect(after?.note.id).toBe(before?.note.id);
  });
});

describe("NoteRediscoveryService.recordImpression", () => {
  it("records one impression per note and day however often it is sent", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const [noteId] = await seedTwoEligibleNotes(accessToken);
    const input = { impressionKey: impressionKeyOf(noteId ?? "") };

    await service.recordImpression({ input, userId });
    const countAfterFirst = await prisma.noteRediscoveryImpression.count();
    await service.recordImpression({ input, userId });

    expect(countAfterFirst).toBe(1);
    await expect(prisma.noteRediscoveryImpression.count()).resolves.toBe(1);
    await expect(prisma.noteRediscoveryImpression.findFirst()).resolves.toMatchObject({
      contextKey: "all",
      noteId,
      surface: "books",
    });
  });

  it("rejects a note that is not rediscoverable and writes nothing", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    const spoilerId = await createBookNote({ bookId, isSpoiler: true, token: accessToken });
    const freshId = await createBookNote({ ageDays: FRESH_AGE_DAYS, bookId, token: accessToken });

    for (const noteId of [spoilerId, freshId]) {
      await expect(
        service.recordImpression({ input: { impressionKey: impressionKeyOf(noteId) }, userId }),
      ).rejects.toBeInstanceOf(NotFoundError);
    }
    await expect(
      service.recordImpression({ input: { impressionKey: "garbage" }, userId }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(prisma.noteRediscoveryImpression.count()).resolves.toBe(0);
  });

  it("rejects another reader's note", async () => {
    const owner = await context.registerVerifyAndLogin();
    const [noteId] = await seedTwoEligibleNotes(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({ email: "stranger@example.com" });

    await expect(
      service.recordImpression({
        input: { impressionKey: impressionKeyOf(noteId ?? "") },
        userId: stranger.userId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
