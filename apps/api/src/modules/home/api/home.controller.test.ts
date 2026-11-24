import type {
  HomeActiveBooksPage,
  HomeAttentionView,
  HomeNextReadView,
  HomeReadingView,
  Nullable,
  OwnershipStatus,
  ReadingStatus,
} from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import {
  HomeActiveBooksPageSchema,
  HomeAttentionViewSchema,
  HomeNextReadViewSchema,
  HomeReadingViewSchema,
} from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import { addDays } from "date-fns";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { addDaysToIsoDate, parseIsoDate, toZonedIsoDate } from "../../../core/iso-date.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { registerReaderInTimezone } from "../../../test/user-timezone.js";
import { defaultUserToday } from "../../../test/user-today.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { READING_CYCLE_STATE } from "../../books/index.js";
import { HomeModule } from "../home.module.js";

type HomeSection<TData> =
  { data: TData; status: "available" } | { reason: string; status: "unavailable" };

type QueueBooks = {
  eligible: string;
  lent: string;
  paused: string;
  reading: string;
};

const HOME_ROUTES = {
  attention: "/api/home/attention",
  nextRead: "/api/home/next-read",
  reading: "/api/home/reading",
  readingBooks: "/api/home/reading/books",
} as const;

const FIXTURE = {
  cycleStartedDaysAgo: 30,
  farEastTimezone: "Pacific/Kiritimati",
  pagesCount: 320,
} as const;

const ACTIVE_BOOK_IDS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
  "00000000-0000-4000-8000-000000000005",
  "00000000-0000-4000-8000-000000000006",
  "00000000-0000-4000-8000-000000000007",
  "00000000-0000-4000-8000-000000000008",
] as const;

const [b1, b2, b3, b4, b5, b6, b7, b8] = ACTIVE_BOOK_IDS;

const EIGHT_ACTIVE_BOOKS = [
  { id: b5, lastProgressDaysAgo: 4, readingStatus: "rereading" },
  { id: b1, lastProgressDaysAgo: 8, readingStatus: "reading" },
  { id: b8, lastProgressDaysAgo: 1, readingStatus: "rereading" },
  { id: b3, lastProgressDaysAgo: 6, readingStatus: "reading" },
  { id: b6, lastProgressDaysAgo: 3, readingStatus: "reading" },
  { id: b2, lastProgressDaysAgo: 7, readingStatus: "rereading" },
  { id: b7, lastProgressDaysAgo: 2, readingStatus: "reading" },
  { id: b4, lastProgressDaysAgo: 5, readingStatus: "reading" },
] as const;

const TIE_BOOK_IDS = {
  higher: "00000000-0000-4000-8000-0000000000b2",
  lower: "00000000-0000-4000-8000-0000000000a1",
  newest: "00000000-0000-4000-8000-0000000000c3",
} as const;

const CreatedBookSchema = z.object({ id: z.uuid() });

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reader: AuthenticatedUser;
let today: string;

async function activeBooksPage(
  user: AuthenticatedUser,
  cursor: string,
): Promise<HomeActiveBooksPage> {
  const res = await authorized(
    user,
    request(app.getHttpServer()).get(HOME_ROUTES.readingBooks).query({ cursor }),
  );
  expect(res.status).toBe(HttpStatus.OK);
  return HomeActiveBooksPageSchema.parse(res.body);
}

async function attentionView(user: AuthenticatedUser): Promise<HomeAttentionView> {
  const res = await authorized(user, request(app.getHttpServer()).get(HOME_ROUTES.attention));
  expect(res.status).toBe(HttpStatus.OK);
  return HomeAttentionViewSchema.parse(res.body);
}

function authorized(user: AuthenticatedUser, test: request.Test): request.Test {
  return test.set("Authorization", `Bearer ${user.accessToken}`);
}

function availableData<TData>(section: HomeSection<TData>): TData {
  if (section.status === "unavailable") {
    throw new Error(`home section unavailable: ${section.reason}`);
  }
  return section.data;
}

async function borrowOverdueBook(user: AuthenticatedUser): Promise<string> {
  const created = await authorized(
    user,
    request(app.getHttpServer())
      .post("/api/books")
      .send({ authors: [{ name: "Frank Herbert" }], ownershipStatus: "none", title: "Dune" }),
  );
  expect(created.status).toBe(HttpStatus.CREATED);
  const { id } = CreatedBookSchema.parse(created.body);

  const loan = await authorized(
    user,
    request(app.getHttpServer())
      .post(`/api/books/${id}/loan`)
      .send({
        direction: "borrowed",
        expectedReturnDate: daysAgo(5),
        loanDate: daysAgo(20),
        personName: "Olha",
      }),
  );
  expect(loan.status).toBe(HttpStatus.OK);
  return id;
}

