import type { Nullable, OwnershipStatus, ReadingStatus, ValueOf } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import {
  ReadingDayDetailsSchema,
  ReadingStatisticsActivityPageSchema,
  ReadingStatisticsCompletedReadsPageSchema,
  ReadingStatisticsOverviewSchema,
} from "@app/shared";
import { addDays } from "date-fns";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { addDaysToIsoDate, parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { insertFinishedReadingCycle } from "../../../test/reading-cycles.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { FIRST_COMPLETION_RELIABILITY, READING_CYCLE_STATE } from "../../books/index.js";
import { rollingYearStart } from "../domain/statistics-period.js";
import { StatisticsModule } from "../statistics.module.js";

const TODAY = toIsoDate(new Date());
const YESTERDAY = addDaysToIsoDate(TODAY, -1);
const CURRENT_YEAR = Number(TODAY.slice(0, 4));

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reader: AuthenticatedUser;

async function createBook({
  genres = ["fantasy"],
  language = "ukrainian",
  ownershipStatus = "none",
  pagesCount = 300,
  readingStatus = "finished",
  title,
  userId,
}: {
  genres?: string[];
  language?: string;
  ownershipStatus?: OwnershipStatus;
  pagesCount?: number;
  readingStatus?: ReadingStatus;
  title: string;
  userId: string;
}): Promise<string> {
  const book = await prisma.book.create({
    data: { genres, language, ownershipStatus, pagesCount, readingStatus, title, userId },
    select: { id: true },
  });
  return book.id;
}

async function finishRead({
  bookId,
  finishedIsoDate,
  reliability,
}: {
  bookId: string;
  finishedIsoDate: string;
  reliability: (typeof FIRST_COMPLETION_RELIABILITY)[keyof typeof FIRST_COMPLETION_RELIABILITY];
}): Promise<void> {
  const cycleId = await insertFinishedReadingCycle(prisma, {
    bookId,
    finishedIsoDate,
    userId: reader.userId,
  });
  await prisma.bookReadingCycle.update({
    data: { firstCompletionReliability: reliability },
    where: { id: cycleId },
  });
}

function overview(user: AuthenticatedUser, query: Record<string, string> = {}) {
  return request(app.getHttpServer())
    .get("/api/statistics/overview")
    .query(query)
    .set("Authorization", `Bearer ${user.accessToken}`);
}

async function recordReading({
  bookId,
  isoDate,
  page,
  pagesRead,
}: {
  bookId: string;
  isoDate: string;
  page: number;
  pagesRead: number;
}): Promise<void> {
  await prisma.bookReadingProgressEvent.create({
    data: { bookId, date: parseIsoDate(isoDate), page, pagesRead },
  });
}

async function trustActivityFrom(isoDate: string): Promise<void> {
  await prisma.userReadingHistoryState.upsert({
    create: {
      activityReliableFrom: parseIsoDate(isoDate),
      cycleHistoryCutoverAt: new Date(),
      userId: reader.userId,
    },
    update: { activityReliableFrom: parseIsoDate(isoDate) },
    where: { userId: reader.userId },
  });
}

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, StatisticsModule]);
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
  await prisma.userProfileSettings.upsert({
    create: { timezone: "UTC", userId: reader.userId },
    update: { timezone: "UTC" },
    where: { userId: reader.userId },
  });
});

