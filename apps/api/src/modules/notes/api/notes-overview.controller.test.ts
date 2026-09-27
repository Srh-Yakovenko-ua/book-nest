import type { BookNotesOverviewView, ReadingStatus, SeriesNotesOverviewView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import {
  BookNotesOverviewViewSchema,
  defaultUserProfileSettings,
  SeriesNotesOverviewViewSchema,
} from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { addDaysToIsoDate, parseIsoDate, toZonedIsoDate } from "../../../core/iso-date.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { insertFinishedReadingCycle } from "../../../test/reading-cycles.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { READING_CYCLE_STATE } from "../../books/index.js";
import { SeriesModule } from "../../series/series.module.js";
import { decodeNoteImpressionKey, encodeNoteImpressionKey } from "../domain/note-rediscovery.js";
import { NotesModule } from "../notes.module.js";

const REDISCOVERABLE_AGE_DAYS = 60;
const FRESH_AGE_DAYS = 5;
const UNKNOWN_CYCLE_ID = "11111111-1111-4111-8111-111111111111";

const PATHS = {
  bookOverview: "/api/notes/books/overview",
  impression: "/api/notes/rediscovery/impression",
  postFinishReview: "/api/notes/books/post-finish/review",
  seriesOverview: "/api/notes/series/overview",
} as const;

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, SeriesModule, NotesModule]);
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

