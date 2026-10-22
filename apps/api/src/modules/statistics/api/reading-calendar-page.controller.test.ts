import type { INestApplication } from "@nestjs/common";

import { ReadingStatisticsCalendarPageSchema } from "@app/shared";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { StatisticsModule } from "../statistics.module.js";

const TODAY = toIsoDate(new Date());
const CURRENT_YEAR = Number(TODAY.slice(0, 4));
const LAST_YEAR = CURRENT_YEAR - 1;

const MARCH_READING = { isoDate: `${String(LAST_YEAR)}-03-14`, pagesRead: 42 } as const;

const INVALID_YEAR_QUERIES = [
  { name: "a year before 1900", query: { year: "1899" } },
  { name: "a non-numeric year", query: { year: "abc" } },
  { name: "a request without a year", query: {} },
] as const;

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reader: AuthenticatedUser;

function calendarPage(user: AuthenticatedUser, query: Record<string, string>) {
  return request(app.getHttpServer())
    .get("/api/statistics/calendar")
    .query(query)
    .set("Authorization", `Bearer ${user.accessToken}`);
}

async function createBook({ title, userId }: { title: string; userId: string }): Promise<string> {
  const book = await prisma.book.create({
    data: { pagesCount: 300, readingStatus: "reading", title, userId },
    select: { id: true },
  });
  return book.id;
}

async function fetchYear(user: AuthenticatedUser, year: number) {
  const response = await calendarPage(user, { year: String(year) });
  return ReadingStatisticsCalendarPageSchema.parse(response.body);
}

async function recordMarchReading(userId: string): Promise<void> {
  const bookId = await createBook({ title: "Dune", userId });
  await recordReading({
    bookId,
    isoDate: MARCH_READING.isoDate,
    page: MARCH_READING.pagesRead,
    pagesRead: MARCH_READING.pagesRead,
  });
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

describe("GET /api/statistics/calendar", () => {
  it("rejects an anonymous request with 401", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/statistics/calendar")
      .query({ year: String(CURRENT_YEAR) });

    expect(response.status).toBe(401);
  });

  describe("year validation", () => {
    it.each(INVALID_YEAR_QUERIES)("rejects $name with a field error on year", async ({ query }) => {
      const response = await calendarPage(reader, query);

      expect(response.status).toBe(400);
      expect(response.body.errorsMessages).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "year" })]),
      );
    });

    it("rejects the year after the current one with 400", async () => {
      const response = await calendarPage(reader, { year: String(CURRENT_YEAR + 1) });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("A reading calendar year cannot be in the future");
    });
  });

  describe("a past year with pages read on one March day", () => {
    beforeEach(async () => {
      await recordMarchReading(reader.userId);
    });

    it("returns 200 with a body matching the calendar page contract", async () => {
      const response = await calendarPage(reader, { year: String(LAST_YEAR) });

      expect(response.status).toBe(200);
      expect(ReadingStatisticsCalendarPageSchema.safeParse(response.body).success).toBe(true);
    });

    it("draws and measures January 1 to December 31 of that year", async () => {
      const page = await fetchYear(reader, LAST_YEAR);
      const fullYear = { from: `${String(LAST_YEAR)}-01-01`, to: `${String(LAST_YEAR)}-12-31` };

      expect({
        displayRange: page.calendar.displayRange,
        metricRange: page.calendar.metricRange,
      }).toEqual({ displayRange: fullYear, metricRange: fullYear });
    });

    it("shows the recorded pages on that day with a non-zero intensity", async () => {
      const page = await fetchYear(reader, LAST_YEAR);
      const day = page.calendar.days.find((entry) => entry.date === MARCH_READING.isoDate);

      expect(day?.pagesRead).toBe(MARCH_READING.pagesRead);
      expect(day?.intensity ?? 0).toBeGreaterThan(0);
    });

    it("reports the current streak as unavailable because the year is over", async () => {
      const page = await fetchYear(reader, LAST_YEAR);

      expect(page.calendar.currentStreak).toMatchObject({
        availability: "unavailable",
        reason: "PERIOD_NOT_CURRENT",
      });
    });

    it("offers every year from the first recorded progress to the current year", async () => {
      const page = await fetchYear(reader, LAST_YEAR);

      expect(page.availableYears).toEqual([LAST_YEAR, CURRENT_YEAR]);
    });
  });

  describe("the current year", () => {
    it("draws the calendar from January 1 to today", async () => {
      const page = await fetchYear(reader, CURRENT_YEAR);

      expect(page.calendar.displayRange).toEqual({
        from: `${String(CURRENT_YEAR)}-01-01`,
        to: TODAY,
      });
    });

    it("reports today in the reader's time zone", async () => {
      const page = await fetchYear(reader, CURRENT_YEAR);

      expect(page.today).toBe(TODAY);
    });
  });

  it("offers only the current year to a reader with no reading progress", async () => {
    const page = await fetchYear(reader, CURRENT_YEAR);

    expect(page.availableYears).toEqual([CURRENT_YEAR]);
  });

  describe("activity history quality", () => {
    it("is exact when reliable history starts on January 1 of the requested year", async () => {
      await trustActivityFrom(`${String(LAST_YEAR)}-01-01`);

      const page = await fetchYear(reader, LAST_YEAR);

      expect(page.meta.activityHistory.selectedPeriodQuality).toBe("exact");
    });

    it("is a legacy lower bound when reliable history starts after January 1", async () => {
      await trustActivityFrom(TODAY);

      const page = await fetchYear(reader, LAST_YEAR);

      expect(page.meta.activityHistory).toMatchObject({
        reason: "LEGACY_EVENTS_MAY_HAVE_BEEN_DELETED",
        selectedPeriodQuality: "legacy_lower_bound",
      });
    });
  });

  describe("another reader's history", () => {
    beforeEach(async () => {
      const other = await context.registerVerifyAndLogin({
        email: "other@example.com",
        nickname: "other",
      });
      await recordMarchReading(other.userId);
    });

    it("keeps their pages off the reader's calendar", async () => {
      const page = await fetchYear(reader, LAST_YEAR);
      const day = page.calendar.days.find((entry) => entry.date === MARCH_READING.isoDate);

      expect(day?.pagesRead).toBe(0);
    });

    it("does not offer the years of their history", async () => {
      const page = await fetchYear(reader, LAST_YEAR);

      expect(page.availableYears).toEqual([CURRENT_YEAR]);
    });
  });
});
