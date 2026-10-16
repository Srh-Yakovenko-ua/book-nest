import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { TimelineModule } from "../timeline.module.js";

type LocationUsageResult = {
  count: number;
  location: string;
};

type TrashOption = { trashed?: boolean };

const TRASH_STAMPS = {
  deletedAt: new Date("2026-01-01T00:00:00.000Z"),
  purgeAt: new Date("2026-02-01T00:00:00.000Z"),
} as const;

function trashStamps({ trashed }: TrashOption): {
  deletedAt: Nullable<Date>;
  purgeAt: Nullable<Date>;
} {
  return trashed === true ? TRASH_STAMPS : { deletedAt: null, purgeAt: null };
}

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let eventOrder = 0;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, TimelineModule]);
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  context.reset();
  eventOrder = 0;
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function createBook(
  userId: string,
  options: TrashOption & { seriesId?: string } = {},
): Promise<string> {
  const book = await prisma.book.create({
    data: {
      firstAuthorName: "",
      readingStatus: "not_started",
      seriesId: options.seriesId ?? null,
      title: `Book ${randomUUID()}`,
      userId,
      ...trashStamps(options),
    },
  });
  return book.id;
}

async function createBookWithEvents(
  userId: string,
  locations: Nullable<string>[],
  options: TrashOption & { seriesId?: string } = {},
): Promise<string> {
  const bookId = await createBook(userId, options);
  await createEvents(bookId, await createTimeline(bookId), locations);
  return bookId;
}

async function createEvents(
  bookId: string,
  timelineId: string,
  locations: Nullable<string>[],
): Promise<void> {
  for (const location of locations) {
    eventOrder += 1;
    await prisma.bookTimelineEvent.create({
      data: {
        bookId,
        bookOrder: eventOrder,
        location,
        timelineId,
        timelineOrder: eventOrder,
        title: `event ${eventOrder}`,
      },
    });
  }
}

async function createSeries(userId: string, options: TrashOption = {}): Promise<string> {
  const name = `Series ${randomUUID()}`;
  const series = await prisma.series.create({
    data: { name, normalizedName: name.toLowerCase(), userId, ...trashStamps(options) },
  });
  return series.id;
}

async function createTimeline(bookId: string, options: TrashOption = {}): Promise<string> {
  const timeline = await prisma.bookTimeline.create({
    data: {
      bookId,
      colorKey: "sky",
      isDefault: options.trashed !== true,
      name: `Timeline ${randomUUID()}`,
      position: options.trashed === true ? 2 : 1,
      ...trashStamps(options),
    },
  });
  return timeline.id;
}

function getLocations(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${bookId}/timeline/locations`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function registerStranger(): ReturnType<AuthTestContext["registerVerifyAndLogin"]> {
  return context.registerVerifyAndLogin({ email: "stranger@example.com", nickname: "stranger" });
}

describe("GET /api/books/:bookId/timeline/locations access", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/books/${randomUUID()}/timeline/locations`,
    );

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("returns 400 when the book id is not a UUID", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getLocations(accessToken, "not-a-uuid");

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("returns 404 with the timeline book-not-found code for another user's book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await registerStranger();
    const foreignBookId = await createBookWithEvents(stranger.userId, ["Kyiv"]);

    const res = await getLocations(owner.accessToken, foreignBookId);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("timeline_book_not_found");
  });

  it("returns 404 with the timeline book-not-found code for a trashed book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const trashedBookId = await createBookWithEvents(userId, ["Kyiv"], { trashed: true });

    const res = await getLocations(accessToken, trashedBookId);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("timeline_book_not_found");
  });
});

describe("GET /api/books/:bookId/timeline/locations for a book without a series", () => {
  it("returns an empty list when no event has a location", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBookWithEvents(userId, [null, null]);

    const res = await getLocations(accessToken, bookId);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual({ locations: [] });
  });

  it("counts only the locations of the book's own events", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBookWithEvents(userId, ["Arrakis", "Caladan", "Arrakis", null]);
    await createBookWithEvents(userId, ["Giedi Prime", "Arrakis"]);

    const res = await getLocations(accessToken, bookId);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.locations).toEqual<LocationUsageResult[]>([
      { count: 2, location: "Arrakis" },
      { count: 1, location: "Caladan" },
    ]);
  });

  it("merges locations that differ only by case or surrounding whitespace", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBookWithEvents(userId, ["Kyiv", "kyiv ", "Kyiv", "Lviv"]);

    const res = await getLocations(accessToken, bookId);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.locations).toEqual<LocationUsageResult[]>([
      { count: 3, location: "Kyiv" },
      { count: 1, location: "Lviv" },
    ]);
  });

  it("excludes events that sit in a trashed timeline of the book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBookWithEvents(userId, ["Kyiv"]);
    await createEvents(bookId, await createTimeline(bookId, { trashed: true }), ["Kyiv", "Lviv"]);

    const res = await getLocations(accessToken, bookId);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.locations).toEqual<LocationUsageResult[]>([{ count: 1, location: "Kyiv" }]);
  });
});

