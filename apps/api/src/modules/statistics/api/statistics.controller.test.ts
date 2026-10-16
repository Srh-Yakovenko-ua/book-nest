import type { OwnershipStatus, ReadingStatus } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { ReadingDayDetailsSchema, ReadingStatisticsOverviewSchema } from "@app/shared";
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
import { FIRST_COMPLETION_RELIABILITY } from "../../books/index.js";
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