async function createBook({
  id,
  ownershipStatus = "owned",
  queuePosition = null,
  queueTargetDate = null,
  readingStatus,
  title,
  trashed = false,
  userId = reader.userId,
}: {
  id?: string;
  ownershipStatus?: OwnershipStatus;
  queuePosition?: Nullable<number>;
  queueTargetDate?: Nullable<string>;
  readingStatus: ReadingStatus;
  title: string;
  trashed?: boolean;
  userId?: string;
}): Promise<string> {
  const trashedAt = new Date();
  const book = await prisma.book.create({
    data: {
      ...(id === undefined ? {} : { id }),
      ownershipStatus,
      pagesCount: FIXTURE.pagesCount,
      queuePosition,
      readingStatus,
      title,
      userId,
      ...(queueTargetDate === null
        ? {}
        : {
            queuePriority: "high",
            queuePriorityReason: "event_or_deadline",
            queuePriorityTargetDate: parseIsoDate(queueTargetDate),
          }),
      ...(trashed
        ? { deletedAt: trashedAt, purgeAt: addDays(trashedAt, TRASH_RETENTION.days) }
        : {}),
    },
    select: { id: true },
  });
  return book.id;
}

async function createGoal({ deadline, name }: { deadline: string; name: string }): Promise<string> {
  const goal = await prisma.readingGoal.create({
    data: {
      deadline: parseIsoDate(deadline),
      listId: null,
      name,
      targetCount: 3,
      userId: reader.userId,
    },
    select: { id: true },
  });
  return goal.id;
}

function daysAgo(days: number): string {
  return addDaysToIsoDate(today, -days);
}

function daysAhead(days: number): string {
  return addDaysToIsoDate(today, days);
}

async function nextReadView(user: AuthenticatedUser): Promise<HomeNextReadView> {
  const res = await authorized(user, request(app.getHttpServer()).get(HOME_ROUTES.nextRead));
  expect(res.status).toBe(HttpStatus.OK);
  return HomeNextReadViewSchema.parse(res.body);
}

function queueSnapshot(): Promise<{ id: string; queuePosition: Nullable<number> }[]> {
  return prisma.book.findMany({
    orderBy: { id: "asc" },
    select: { id: true, queuePosition: true },
    where: { userId: reader.userId },
  });
}

async function readingView(user: AuthenticatedUser): Promise<HomeReadingView> {
  const res = await authorized(user, request(app.getHttpServer()).get(HOME_ROUTES.reading));
  expect(res.status).toBe(HttpStatus.OK);
  return HomeReadingViewSchema.parse(res.body);
}

async function recordProgress({
  bookId,
  cycleId,
  isoDate,
}: {
  bookId: string;
  cycleId: Nullable<string>;
  isoDate: string;
}): Promise<void> {
  await prisma.bookReadingProgressEvent.create({
    data: { bookId, date: parseIsoDate(isoDate), page: 40, pagesRead: 20, readingCycleId: cycleId },
  });
}

async function seedActiveBook({
  id,
  lastProgressIsoDate,
  readingStatus = "reading",
  title = "Active book",
  userId = reader.userId,
}: {
  id?: string;
  lastProgressIsoDate: string;
  readingStatus?: ReadingStatus;
  title?: string;
  userId?: string;
}): Promise<string> {
  const bookId = await createBook({ id, readingStatus, title, userId });
  const cycleId = await startActiveCycle({ bookId, userId });
  await recordProgress({ bookId, cycleId, isoDate: lastProgressIsoDate });
  return bookId;
}

async function seedEightActiveBooks(): Promise<void> {
  for (const book of EIGHT_ACTIVE_BOOKS) {
    await seedActiveBook({
      id: book.id,
      lastProgressIsoDate: daysAgo(book.lastProgressDaysAgo),
      readingStatus: book.readingStatus,
      title: `Active ${book.id.slice(-1)}`,
    });
  }
}

async function seedOtherReaderEverything(): Promise<void> {
  const other = await context.registerVerifyAndLogin();
  await seedActiveBook({
    lastProgressIsoDate: daysAgo(8),
    title: "Other stalled",
    userId: other.userId,
  });
  await createBook({
    queuePosition: 1,
    queueTargetDate: today,
    readingStatus: "want_to_read",
    title: "Other queued",
    userId: other.userId,
  });
  await createBook({
    readingStatus: "want_to_read",
    title: "Other library",
    userId: other.userId,
  });
  await borrowOverdueBook(other);
}