describe("GET /api/statistics/overview", () => {
  it("rejects an anonymous request", async () => {
    const response = await request(app.getHttpServer()).get("/api/statistics/overview");
    expect(response.status).toBe(401);
  });

  it("returns every section for a reader with no history at all", async () => {
    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });

    expect(response.status).toBe(200);
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);
    expect(parsed.kpis.completedReads.value).toBe(0);
    expect(parsed.kpis.completedReads.comparison).toBeNull();
    expect(parsed.calendar.activeDays).toBe(0);
    expect(parsed.calendar.days.every((day) => day.pagesRead === 0)).toBe(true);
    expect(parsed.hero.featuredInsight).toBeNull();
  });

  it("counts a reread as two completed reads of one book", async () => {
    const bookId = await createBook({ title: "Dune", userId: reader.userId });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: `${String(CURRENT_YEAR)}-03-01`,
      userId: reader.userId,
    });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: `${String(CURRENT_YEAR)}-08-01`,
      userId: reader.userId,
    });

    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.kpis.completedReads.value).toBe(2);
    expect(parsed.kpis.uniqueBooksCompleted.value).toBe(1);
    expect(parsed.hero.recentCompletedReads).toHaveLength(2);
  });

  it("keeps a completed read after the book is moved to trash", async () => {
    const bookId = await createBook({ title: "Trashed", userId: reader.userId });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: `${String(CURRENT_YEAR)}-05-01`,
      rating: 9,
      userId: reader.userId,
    });
    const trashedAt = new Date();
    await prisma.book.update({
      data: { deletedAt: trashedAt, purgeAt: addDays(trashedAt, TRASH_RETENTION.days) },
      where: { id: bookId },
    });

    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.kpis.completedReads.value).toBe(1);
    expect(parsed.hero.recentCompletedReads[0]?.book.bookState).toBe("soft_deleted");
    expect(parsed.libraryBalance.currentOwnedTotal).toBe(0);
  });

  it("reads the completed metadata from the snapshot, not from the book as it is now", async () => {
    const bookId = await createBook({
      genres: ["fantasy"],
      title: "Snapshot",
      userId: reader.userId,
    });
    await prisma.bookReadingCycle.create({
      data: {
        bookId,
        completionMetadata: {
          authors: [],
          book: { genres: ["scifi"], language: "english", pagesCount: 500, title: "Snapshot" },
          provenance: "tracked_at_completion",
          publisher: null,
          series: null,
          version: 1,
        },
        finishedAt: parseIsoDate(`${String(CURRENT_YEAR)}-04-01`),
        state: "finished",
        userId: reader.userId,
      },
    });
    await prisma.book.update({ data: { genres: ["horror"] }, where: { id: bookId } });

    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.genres.frequency.map((entry) => entry.genreKey)).toEqual(["scifi"]);
    expect(parsed.languages.items.map((entry) => entry.language)).toEqual(["english"]);
  });

  it("keeps another reader's history out of the response", async () => {
    const other = await context.registerVerifyAndLogin({
      email: "other@example.com",
      nickname: "other",
    });
    const bookId = await createBook({ title: "Theirs", userId: other.userId });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: `${String(CURRENT_YEAR)}-04-01`,
      userId: other.userId,
    });
    await recordReading({ bookId, isoDate: TODAY, page: 10, pagesRead: 10 });

    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.kpis.completedReads.value).toBe(0);
    expect(parsed.kpis.pagesRead.value).toBe(0);
  });

  it("says the current streak does not apply to a period that already ended", async () => {
    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR - 1) });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.calendar.currentStreak).toMatchObject({
      availability: "unavailable",
      data: null,
    });
  });

  it("rejects a period that reaches into the future", async () => {
    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR + 1) });
    expect(response.status).toBe(400);
  });

  it("rejects a comparison against all time", async () => {
    const response = await overview(reader, { compare: "previous_period", period: "all_time" });
    expect(response.status).toBe(400);
  });

  it("rejects a reversed custom range", async () => {
    const response = await overview(reader, {
      from: `${String(CURRENT_YEAR)}-08-10`,
      period: "custom",
      to: `${String(CURRENT_YEAR)}-08-01`,
    });
    expect(response.status).toBe(400);
  });

  it("compares a period with the one before it", async () => {
    const bookId = await createBook({ title: "Compared", userId: reader.userId });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: TODAY,
      userId: reader.userId,
    });

    const response = await overview(reader, {
      compare: "previous_period",
      from: TODAY,
      period: "custom",
      to: TODAY,
    });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.comparison).toEqual({
      from: YESTERDAY,
      mode: "previous_period",
      to: YESTERDAY,
    });
    expect(parsed.kpis.completedReads.comparison).toEqual({
      absoluteDelta: 1,
      percentDelta: null,
      previous: 0,
    });
  });

  it("compares activity only when the history of both periods is reliable", async () => {
    await trustActivityFrom(TODAY);
    const bookId = await createBook({ title: "Paced", userId: reader.userId });
    await recordReading({ bookId, isoDate: YESTERDAY, page: 10, pagesRead: 10 });
    await recordReading({ bookId, isoDate: TODAY, page: 40, pagesRead: 30 });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: TODAY,
      userId: reader.userId,
    });
    const query = { compare: "previous_period", from: TODAY, period: "custom", to: TODAY };

    const partial = ReadingStatisticsOverviewSchema.parse((await overview(reader, query)).body);
    expect(partial.kpis.pagesRead.comparison).toBeNull();
    expect(partial.kpis.activeDays.countComparison).toBeNull();
    expect(partial.kpis.activeDays.rateComparison).toBeNull();
    expect(partial.kpis.completedReads.comparison).not.toBeNull();

    await trustActivityFrom(YESTERDAY);
    const exact = ReadingStatisticsOverviewSchema.parse((await overview(reader, query)).body);
    expect(exact.kpis.pagesRead.comparison).toEqual({
      absoluteDelta: 20,
      percentDelta: 200,
      previous: 10,
    });
    expect(exact.kpis.activeDays.countComparison).toEqual({
      absoluteDelta: 0,
      percentDelta: 0,
      previous: 1,
    });
  });

  it("drops the pages peak for a period whose history is not reliable", async () => {
    await trustActivityFrom(TODAY);
    const bookId = await createBook({ title: "Peaked", userId: reader.userId });
    await recordReading({ bookId, isoDate: TODAY, page: 30, pagesRead: 30 });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: TODAY,
      userId: reader.userId,
    });

    const partial = ReadingStatisticsOverviewSchema.parse(
      (await overview(reader, { from: YESTERDAY, period: "custom", to: TODAY })).body,
    );
    expect(partial.dynamics.peakPagesRead).toBeNull();
    expect(partial.dynamics.peakCompletedReads?.completedReads).toBe(1);

    const exact = ReadingStatisticsOverviewSchema.parse(
      (await overview(reader, { from: TODAY, period: "custom", to: TODAY })).body,
    );
    expect(exact.dynamics.peakPagesRead?.pagesRead).toBe(30);
  });

  it("counts a book on a calendar day only when its pages for the day add up above zero", async () => {
    const [read, idle, undone] = await Promise.all([
      createBook({ title: "Read", userId: reader.userId }),
      createBook({ title: "Idle", userId: reader.userId }),
      createBook({ title: "Undone", userId: reader.userId }),
    ]);
    await recordReading({ bookId: read, isoDate: TODAY, page: 20, pagesRead: 20 });
    await recordReading({ bookId: idle, isoDate: TODAY, page: 0, pagesRead: 0 });
    await recordReading({ bookId: undone, isoDate: TODAY, page: 15, pagesRead: 15 });
    await recordReading({ bookId: undone, isoDate: TODAY, page: 0, pagesRead: -15 });

    const response = await overview(reader, { from: TODAY, period: "custom", to: TODAY });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);
    const day = parsed.calendar.days.find((calendarDay) => calendarDay.date === TODAY);

    expect(day?.pagesRead).toBe(20);
    expect(day?.booksCount).toBe(1);
    expect(day?.remainingBooksCount).toBe(0);
  });

  it("shows the last twelve months of an all-time calendar and measures all of it", async () => {
    const bookId = await createBook({ title: "Long haul", userId: reader.userId });
    const earliest = addDaysToIsoDate(TODAY, -800);
    await recordReading({ bookId, isoDate: earliest, page: 10, pagesRead: 10 });
    await recordReading({ bookId, isoDate: TODAY, page: 20, pagesRead: 10 });

    const response = await overview(reader, { period: "all_time" });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.calendar.metricRange).toEqual({ from: earliest, to: TODAY });
    expect(parsed.calendar.displayRange).toEqual({ from: rollingYearStart(TODAY), to: TODAY });
    expect(parsed.calendar.days.filter((day) => day.pagesRead > 0)).toHaveLength(1);
    expect(parsed.calendar.weekdayActivity.items.map((item) => item.weekday)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(
      parsed.calendar.weekdayActivity.items.reduce((total, item) => total + item.activeDays, 0),
    ).toBe(2);
  });

  it("balances the library over owned and lent books only", async () => {
    const shelf: { ownershipStatus: OwnershipStatus; readingStatus: ReadingStatus }[] = [
      { ownershipStatus: "owned", readingStatus: "finished" },
      { ownershipStatus: "lent_to_someone", readingStatus: "rereading" },
      { ownershipStatus: "owned", readingStatus: "reading" },
      { ownershipStatus: "owned", readingStatus: "paused" },
      { ownershipStatus: "lent_to_someone", readingStatus: "dnf" },
      { ownershipStatus: "owned", readingStatus: "want_to_read" },
      { ownershipStatus: "borrowed_from_someone", readingStatus: "not_started" },
    ];
    await Promise.all(
      shelf.map((book) =>
        createBook({ ...book, title: book.readingStatus, userId: reader.userId }),
      ),
    );

    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.libraryBalance.currentOwnedTotal).toBe(6);
    expect(parsed.libraryBalance.currentTbrCount).toBe(4);
    expect(parsed.libraryBalance.readRatio).toBeCloseTo(2 / 6);
  });

  it("forecasts from proven first reads of the owned library whatever the period", async () => {
    const [reread, second, third, borrowed] = await Promise.all([
      createBook({ ownershipStatus: "owned", title: "Reread", userId: reader.userId }),
      createBook({ ownershipStatus: "owned", title: "Second", userId: reader.userId }),
      createBook({ ownershipStatus: "lent_to_someone", title: "Third", userId: reader.userId }),
      createBook({ ownershipStatus: "borrowed_from_someone", title: "Lib", userId: reader.userId }),
      createBook({
        ownershipStatus: "owned",
        readingStatus: "want_to_read",
        title: "Next",
        userId: reader.userId,
      }),
      createBook({
        ownershipStatus: "owned",
        readingStatus: "not_started",
        title: "Later",
        userId: reader.userId,
      }),
    ]);
    const { notFirst, provenFirst } = FIRST_COMPLETION_RELIABILITY;
    const firstReads = [
      { bookId: reread, daysAgo: 90 },
      { bookId: second, daysAgo: 60 },
      { bookId: third, daysAgo: 30 },
      { bookId: borrowed, daysAgo: 20 },
    ];
    await Promise.all(
      firstReads.map((firstRead) =>
        finishRead({
          bookId: firstRead.bookId,
          finishedIsoDate: addDaysToIsoDate(TODAY, -firstRead.daysAgo),
          reliability: provenFirst,
        }),
      ),
    );
    await finishRead({ bookId: reread, finishedIsoDate: TODAY, reliability: notFirst });

    const response = await overview(reader, { from: TODAY, period: "custom", to: TODAY });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.libraryBalance.forecast).toEqual({
      availability: "available",
      data: { monthsRemaining: 8, readsPerMonth: 0.25 },
    });
  });

  it("withholds the forecast while a first read of the last twelve months is unresolved", async () => {
    const titles = ["First", "Second", "Third", "Legacy"];
    const bookIds = await Promise.all(
      titles.map((title) => createBook({ ownershipStatus: "owned", title, userId: reader.userId })),
    );
    const { firstKnownOnly, provenFirst } = FIRST_COMPLETION_RELIABILITY;
    await Promise.all(
      bookIds.map((bookId, position) =>
        finishRead({
          bookId,
          finishedIsoDate: addDaysToIsoDate(TODAY, -(position + 1) * 10),
          reliability: position === titles.length - 1 ? firstKnownOnly : provenFirst,
        }),
      ),
    );

    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.libraryBalance.forecast).toEqual({
      availability: "unavailable",
      data: null,
      reason: "LEGACY_HISTORY_INCOMPLETE",
    });
  });

  it("keeps a completed read on its own date after the reader moves timezone", async () => {
    const bookId = await createBook({ title: "Stable", userId: reader.userId });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: `${String(CURRENT_YEAR)}-05-01`,
      userId: reader.userId,
    });
    await recordReading({
      bookId,
      isoDate: `${String(CURRENT_YEAR)}-05-01`,
      page: 40,
      pagesRead: 40,
    });

    const before = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });
    await prisma.userProfileSettings.upsert({
      create: { timezone: "Pacific/Auckland", userId: reader.userId },
      update: { timezone: "Pacific/Auckland" },
      where: { userId: reader.userId },
    });
    const after = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });

    const dayOf = (response: { body: unknown }): unknown =>
      ReadingStatisticsOverviewSchema.parse(response.body).calendar.days.find(
        (day) => day.date === `${String(CURRENT_YEAR)}-05-01`,
      )?.pagesRead;

    expect(dayOf(before)).toBe(40);
    expect(dayOf(after)).toBe(40);
    expect(
      ReadingStatisticsOverviewSchema.parse(after.body).hero.recentCompletedReads[0]?.finishedAt,
    ).toBe(`${String(CURRENT_YEAR)}-05-01`);
  });

  it("carries the reader's own timezone and week start into the response", async () => {
    await prisma.userProfileSettings.upsert({
      create: { timezone: "America/New_York", userId: reader.userId, weekStartDay: "sunday" },
      update: { timezone: "America/New_York", weekStartDay: "sunday" },
      where: { userId: reader.userId },
    });

    const response = await overview(reader, { period: "last_12_months" });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.meta.timezone).toBe("America/New_York");
    expect(parsed.meta.weekStartDay).toBe("sunday");
  });
});