function authed(method: "delete" | "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

function bookNote(
  token: string,
  bookId: string,
  options: { ageDays?: number; body?: Record<string, unknown> } = {},
): Promise<string> {
  return createNote({ ...options, path: `/api/books/${bookId}/notes`, token });
}

async function bookOverview(token: string): Promise<BookNotesOverviewView> {
  const res = await authed("get", PATHS.bookOverview, token);
  expect(res.status).toBe(HttpStatus.OK);
  return BookNotesOverviewViewSchema.parse(res.body);
}

async function createBook(token: string, title: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createNote({
  ageDays,
  body = {},
  path,
  token,
}: {
  ageDays?: number;
  body?: Record<string, unknown>;
  path: string;
  token: string;
}): Promise<string> {
  const res = await authed("post", path, token).send({ text: "A thought worth keeping", ...body });
  expect(res.status).toBe(HttpStatus.CREATED);
  if (ageDays !== undefined) {
    await prisma.note.update({
      data: { createdAt: subDays(new Date(), ageDays) },
      where: { id: res.body.id },
    });
  }
  return res.body.id;
}

async function createSeries(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/series", token).send({ name });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createSeriesBook({
  ownershipStatus = "owned",
  partNumber,
  readingStatus,
  seriesId,
  token,
}: {
  ownershipStatus?: string;
  partNumber: number;
  readingStatus: ReadingStatus;
  seriesId: string;
  token: string;
}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Ursula Le Guin" }],
    bookType: "series_part",
    ownershipStatus,
    partNumber,
    seriesId,
    title: `Part ${partNumber}`,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  await prisma.book.update({ data: { readingStatus }, where: { id: res.body.id } });
  return res.body.id;
}

function daysAgo(days: number): string {
  const today = toZonedIsoDate({
    instant: new Date(),
    timeZone: defaultUserProfileSettings.timezone,
  });
  return addDaysToIsoDate(today, -days);
}

async function seedSagaWithContinuation({
  continuationStatus,
  token,
}: {
  continuationStatus: ReadingStatus;
  token: string;
}): Promise<{ bookIds: string[]; seriesId: string }> {
  const seriesId = await createSeries(token, "Earthsea");
  const statuses: ReadingStatus[] = ["finished", "dnf", continuationStatus, "not_started"];
  const bookIds: string[] = [];
  for (const [index, readingStatus] of statuses.entries()) {
    bookIds.push(await createSeriesBook({ partNumber: index + 1, readingStatus, seriesId, token }));
  }
  return { bookIds, seriesId };
}

function seriesNote(
  token: string,
  seriesId: string,
  options: { ageDays?: number; body?: Record<string, unknown> } = {},
): Promise<string> {
  return createNote({ ...options, path: `/api/series/${seriesId}/notes`, token });
}

async function seriesOverview(
  token: string,
  seriesIds: string[] = [],
): Promise<SeriesNotesOverviewView> {
  const query = seriesIds.map((seriesId) => `series=${seriesId}`).join("&");
  const res = await authed("get", `${PATHS.seriesOverview}?${query}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return SeriesNotesOverviewViewSchema.parse(res.body);
}

describe("GET /api/notes/books/overview", () => {
  it("rejects an anonymous reader", async () => {
    const res = await request(app.getHttpServer()).get(PATHS.bookOverview);

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("returns two null blocks for an empty archive", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    await expect(bookOverview(accessToken)).resolves.toEqual({
      memoryNote: null,
      postFinish: null,
    });
  });

  it("SH-MEM-05 returns the memory note and the post-finish recap without recording anything", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    const noteIds = [
      await bookNote(accessToken, bookId, { ageDays: REDISCOVERABLE_AGE_DAYS }),
      await bookNote(accessToken, bookId, { ageDays: REDISCOVERABLE_AGE_DAYS }),
    ];
    const readingCycleId = await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: daysAgo(2),
      userId,
    });

    const overview = await bookOverview(accessToken);

    expect(noteIds).toContain(overview.memoryNote?.note.id);
    expect(overview.memoryNote?.source.type).toBe("book");
    expect(overview.postFinish).toMatchObject({ notesCount: 2, readingCycleId });
    await expect(prisma.noteRediscoveryImpression.count()).resolves.toBe(0);
    await expect(prisma.notePostFinishReview.count()).resolves.toBe(0);
  });
});

describe("POST /api/notes/rediscovery/impression", () => {
  it("records one impression per day and keeps the same-day pick", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    for (let index = 0; index < 3; index += 1) {
      await bookNote(accessToken, bookId, { ageDays: REDISCOVERABLE_AGE_DAYS });
    }
    const before = await bookOverview(accessToken);
    const impressionKey = before.memoryNote?.impressionKey;

    const first = await authed("post", PATHS.impression, accessToken).send({ impressionKey });
    const repeat = await authed("post", PATHS.impression, accessToken).send({ impressionKey });
    const after = await bookOverview(accessToken);

    expect(first.status).toBe(HttpStatus.NO_CONTENT);
    expect(repeat.status).toBe(HttpStatus.NO_CONTENT);
    await expect(prisma.noteRediscoveryImpression.count()).resolves.toBe(1);
    expect(after.memoryNote?.note.id).toBe(before.memoryNote?.note.id);
  });

  it("rejects a missing key with 400 and an unknown key with 404", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const missing = await authed("post", PATHS.impression, accessToken).send({});
    const garbage = await authed("post", PATHS.impression, accessToken).send({
      impressionKey: "garbage",
    });

    expect(missing.status).toBe(HttpStatus.BAD_REQUEST);
    expect(garbage.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("rejects a key carrying another reader's note with 404 and writes nothing", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken, "Dune");
    const ownerNoteId = await bookNote(owner.accessToken, bookId, {
      ageDays: REDISCOVERABLE_AGE_DAYS,
    });
    const stranger = await context.registerVerifyAndLogin({ email: "stranger@example.com" });

    const res = await authed("post", PATHS.impression, stranger.accessToken).send({
      impressionKey: encodeNoteImpressionKey({
        contextKey: "all",
        noteId: ownerNoteId,
        surface: "books",
      }),
    });

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    await expect(prisma.noteRediscoveryImpression.count()).resolves.toBe(0);
  });
});

describe("POST /api/notes/books/post-finish/review", () => {
  it("consumes the recap once and stays idempotent", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await bookNote(accessToken, bookId);
    const readingCycleId = await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: daysAgo(1),
      userId,
    });

    const first = await authed("post", PATHS.postFinishReview, accessToken).send({
      readingCycleId,
    });
    const repeat = await authed("post", PATHS.postFinishReview, accessToken).send({
      readingCycleId,
    });

    expect(first.status).toBe(HttpStatus.NO_CONTENT);
    expect(repeat.status).toBe(HttpStatus.NO_CONTENT);
    await expect(prisma.notePostFinishReview.count()).resolves.toBe(1);
    await expect(bookOverview(accessToken)).resolves.toMatchObject({ postFinish: null });
  });

  it("rejects a reading cycle that is still active with 404 and writes nothing", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await bookNote(accessToken, bookId);
    const readingCycleId = await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: daysAgo(1),
      userId,
    });
    await prisma.bookReadingCycle.update({
      data: { finishedAt: null, state: READING_CYCLE_STATE.active },
      where: { id: readingCycleId },
    });

    const res = await authed("post", PATHS.postFinishReview, accessToken).send({ readingCycleId });

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    await expect(prisma.notePostFinishReview.count()).resolves.toBe(0);
  });

  it("rejects an unknown reading cycle with 404 and a malformed id with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const unknown = await authed("post", PATHS.postFinishReview, accessToken).send({
      readingCycleId: UNKNOWN_CYCLE_ID,
    });
    const malformed = await authed("post", PATHS.postFinishReview, accessToken).send({
      readingCycleId: "not-a-uuid",
    });

    expect(unknown.status).toBe(HttpStatus.NOT_FOUND);
    expect(malformed.status).toBe(HttpStatus.BAD_REQUEST);
  });
});

describe("GET /api/notes/series/overview before-continuation", () => {
  it("SERIES-CTX-02 returns no blocks when no series qualifies", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(accessToken, "Earthsea");
    const firstBookId = await createSeriesBook({
      partNumber: 1,
      readingStatus: "reading",
      seriesId,
      token: accessToken,
    });
    await bookNote(accessToken, firstBookId);

    await expect(seriesOverview(accessToken)).resolves.toEqual({
      beforeNextBook: null,
      memoryNote: null,
    });
  });

  it("SERIES-BC-02 SERIES-BC-03 SERIES-BC-04 SERIES-BC-05 recaps previous closed book notes only", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds, seriesId } = await seedSagaWithContinuation({
      continuationStatus: "reading",
      token: accessToken,
    });
    const [finishedId, dnfId, continuationId, futureId] = bookIds;
    const finishedSpoilerNote = await bookNote(accessToken, finishedId ?? "", {
      body: { isSpoiler: true },
    });
    const dnfNote = await bookNote(accessToken, dnfId ?? "");
    await bookNote(accessToken, continuationId ?? "");
    await bookNote(accessToken, futureId ?? "");
    await seriesNote(accessToken, seriesId);

    const { beforeNextBook } = await seriesOverview(accessToken);

    expect(beforeNextBook?.notes.map((note) => note.id)).toEqual([dnfNote, finishedSpoilerNote]);
    expect(beforeNextBook?.notes[1]).toMatchObject({
      isSpoiler: true,
      sourceBook: { id: finishedId, seriesPosition: 1, title: "Part 1" },
    });
    expect(beforeNextBook?.continuation).toMatchObject({
      id: continuationId,
      ownershipStatus: "owned",
      readingStatus: "reading",
      reason: "reading",
      seriesPosition: 3,
    });
    expect(beforeNextBook?.series).toEqual({
      id: seriesId,
      knownBooksCount: 4,
      title: "Earthsea",
      totalBooks: null,
    });
    expect(beforeNextBook).not.toHaveProperty("notes.0.distance");
    expect(beforeNextBook).not.toHaveProperty("notes.0.score");
  });

  it("SERIES-BC-06 SERIES-BC-07 ranks the recap and caps the preview at five with the full total", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await seedSagaWithContinuation({
      continuationStatus: "not_started",
      token: accessToken,
    });
    const [farId, nearId] = bookIds;
    const plainNear = [];
    for (let index = 0; index < 4; index += 1) {
      plainNear.push(await bookNote(accessToken, nearId ?? ""));
    }
    const plainFar = await bookNote(accessToken, farId ?? "");
    const pinnedFar = await bookNote(accessToken, farId ?? "", { body: { isPinned: true } });
    const favoriteFar = await bookNote(accessToken, farId ?? "", { body: { isFavorite: true } });

    const { beforeNextBook } = await seriesOverview(accessToken);

    expect(beforeNextBook?.totalCount).toBe(7);
    expect(beforeNextBook?.previewLimit).toBe(5);
    expect(beforeNextBook?.notes.map((note) => note.id)).toEqual([
      pinnedFar,
      favoriteFar,
      ...plainNear.slice(-3).reverse(),
    ]);
    expect(beforeNextBook?.notes.map((note) => note.id)).not.toContain(plainFar);
  });

  it("SERIES-BC-09 keeps the recap for a paused continuation that is not owned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(accessToken, "Earthsea");
    const finishedId = await createSeriesBook({
      partNumber: 1,
      readingStatus: "finished",
      seriesId,
      token: accessToken,
    });
    await createSeriesBook({
      ownershipStatus: "want_to_buy",
      partNumber: 2,
      readingStatus: "paused",
      seriesId,
      token: accessToken,
    });
    await bookNote(accessToken, finishedId);

    const { beforeNextBook } = await seriesOverview(accessToken);

    expect(beforeNextBook?.continuation).toMatchObject({
      ownershipStatus: "want_to_buy",
      readingStatus: "paused",
      reason: "paused",
    });
  });

  it("SERIES-BC-10 derives the recap without writing anything and offers no consume route", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await seedSagaWithContinuation({
      continuationStatus: "reading",
      token: accessToken,
    });
    await bookNote(accessToken, bookIds[0] ?? "");

    const { beforeNextBook } = await seriesOverview(accessToken);
    const consume = await authed(
      "post",
      "/api/notes/series/before-next-book/review",
      accessToken,
    ).send({});

    expect(beforeNextBook).not.toBeNull();
    await expect(prisma.noteRediscoveryImpression.count()).resolves.toBe(0);
    await expect(prisma.notePostFinishReview.count()).resolves.toBe(0);
    expect(consume.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("GET /api/notes/series/overview series resolution", () => {
  async function seedEligibleSeries({
    continuationStatus,
    name,
    token,
  }: {
    continuationStatus: ReadingStatus;
    name: string;
    token: string;
  }): Promise<string> {
    const seriesId = await createSeries(token, name);
    const finishedId = await createSeriesBook({
      partNumber: 1,
      readingStatus: "finished",
      seriesId,
      token,
    });
    await createSeriesBook({ partNumber: 2, readingStatus: continuationStatus, seriesId, token });
    await bookNote(token, finishedId);
    return seriesId;
  }

  it("picks the series whose continuation is being read over a paused or unstarted one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedEligibleSeries({
      continuationStatus: "not_started",
      name: "Unstarted",
      token: accessToken,
    });
    await seedEligibleSeries({ continuationStatus: "paused", name: "Paused", token: accessToken });
    const readingId = await seedEligibleSeries({
      continuationStatus: "rereading",
      name: "Rereading",
      token: accessToken,
    });

    const { beforeNextBook } = await seriesOverview(accessToken);

    expect(beforeNextBook?.series.id).toBe(readingId);
  });

  it("breaks a state tie by the most recent note activity", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const olderId = await seedEligibleSeries({
      continuationStatus: "not_started",
      name: "Older",
      token: accessToken,
    });
    await seedEligibleSeries({
      continuationStatus: "not_started",
      name: "Newer",
      token: accessToken,
    });
    await seriesNote(accessToken, olderId);

    const { beforeNextBook } = await seriesOverview(accessToken);

    expect(beforeNextBook?.series.id).toBe(olderId);
  });

  it("describes exactly one selected series even when another one ranks higher", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const unstartedId = await seedEligibleSeries({
      continuationStatus: "not_started",
      name: "Unstarted",
      token: accessToken,
    });
    await seedEligibleSeries({
      continuationStatus: "reading",
      name: "Reading",
      token: accessToken,
    });

    const { beforeNextBook } = await seriesOverview(accessToken, [unstartedId]);

    expect(beforeNextBook?.series.id).toBe(unstartedId);
  });

  it("ranks only inside a multi-series selection and never takes the first selected", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const unstartedId = await seedEligibleSeries({
      continuationStatus: "not_started",
      name: "Unstarted",
      token: accessToken,
    });
    const pausedId = await seedEligibleSeries({
      continuationStatus: "paused",
      name: "Paused",
      token: accessToken,
    });
    await seedEligibleSeries({
      continuationStatus: "reading",
      name: "Reading",
      token: accessToken,
    });
    const emptyId = await createSeries(accessToken, "Empty");

    const ranked = await seriesOverview(accessToken, [unstartedId, pausedId]);
    const withEmptySelected = await seriesOverview(accessToken, [emptyId, emptyId, unstartedId]);
    const onlyIneligible = await seriesOverview(accessToken, [
      emptyId,
      await createSeries(accessToken, "Also empty"),
    ]);

    expect(ranked.beforeNextBook?.series.id).toBe(pausedId);
    expect(withEmptySelected.beforeNextBook?.series.id).toBe(unstartedId);
    expect(onlyIneligible).toEqual({ beforeNextBook: null, memoryNote: null });
  });

  async function seedMemoryOnlySeries({
    name,
    token,
  }: {
    name: string;
    token: string;
  }): Promise<{ noteIds: string[]; seriesId: string }> {
    const seriesId = await createSeries(token, name);
    await createSeriesBook({ partNumber: 1, readingStatus: "reading", seriesId, token });
    const noteIds = [
      await seriesNote(token, seriesId, { ageDays: REDISCOVERABLE_AGE_DAYS }),
      await seriesNote(token, seriesId, { ageDays: REDISCOVERABLE_AGE_DAYS }),
    ];
    return { noteIds, seriesId };
  }

  it("picks a memory-only series when no series has a before-continuation plan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { noteIds, seriesId } = await seedMemoryOnlySeries({
      name: "Memories",
      token: accessToken,
    });
    const quietId = await createSeries(accessToken, "Quiet");
    await createSeriesBook({
      partNumber: 1,
      readingStatus: "reading",
      seriesId: quietId,
      token: accessToken,
    });

    const overview = await seriesOverview(accessToken);
    const selected = await seriesOverview(accessToken, [quietId, seriesId]);

    expect(overview.beforeNextBook).toBeNull();
    expect(noteIds).toContain(overview.memoryNote?.note.id);
    expect(overview.memoryNote?.source).toEqual({
      id: seriesId,
      title: "Memories",
      type: "series",
    });
    expect(selected.memoryNote?.note.id).toBe(overview.memoryNote?.note.id);
  });

  it("ranks a series with a before-continuation plan above a memory-only one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const planId = await seedEligibleSeries({
      continuationStatus: "not_started",
      name: "Planned",
      token: accessToken,
    });
    const { seriesId: memoryOnlyId } = await seedMemoryOnlySeries({
      name: "Memories",
      token: accessToken,
    });

    const overview = await seriesOverview(accessToken);
    const selected = await seriesOverview(accessToken, [memoryOnlyId, planId]);

    expect(overview.beforeNextBook?.series.id).toBe(planId);
    expect(overview.memoryNote).toBeNull();
    expect(selected.beforeNextBook?.series.id).toBe(planId);
  });

  it("rejects a malformed series filter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("get", `${PATHS.seriesOverview}?series=nope`, accessToken);

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });
});

describe("GET /api/notes/series/overview memory note", () => {
  async function seedSeriesWithBook(token: string): Promise<{ bookId: string; seriesId: string }> {
    const seriesId = await createSeries(token, "Earthsea");
    const bookId = await createSeriesBook({
      partNumber: 1,
      readingStatus: "reading",
      seriesId,
      token,
    });
    return { bookId, seriesId };
  }

  it("SERIES-MEM-01 SERIES-MEM-10 draws from series and book notes with a server-built source", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await seedSeriesWithBook(accessToken);
    const seriesNoteId = await seriesNote(accessToken, seriesId, {
      ageDays: REDISCOVERABLE_AGE_DAYS,
    });
    const bookNoteId = await bookNote(accessToken, bookId, { ageDays: REDISCOVERABLE_AGE_DAYS });

    const { memoryNote } = await seriesOverview(accessToken, [seriesId]);

    const expectedSourceByNoteId = new Map<string, unknown>([
      [bookNoteId, expect.objectContaining({ id: bookId, seriesPosition: 1, type: "book" })],
      [seriesNoteId, { id: seriesId, title: "Earthsea", type: "series" }],
    ]);

    expect([seriesNoteId, bookNoteId]).toContain(memoryNote?.note.id);
    expect(memoryNote?.source).toEqual(expectedSourceByNoteId.get(memoryNote?.note.id ?? ""));
  });

  it("SERIES-MEM-05 keys the impression by the series surface and id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await seedSeriesWithBook(accessToken);
    await bookNote(accessToken, bookId, { ageDays: REDISCOVERABLE_AGE_DAYS });
    await seriesNote(accessToken, seriesId, { ageDays: REDISCOVERABLE_AGE_DAYS });

    const { memoryNote } = await seriesOverview(accessToken, [seriesId]);

    expect(decodeNoteImpressionKey(memoryNote?.impressionKey ?? "")).toEqual({
      contextKey: seriesId,
      noteId: memoryNote?.note.id,
      surface: "series",
    });
  });

  it("SERIES-MEM-02 SERIES-MEM-03 needs two non-spoiler notes at least 30 days old", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await seedSeriesWithBook(accessToken);
    await bookNote(accessToken, bookId, { ageDays: REDISCOVERABLE_AGE_DAYS });
    await bookNote(accessToken, bookId, { ageDays: FRESH_AGE_DAYS });
    await seriesNote(accessToken, seriesId, {
      ageDays: REDISCOVERABLE_AGE_DAYS,
      body: { isSpoiler: true },
    });

    const { memoryNote } = await seriesOverview(accessToken, [seriesId]);

    expect(memoryNote).toBeNull();
  });

  it("SERIES-MEM-07 SERIES-MEM-08 keeps the series pick after its impression and cools it down on Books from the next day", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await seedSeriesWithBook(accessToken);
    const noteIds = [
      await bookNote(accessToken, bookId, { ageDays: REDISCOVERABLE_AGE_DAYS }),
      await bookNote(accessToken, bookId, { ageDays: REDISCOVERABLE_AGE_DAYS }),
    ];

    const before = await seriesOverview(accessToken, [seriesId]);
    const impression = await authed("post", PATHS.impression, accessToken).send({
      impressionKey: before.memoryNote?.impressionKey,
    });
    const after = await seriesOverview(accessToken, [seriesId]);
    await prisma.noteRediscoveryImpression.updateMany({
      data: { shownOn: parseIsoDate(daysAgo(1)) },
    });
    const books = await bookOverview(accessToken);

    expect(impression.status).toBe(HttpStatus.NO_CONTENT);
    expect(after.memoryNote?.note.id).toBe(before.memoryNote?.note.id);
    expect(books.memoryNote?.note.id).toBe(
      noteIds.find((noteId) => noteId !== before.memoryNote?.note.id),
    );
  });

  it("SERIES-MEM-08 keeps the series pick when Books records an impression of the same note first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await seedSeriesWithBook(accessToken);
    await bookNote(accessToken, bookId, { ageDays: REDISCOVERABLE_AGE_DAYS });
    await bookNote(accessToken, bookId, { ageDays: REDISCOVERABLE_AGE_DAYS });

    const before = await seriesOverview(accessToken, [seriesId]);
    const pickedNoteId = before.memoryNote?.note.id ?? "";
    const booksImpression = await authed("post", PATHS.impression, accessToken).send({
      impressionKey: encodeNoteImpressionKey({
        contextKey: "all",
        noteId: pickedNoteId,
        surface: "books",
      }),
    });
    const after = await seriesOverview(accessToken, [seriesId]);

    expect(booksImpression.status).toBe(HttpStatus.NO_CONTENT);
    expect(after.memoryNote?.note.id).toBe(pickedNoteId);
  });

  it("SERIES-MEM-09 reselects the same day once the picked note is trashed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await seedSeriesWithBook(accessToken);
    for (let index = 0; index < 3; index += 1) {
      await bookNote(accessToken, bookId, { ageDays: REDISCOVERABLE_AGE_DAYS });
    }

    const before = await seriesOverview(accessToken, [seriesId]);
    await authed("post", PATHS.impression, accessToken).send({
      impressionKey: before.memoryNote?.impressionKey,
    });
    const trashed = await authed(
      "delete",
      `/api/notes/${before.memoryNote?.note.id ?? ""}`,
      accessToken,
    );
    const after = await seriesOverview(accessToken, [seriesId]);

    expect(trashed.status).toBe(HttpStatus.OK);
    expect(after.memoryNote).not.toBeNull();
    expect(after.memoryNote?.note.id).not.toBe(before.memoryNote?.note.id);
  });

  it("SERIES-CTX-01 SH-MEM-05 returns both blocks in one read without recording an impression", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds, seriesId } = await seedSagaWithContinuation({
      continuationStatus: "reading",
      token: accessToken,
    });
    await bookNote(accessToken, bookIds[0] ?? "", { ageDays: REDISCOVERABLE_AGE_DAYS });
    await seriesNote(accessToken, seriesId, { ageDays: REDISCOVERABLE_AGE_DAYS });

    const overview = await seriesOverview(accessToken);

    expect(Object.keys(overview)).toEqual(["beforeNextBook", "memoryNote"]);
    expect(overview.beforeNextBook?.series.id).toBe(seriesId);
    expect(overview.memoryNote).not.toBeNull();
    await expect(prisma.noteRediscoveryImpression.count()).resolves.toBe(0);
  });

  it("rejects a series impression key whose context is not a series id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const impressionKey = Buffer.from(
      JSON.stringify({
        contextKey: "all",
        noteId: UNKNOWN_CYCLE_ID,
        surface: "series",
      }),
    ).toString("base64url");

    const res = await authed("post", PATHS.impression, accessToken).send({ impressionKey });

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});