async function seedQueue(): Promise<QueueBooks> {
  const reading = await createBook({
    queuePosition: 1,
    readingStatus: "reading",
    title: "Queue reading",
  });
  const lent = await createBook({
    ownershipStatus: "lent_to_someone",
    queuePosition: 2,
    readingStatus: "want_to_read",
    title: "Queue lent",
  });
  const eligible = await createBook({
    queuePosition: 3,
    readingStatus: "want_to_read",
    title: "Queue eligible",
  });
  const paused = await createBook({
    queuePosition: 4,
    readingStatus: "paused",
    title: "Queue paused",
  });
  return { eligible, lent, paused, reading };
}

async function startActiveCycle({
  bookId,
  userId,
}: {
  bookId: string;
  userId: string;
}): Promise<string> {
  const cycle = await prisma.bookReadingCycle.create({
    data: {
      bookId,
      startedAt: parseIsoDate(daysAgo(FIXTURE.cycleStartedDaysAgo)),
      state: READING_CYCLE_STATE.active,
      userId,
    },
    select: { id: true },
  });
  return cycle.id;
}

async function trash(bookId: string): Promise<void> {
  const res = await authorized(reader, request(app.getHttpServer()).delete(`/api/books/${bookId}`));
  expect(res.status).toBe(HttpStatus.OK);
}

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, HomeModule]);
  app = context.app;
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await context.close();
});

beforeEach(async () => {
  await truncateAllTables(app);
  context.reset();
  reader = await context.registerVerifyAndLogin();
  today = defaultUserToday();
});

describe("home endpoints authorization", () => {
  it.each(Object.values(HOME_ROUTES))(
    "returns 401 for %s without a bearer token",
    async (route) => {
      const res = await request(app.getHttpServer()).get(route);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    },
  );
});