describe("GET /api/statistics/reading-days/:date", () => {
  it("returns every book read on the day, largest first", async () => {
    const first = await createBook({ title: "First", userId: reader.userId });
    const second = await createBook({ title: "Second", userId: reader.userId });
    await recordReading({ bookId: first, isoDate: TODAY, page: 20, pagesRead: 20 });
    await recordReading({ bookId: second, isoDate: TODAY, page: 60, pagesRead: 60 });

    const response = await request(app.getHttpServer())
      .get(`/api/statistics/reading-days/${TODAY}`)
      .set("Authorization", `Bearer ${reader.accessToken}`);

    expect(response.status).toBe(200);
    const parsed = ReadingDayDetailsSchema.parse(response.body);
    expect(parsed.pagesRead).toBe(80);
    expect(parsed.books.map((book) => book.title)).toEqual(["Second", "First"]);
  });

  it("rejects a malformed date", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/statistics/reading-days/not-a-date")
      .set("Authorization", `Bearer ${reader.accessToken}`);
    expect(response.status).toBe(400);
  });
});

const LAST_YEAR = String(CURRENT_YEAR - 1);

const MARCH = { from: `${LAST_YEAR}-03-01`, to: `${LAST_YEAR}-03-31` } as const;

function intervalDetails(
  path: "completed-reads" | "reading-activity",
  user: AuthenticatedUser,
  query: Record<string, string>,
) {
  return request(app.getHttpServer())
    .get(`/api/statistics/${path}`)
    .query(query)
    .set("Authorization", `Bearer ${user.accessToken}`);
}