describe("GET /api/books/:bookId/timeline/locations for a book in a series", () => {
  it("returns the locations of every book in the series from each of its books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(userId);
    const firstBookId = await createBookWithEvents(userId, ["Arrakis", "Arrakis"], { seriesId });
    const secondBookId = await createBookWithEvents(userId, ["arrakis", "Caladan"], { seriesId });
    await createBookWithEvents(userId, ["Giedi Prime"]);

    const fromFirst = await getLocations(accessToken, firstBookId);
    const fromSecond = await getLocations(accessToken, secondBookId);

    const expected: LocationUsageResult[] = [
      { count: 3, location: "Arrakis" },
      { count: 1, location: "Caladan" },
    ];
    expect(fromFirst.status).toBe(HttpStatus.OK);
    expect(fromFirst.body.locations).toEqual(expected);
    expect(fromSecond.status).toBe(HttpStatus.OK);
    expect(fromSecond.body.locations).toEqual(expected);
  });

  it("does not leak another user's book even when it points at the same series", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await registerStranger();
    const seriesId = await createSeries(owner.userId);
    const bookId = await createBookWithEvents(owner.userId, ["Arrakis"], { seriesId });
    await createBookWithEvents(stranger.userId, ["Harkonnen Keep", "Arrakis"], { seriesId });

    const res = await getLocations(owner.accessToken, bookId);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.locations).toEqual<LocationUsageResult[]>([{ count: 1, location: "Arrakis" }]);
  });

  it("does not leak another user's series of the same name", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await registerStranger();
    const ownSeries = await prisma.series.create({
      data: { name: "Dune", normalizedName: "dune", userId: owner.userId },
    });
    const strangerSeries = await prisma.series.create({
      data: { name: "Dune", normalizedName: "dune", userId: stranger.userId },
    });
    const bookId = await createBookWithEvents(owner.userId, ["Arrakis"], {
      seriesId: ownSeries.id,
    });
    await createBookWithEvents(stranger.userId, ["Harkonnen Keep"], {
      seriesId: strangerSeries.id,
    });

    const res = await getLocations(owner.accessToken, bookId);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.locations).toEqual<LocationUsageResult[]>([{ count: 1, location: "Arrakis" }]);
  });

  it("excludes a trashed book of the series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(userId);
    const bookId = await createBookWithEvents(userId, ["Arrakis"], { seriesId });
    await createBookWithEvents(userId, ["Sietch Tabr", "Arrakis"], { seriesId, trashed: true });

    const res = await getLocations(accessToken, bookId);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.locations).toEqual<LocationUsageResult[]>([{ count: 1, location: "Arrakis" }]);
  });

  it("excludes events in a trashed timeline of a sibling book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(userId);
    const bookId = await createBookWithEvents(userId, ["Arrakis"], { seriesId });
    const siblingId = await createBookWithEvents(userId, ["Caladan"], { seriesId });
    await createEvents(siblingId, await createTimeline(siblingId, { trashed: true }), ["Ix"]);

    const res = await getLocations(accessToken, bookId);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.locations).toEqual<LocationUsageResult[]>([
      { count: 1, location: "Arrakis" },
      { count: 1, location: "Caladan" },
    ]);
  });

  it("falls back to the book's own locations when its series is trashed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(userId, { trashed: true });
    const bookId = await createBookWithEvents(userId, ["Arrakis"], { seriesId });
    await createBookWithEvents(userId, ["Caladan"], { seriesId });

    const res = await getLocations(accessToken, bookId);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.locations).toEqual<LocationUsageResult[]>([{ count: 1, location: "Arrakis" }]);
  });

  it("falls back to the book's own locations when its series belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await registerStranger();
    const foreignSeriesId = await createSeries(stranger.userId);
    const bookId = await createBookWithEvents(owner.userId, ["Arrakis"], {
      seriesId: foreignSeriesId,
    });
    await createBookWithEvents(owner.userId, ["Caladan"], { seriesId: foreignSeriesId });
    await createBookWithEvents(stranger.userId, ["Harkonnen Keep"], {
      seriesId: foreignSeriesId,
    });

    const res = await getLocations(owner.accessToken, bookId);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.locations).toEqual<LocationUsageResult[]>([{ count: 1, location: "Arrakis" }]);
  });
});