describe("GET /api/home/reading", () => {
  it("returns the six most recently read books first with the total and a next cursor", async () => {
    await seedEightActiveBooks();

    const page = availableData((await readingView(reader)).currentlyReading);

    expect(page.items.map((book) => book.id)).toEqual([b8, b7, b6, b5, b4, b3]);
    expect(page.total).toBe(8);
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it("returns the remaining two books with no further cursor on the next page", async () => {
    await seedEightActiveBooks();
    const firstPage = availableData((await readingView(reader)).currentlyReading);
    if (firstPage.nextCursor === null) {
      throw new Error("first page has no next cursor");
    }

    const secondPage = await activeBooksPage(reader, firstPage.nextCursor);

    expect(secondPage.items.map((book) => book.id)).toEqual([b2, b1]);
    expect(secondPage.nextCursor).toBeNull();
    expect(secondPage.total).toBe(8);
  });

  it("covers every active book exactly once across both pages", async () => {
    await seedEightActiveBooks();
    const firstPage = availableData((await readingView(reader)).currentlyReading);
    if (firstPage.nextCursor === null) {
      throw new Error("first page has no next cursor");
    }
    const secondPage = await activeBooksPage(reader, firstPage.nextCursor);

    const seen = [...firstPage.items, ...secondPage.items].map((book) => book.id);

    expect(seen).toHaveLength(8);
    expect(new Set(seen)).toEqual(new Set(ACTIVE_BOOK_IDS));
  });

  it("orders by progress of the current cycle and ignores events outside it", async () => {
    const legacyEventBook = await seedActiveBook({
      id: "00000000-0000-4000-8000-0000000000d1",
      lastProgressIsoDate: daysAgo(6),
      title: "Legacy event yesterday",
    });
    await recordProgress({ bookId: legacyEventBook, cycleId: null, isoDate: daysAgo(1) });
    const currentCycleBook = await seedActiveBook({
      id: "00000000-0000-4000-8000-0000000000d2",
      lastProgressIsoDate: daysAgo(3),
      title: "Current cycle three days ago",
    });

    const page = availableData((await readingView(reader)).currentlyReading);

    expect(
      page.items.map((book) => ({ id: book.id, lastProgressAt: book.lastProgressAt })),
    ).toEqual([
      { id: currentCycleBook, lastProgressAt: daysAgo(3) },
      { id: legacyEventBook, lastProgressAt: daysAgo(6) },
    ]);
  });

  it("breaks equal progress dates by id", async () => {
    await seedActiveBook({ id: TIE_BOOK_IDS.higher, lastProgressIsoDate: daysAgo(2) });
    await seedActiveBook({ id: TIE_BOOK_IDS.lower, lastProgressIsoDate: daysAgo(2) });
    await seedActiveBook({ id: TIE_BOOK_IDS.newest, lastProgressIsoDate: daysAgo(1) });

    const page = availableData((await readingView(reader)).currentlyReading);

    expect(page.items.map((book) => book.id)).toEqual([
      TIE_BOOK_IDS.newest,
      TIE_BOOK_IDS.lower,
      TIE_BOOK_IDS.higher,
    ]);
  });

  it("never lists paused, finished or trashed books", async () => {
    const active = await seedActiveBook({ lastProgressIsoDate: daysAgo(1) });
    await createBook({ readingStatus: "paused", title: "Paused" });
    await createBook({ readingStatus: "finished", title: "Finished" });
    await createBook({ readingStatus: "reading", title: "Trashed", trashed: true });

    const page = availableData((await readingView(reader)).currentlyReading);

    expect(page.items.map((book) => book.id)).toEqual([active]);
    expect(page.total).toBe(1);
  });

  it("reports the reader's local day as today", async () => {
    const islander = await registerReaderInTimezone({
      context,
      timezone: FIXTURE.farEastTimezone,
    });
    const localToday = toZonedIsoDate({ instant: new Date(), timeZone: FIXTURE.farEastTimezone });

    const view = await readingView(islander);

    expect(view.today).toBe(localToday);
    expect(availableData(view.readingWeek).today).toBe(localToday);
  });

  it("reports a seven-day week that contains today", async () => {
    const week = availableData((await readingView(reader)).readingWeek);

    expect(week.days).toHaveLength(7);
    expect(week.days.map((day) => day.date)).toContain(today);
  });

  it("reports no primary goal when the reader has no goals", async () => {
    const goal = availableData((await readingView(reader)).readingGoal);

    expect(goal.primaryGoal).toBeNull();
  });

  it("makes the active goal with the nearest deadline primary", async () => {
    await createGoal({ deadline: daysAhead(40), name: "Middle" });
    const nearest = await createGoal({ deadline: daysAhead(20), name: "Nearest" });
    await createGoal({ deadline: daysAhead(60), name: "Farthest" });

    const goal = availableData((await readingView(reader)).readingGoal);

    expect(goal.primaryGoal).toMatchObject({
      deadline: daysAhead(20),
      goalId: nearest,
      name: "Nearest",
    });
  });
});

describe("GET /api/home/reading/books", () => {
  it("returns the first page for a malformed cursor", async () => {
    await seedEightActiveBooks();

    const page = await activeBooksPage(reader, "garbage");

    expect(page.items.map((book) => book.id)).toEqual([b8, b7, b6, b5, b4, b3]);
    expect(page.total).toBe(8);
  });
});

describe("GET /api/home/next-read", () => {
  it("starts with the first queue position that can be read now", async () => {
    const queue = await seedQueue();

    const [first] = (await nextReadView(reader)).candidates;

    expect(first).toMatchObject({
      book: { id: queue.eligible },
      queue: { position: 3 },
      reason: "queue_next",
      source: "queue",
    });
  });

  it("skips queued books that are being read or lent out", async () => {
    const queue = await seedQueue();

    const ids = (await nextReadView(reader)).candidates.map((candidate) => candidate.book.id);

    expect(ids).toContain(queue.eligible);
    expect(ids).not.toContain(queue.reading);
    expect(ids).not.toContain(queue.lent);
  });

  it("offers to resume a paused queued book", async () => {
    const queue = await seedQueue();

    const paused = (await nextReadView(reader)).candidates.find(
      (candidate) => candidate.book.id === queue.paused,
    );

    expect(paused).toMatchObject({ action: "resume", source: "queue" });
  });

  it("lists an unqueued planned library book after the queue candidates", async () => {
    const queue = await seedQueue();
    const library = await createBook({ readingStatus: "want_to_read", title: "Library planned" });

    const candidates = (await nextReadView(reader)).candidates;

    expect(
      candidates.map((candidate) => ({ id: candidate.book.id, source: candidate.source })),
    ).toEqual([
      { id: queue.eligible, source: "queue" },
      { id: queue.paused, source: "queue" },
      { id: library, source: "library" },
    ]);
  });

  it("returns ten unique candidates when more books are eligible", async () => {
    await seedQueue();
    for (let index = 1; index <= 12; index += 1) {
      await createBook({ readingStatus: "want_to_read", title: `Library ${index}` });
    }

    const ids = (await nextReadView(reader)).candidates.map((candidate) => candidate.book.id);

    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });

  it("leaves queue positions unchanged", async () => {
    await seedQueue();
    const before = await queueSnapshot();

    await nextReadView(reader);

    expect(await queueSnapshot()).toEqual(before);
  });
});

describe("GET /api/home/attention", () => {
  it("raises a high queue deadline for a queued book due today", async () => {
    const bookId = await createBook({
      queuePosition: 1,
      queueTargetDate: today,
      readingStatus: "want_to_read",
      title: "Book club pick",
    });

    const view = await attentionView(reader);

    expect(view.groups.filter((group) => group.reason === "queue_deadline")).toEqual([
      expect.objectContaining({ bookId, count: 1, severity: "high" }),
    ]);
  });

  it("raises a high overdue group for a borrowed book past its return date", async () => {
    await borrowOverdueBook(reader);

    const view = await attentionView(reader);

    expect(view.groups.filter((group) => group.reason === "loan_overdue")).toEqual([
      expect.objectContaining({
        count: 1,
        direction: "borrowed_from_someone",
        severity: "high",
      }),
    ]);
  });

  it("raises one low stale group for a book without progress for eight days", async () => {
    const bookId = await seedActiveBook({
      lastProgressIsoDate: daysAgo(8),
      title: "Stalled",
    });

    const view = await attentionView(reader);

    expect(view.groups.filter((group) => group.reason === "reading_stale")).toEqual([
      expect.objectContaining({ bookId, count: 1, severity: "low" }),
    ]);
  });

  it("sorts groups by severity with the stale reading last", async () => {
    await seedActiveBook({ lastProgressIsoDate: daysAgo(8), title: "Stalled" });
    await borrowOverdueBook(reader);
    await createBook({
      queuePosition: 1,
      queueTargetDate: today,
      readingStatus: "want_to_read",
      title: "Book club pick",
    });

    const view = await attentionView(reader);

    expect(view.groups.map((group) => group.severity)).toEqual(["high", "high", "low"]);
    expect(view.groups.at(-1)?.reason).toBe("reading_stale");
  });

  it("reports every source as available", async () => {
    await seedActiveBook({ lastProgressIsoDate: daysAgo(8), title: "Stalled" });
    await borrowOverdueBook(reader);

    const view = await attentionView(reader);

    expect(view.unavailableSources).toEqual([]);
  });
});

describe("home user isolation", () => {
  it("never lists another reader's active books on the reading row", async () => {
    const own = await seedActiveBook({ lastProgressIsoDate: today, title: "Mine" });
    await seedOtherReaderEverything();

    const page = availableData((await readingView(reader)).currentlyReading);

    expect(page.items.map((book) => book.id)).toEqual([own]);
    expect(page.total).toBe(1);
  });

  it("never recommends another reader's queued or library books", async () => {
    const own = await createBook({ readingStatus: "want_to_read", title: "Mine to read" });
    await seedOtherReaderEverything();

    const view = await nextReadView(reader);

    expect(view.candidates.map((candidate) => candidate.book.id)).toEqual([own]);
  });

  it("never raises attention for another reader's loans, queue or reading", async () => {
    await seedActiveBook({ lastProgressIsoDate: today, title: "Mine" });
    await seedOtherReaderEverything();

    const view = await attentionView(reader);

    expect(view.groups).toEqual([]);
  });
});

describe("trash round trip of an active book", () => {
  it("drops a trashed book from the reading row", async () => {
    const keeper = await seedActiveBook({ lastProgressIsoDate: daysAgo(2) });
    const trashed = await seedActiveBook({ lastProgressIsoDate: daysAgo(1) });

    await trash(trashed);
    const page = availableData((await readingView(reader)).currentlyReading);

    expect(page.items.map((book) => book.id)).toEqual([keeper]);
    expect(page.total).toBe(1);
  });

  it("brings a restored book back to the reading row", async () => {
    const keeper = await seedActiveBook({ lastProgressIsoDate: daysAgo(2) });
    const restored = await seedActiveBook({ lastProgressIsoDate: daysAgo(1) });
    await trash(restored);

    const res = await authorized(
      reader,
      request(app.getHttpServer()).post(`/api/books/${restored}/restore`),
    );
    const page = availableData((await readingView(reader)).currentlyReading);

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(page.items.map((book) => book.id)).toEqual([restored, keeper]);
  });
});