async function marchBucket() {
  const response = await overview(reader, { period: "year", year: LAST_YEAR });
  const parsed = ReadingStatisticsOverviewSchema.parse(response.body);
  return parsed.dynamics.buckets.find((bucket) => bucket.start === MARCH.from);
}

describe("GET /api/statistics/completed-reads and /reading-activity", () => {
  it.each(["completed-reads", "reading-activity"] as const)(
    "rejects an anonymous request to %s",
    async (path) => {
      const response = await request(app.getHttpServer())
        .get(`/api/statistics/${path}`)
        .query(MARCH);
      expect(response.status).toBe(401);
    },
  );

  it.each([
    ["a reversed range", { from: MARCH.to, to: MARCH.from }],
    [
      "a range longer than a year",
      { from: `${LAST_YEAR}-01-01`, to: `${String(CURRENT_YEAR)}-02-01` },
    ],
    ["a malformed date", { from: "2026-13-01", to: MARCH.to }],
    ["a missing bound", { from: MARCH.from }],
    ["an empty page", { ...MARCH, limit: "0" }],
    ["an oversized page", { ...MARCH, limit: "51" }],
    ["a forged cursor", { ...MARCH, cursor: "not-a-cursor" }],
  ])("rejects %s on both endpoints", async (_, query) => {
    const [reads, activity] = await Promise.all([
      intervalDetails("completed-reads", reader, query),
      intervalDetails("reading-activity", reader, query),
    ]);

    expect(reads.status).toBe(400);
    expect(activity.status).toBe(400);
  });
});

describe("GET /api/statistics/completed-reads", () => {
  it("lists every cycle finished in the bucket, rereads apart and trashed books kept", async () => {
    const reread = await createBook({ title: "Reread", userId: reader.userId });
    const trashed = await createBook({ title: "Trashed", userId: reader.userId });
    for (const finishedIsoDate of [`${LAST_YEAR}-03-05`, `${LAST_YEAR}-03-20`]) {
      await insertFinishedReadingCycle(prisma, {
        bookId: reread,
        finishedIsoDate,
        userId: reader.userId,
      });
    }
    await insertFinishedReadingCycle(prisma, {
      bookId: trashed,
      finishedIsoDate: `${LAST_YEAR}-03-10`,
      rating: 8,
      userId: reader.userId,
    });
    await insertFinishedReadingCycle(prisma, {
      bookId: reread,
      finishedIsoDate: `${LAST_YEAR}-04-01`,
      userId: reader.userId,
    });
    const trashedAt = new Date();
    await prisma.book.update({
      data: { deletedAt: trashedAt, purgeAt: addDays(trashedAt, TRASH_RETENTION.days) },
      where: { id: trashed },
    });

    const response = await intervalDetails("completed-reads", reader, MARCH);

    expect(response.status).toBe(200);
    const page = ReadingStatisticsCompletedReadsPageSchema.parse(response.body);
    expect(page.items.map((item) => [item.finishedAt, item.book.title])).toEqual([
      [`${LAST_YEAR}-03-20`, "Reread"],
      [`${LAST_YEAR}-03-10`, "Trashed"],
      [`${LAST_YEAR}-03-05`, "Reread"],
    ]);
    expect(new Set(page.items.map((item) => item.readingCycleId)).size).toBe(3);
    expect(page.items[1]).toMatchObject({ book: { bookState: "soft_deleted" }, rating: 8 });
    expect(page.totalCount).toBe(3);
    expect(page.nextCursor).toBeNull();
    expect((await marchBucket())?.completedReads).toBe(page.totalCount);
  });

  it("pages through the bucket without repeating or skipping a cycle", async () => {
    const bookId = await createBook({ title: "Series", userId: reader.userId });
    for (const day of ["03", "12", "12", "25"]) {
      await insertFinishedReadingCycle(prisma, {
        bookId,
        finishedIsoDate: `${LAST_YEAR}-03-${day}`,
        userId: reader.userId,
      });
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
      const response = await intervalDetails("completed-reads", reader, {
        ...MARCH,
        limit: "1",
        ...(cursor === undefined ? {} : { cursor }),
      });
      const page = ReadingStatisticsCompletedReadsPageSchema.parse(response.body);
      seen.push(...page.items.map((item) => item.readingCycleId));
      cursor = page.nextCursor ?? undefined;
      if (page.nextCursor === null) break;
    }

    expect(seen).toHaveLength(4);
    expect(new Set(seen).size).toBe(4);
    expect(cursor).toBeUndefined();
  });

  it("keeps another reader's cycles out of the bucket", async () => {
    const other = await context.registerVerifyAndLogin({
      email: "other@example.com",
      nickname: "other",
    });
    const bookId = await createBook({ title: "Theirs", userId: other.userId });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: `${LAST_YEAR}-03-15`,
      userId: other.userId,
    });

    const mine = ReadingStatisticsCompletedReadsPageSchema.parse(
      (await intervalDetails("completed-reads", reader, MARCH)).body,
    );
    const theirs = ReadingStatisticsCompletedReadsPageSchema.parse(
      (await intervalDetails("completed-reads", other, MARCH)).body,
    );

    expect(mine).toMatchObject({ items: [], totalCount: 0 });
    expect(theirs.totalCount).toBe(1);
  });
});

describe("GET /api/statistics/reading-activity", () => {
  it("lists the recorded pages per day and book, matching the bucket even with no finished book", async () => {
    await trustActivityFrom(`${LAST_YEAR}-01-01`);
    const first = await createBook({ title: "First", userId: reader.userId });
    const second = await createBook({ title: "Second", userId: reader.userId });
    await recordReading({ bookId: first, isoDate: `${LAST_YEAR}-03-02`, page: 10, pagesRead: 10 });
    await recordReading({ bookId: first, isoDate: `${LAST_YEAR}-03-02`, page: 20, pagesRead: 10 });
    await recordReading({ bookId: second, isoDate: `${LAST_YEAR}-03-02`, page: 50, pagesRead: 50 });
    await recordReading({ bookId: first, isoDate: `${LAST_YEAR}-03-15`, page: 50, pagesRead: 30 });
    await recordReading({
      bookId: second,
      isoDate: `${LAST_YEAR}-04-01`,
      page: 149,
      pagesRead: 99,
    });

    const response = await intervalDetails("reading-activity", reader, MARCH);

    expect(response.status).toBe(200);
    const page = ReadingStatisticsActivityPageSchema.parse(response.body);
    expect(page.items.map((item) => [item.date, item.book.title, item.pagesRead])).toEqual([
      [`${LAST_YEAR}-03-15`, "First", 30],
      [`${LAST_YEAR}-03-02`, "Second", 50],
      [`${LAST_YEAR}-03-02`, "First", 20],
    ]);
    expect(page).toMatchObject({
      activeDays: 2,
      booksCount: 2,
      historyQuality: "exact",
      nextCursor: null,
      pagesRead: 100,
    });
    const bucket = await marchBucket();
    expect(bucket?.pagesRead).toBe(page.pagesRead);
    expect(bucket?.completedReads).toBe(0);
  });

  it("labels a bucket that starts before the reliable history as observed only", async () => {
    await trustActivityFrom(`${LAST_YEAR}-03-10`);
    const bookId = await createBook({ title: "Legacy", userId: reader.userId });
    await recordReading({ bookId, isoDate: `${LAST_YEAR}-03-12`, page: 40, pagesRead: 40 });

    const page = ReadingStatisticsActivityPageSchema.parse(
      (await intervalDetails("reading-activity", reader, MARCH)).body,
    );

    expect(page).toMatchObject({
      historyQuality: "legacy_observed_only",
      pagesRead: 40,
      reliableFrom: `${LAST_YEAR}-03-10`,
    });
  });

  it("pages through the contributions without repeating or skipping one", async () => {
    await trustActivityFrom(`${LAST_YEAR}-01-01`);
    const first = await createBook({ title: "First", userId: reader.userId });
    const second = await createBook({ title: "Second", userId: reader.userId });
    await recordReading({ bookId: first, isoDate: `${LAST_YEAR}-03-02`, page: 25, pagesRead: 25 });
    await recordReading({ bookId: second, isoDate: `${LAST_YEAR}-03-02`, page: 25, pagesRead: 25 });
    await recordReading({ bookId: first, isoDate: `${LAST_YEAR}-03-09`, page: 40, pagesRead: 15 });

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
      const response = await intervalDetails("reading-activity", reader, {
        ...MARCH,
        limit: "1",
        ...(cursor === undefined ? {} : { cursor }),
      });
      const page = ReadingStatisticsActivityPageSchema.parse(response.body);
      expect(page.pagesRead).toBe(65);
      seen.push(...page.items.map((item) => `${item.date}:${item.book.bookId}`));
      cursor = page.nextCursor ?? undefined;
    }

    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(3);
    expect(cursor).toBeUndefined();
  });

  it("keeps another reader's pages out of the bucket", async () => {
    const other = await context.registerVerifyAndLogin({
      email: "other@example.com",
      nickname: "other",
    });
    const bookId = await createBook({ title: "Theirs", userId: other.userId });
    await recordReading({ bookId, isoDate: `${LAST_YEAR}-03-02`, page: 70, pagesRead: 70 });

    const page = ReadingStatisticsActivityPageSchema.parse(
      (await intervalDetails("reading-activity", reader, MARCH)).body,
    );

    expect(page).toMatchObject({ activeDays: 0, booksCount: 0, items: [], pagesRead: 0 });
  });
});

describe("GET /api/statistics/overview discoveries against reads before the period", () => {
  type DiscoveriesSummary = {
    authorId: Nullable<string>;
    genreKey: Nullable<string>;
    newAuthorsCount: number;
    newGenresCount: number;
    newPublishersCount: number;
    publisherId: Nullable<string>;
  };

  type SnapshotAuthor = { authorId: string; name: string };

  type SnapshotPublisher = { name: string; publisherId: string };

  const DISCOVERY = {
    authors: {
      alpha: { authorId: "d1000000-0000-4000-8000-000000000001", name: "Alpha Author" },
      beta: { authorId: "d1000000-0000-4000-8000-000000000002", name: "Beta Author" },
      gamma: { authorId: "d1000000-0000-4000-8000-000000000003", name: "Gamma Author" },
    },
    period: { period: "year", year: "2024" },
    publishers: {
      north: { name: "North Press", publisherId: "e1000000-0000-4000-8000-000000000001" },
      south: { name: "South Press", publisherId: "e1000000-0000-4000-8000-000000000002" },
    },
  } as const;

  async function discoveriesOfThePeriod(): Promise<DiscoveriesSummary> {
    const response = await overview(reader, DISCOVERY.period);
    expect(response.status).toBe(200);
    const { discoveries } = ReadingStatisticsOverviewSchema.parse(response.body);
    return {
      authorId: discoveries.author?.authorId ?? null,
      genreKey: discoveries.genre?.genreKey ?? null,
      newAuthorsCount: discoveries.newAuthorsCount,
      newGenresCount: discoveries.newGenresCount,
      newPublishersCount: discoveries.newPublishersCount,
      publisherId: discoveries.publisher?.publisherId ?? null,
    };
  }

  async function seedRead({
    authors = [],
    finishedAt,
    genres = [],
    publisher = null,
    reliability = FIRST_COMPLETION_RELIABILITY.provenFirst,
    state = READING_CYCLE_STATE.finished,
    userId = reader.userId,
  }: {
    authors?: SnapshotAuthor[];
    finishedAt: string;
    genres?: string[];
    publisher?: Nullable<SnapshotPublisher>;
    reliability?: Nullable<ValueOf<typeof FIRST_COMPLETION_RELIABILITY>>;
    state?: ValueOf<typeof READING_CYCLE_STATE>;
    userId?: string;
  }): Promise<void> {
    const title = `Finished on ${finishedAt}`;
    const bookId = await createBook({ genres: [], title, userId });
    await prisma.bookReadingCycle.create({
      data: {
        bookId,
        completionMetadata: {
          authors,
          book: { genres, language: "english", pagesCount: 300, title },
          provenance: "tracked_at_completion",
          publisher,
          series: null,
          version: 1,
        },
        finishedAt: parseIsoDate(finishedAt),
        firstCompletionReliability: reliability,
        state,
        userId,
      },
    });
  }

  it("leaves out what was met the day before the period and finds what is first met on its first day", async () => {
    const { alpha, beta } = DISCOVERY.authors;
    const { north, south } = DISCOVERY.publishers;
    await seedRead({
      authors: [alpha],
      finishedAt: "2023-12-31",
      genres: ["fantasy"],
      publisher: north,
    });
    await seedRead({
      authors: [alpha],
      finishedAt: "2024-02-01",
      genres: ["fantasy"],
      publisher: north,
    });
    await seedRead({
      authors: [beta],
      finishedAt: "2024-01-01",
      genres: ["scifi"],
      publisher: south,
    });

    expect(await discoveriesOfThePeriod()).toEqual({
      authorId: beta.authorId,
      genreKey: "scifi",
      newAuthorsCount: 1,
      newGenresCount: 1,
      newPublishersCount: 1,
      publisherId: south.publisherId,
    });
  });

  it("ignores earlier reads that are another reader's, not finished or not proven first", async () => {
    const other = await context.registerVerifyAndLogin({
      email: "other@example.com",
      nickname: "other",
    });
    const fantasyByAlphaAtNorth = {
      authors: [DISCOVERY.authors.alpha],
      genres: ["fantasy"],
      publisher: DISCOVERY.publishers.north,
    };
    await seedRead({
      ...fantasyByAlphaAtNorth,
      finishedAt: "2023-03-01",
      reliability: FIRST_COMPLETION_RELIABILITY.firstKnownOnly,
    });
    await seedRead({
      ...fantasyByAlphaAtNorth,
      finishedAt: "2023-04-01",
      reliability: FIRST_COMPLETION_RELIABILITY.notFirst,
    });
    await seedRead({ ...fantasyByAlphaAtNorth, finishedAt: "2023-05-01", reliability: null });
    await seedRead({
      ...fantasyByAlphaAtNorth,
      finishedAt: "2023-06-01",
      state: READING_CYCLE_STATE.abandoned,
    });
    await seedRead({ ...fantasyByAlphaAtNorth, finishedAt: "2023-07-01", userId: other.userId });
    await seedRead({ ...fantasyByAlphaAtNorth, finishedAt: "2024-03-01" });

    expect(await discoveriesOfThePeriod()).toEqual({
      authorId: DISCOVERY.authors.alpha.authorId,
      genreKey: "fantasy",
      newAuthorsCount: 1,
      newGenresCount: 1,
      newPublishersCount: 1,
      publisherId: DISCOVERY.publishers.north.publisherId,
    });
  });

  it("treats both authors and both genres of an earlier co-authored multi-genre read as met", async () => {
    const { alpha, beta, gamma } = DISCOVERY.authors;
    const { north } = DISCOVERY.publishers;
    await seedRead({
      authors: [alpha, beta],
      finishedAt: "2023-06-15",
      genres: ["fantasy", "scifi"],
      publisher: north,
    });
    await seedRead({
      authors: [alpha, beta, gamma],
      finishedAt: "2024-03-01",
      genres: ["fantasy", "scifi", "horror"],
      publisher: north,
    });

    expect(await discoveriesOfThePeriod()).toEqual({
      authorId: gamma.authorId,
      genreKey: "horror",
      newAuthorsCount: 1,
      newGenresCount: 1,
      newPublishersCount: 0,
      publisherId: null,
    });
  });

  it("treats an earlier read's authors, genres and publisher as met even when its other lists are empty", async () => {
    const { alpha, gamma } = DISCOVERY.authors;
    const { north } = DISCOVERY.publishers;
    await seedRead({ authors: [alpha], finishedAt: "2023-04-01" });
    await seedRead({ finishedAt: "2023-05-01", genres: ["fantasy"] });
    await seedRead({ finishedAt: "2023-06-01", publisher: north });
    await seedRead({
      authors: [alpha, gamma],
      finishedAt: "2024-03-01",
      genres: ["fantasy", "horror"],
      publisher: north,
    });

    expect(await discoveriesOfThePeriod()).toEqual({
      authorId: gamma.authorId,
      genreKey: "horror",
      newAuthorsCount: 1,
      newGenresCount: 1,
      newPublishersCount: 0,
      publisherId: null,
    });
  });
});
