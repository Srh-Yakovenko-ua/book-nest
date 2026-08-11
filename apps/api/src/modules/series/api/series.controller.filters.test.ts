import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { SeriesModule } from "../series.module.js";

type BookSeed = {
  authorIds?: string[];
  ownershipStatus?: string;
  partNumber?: null | number;
  readingStatus?: string;
};

type SeriesSeed = {
  authorIds?: string[];
  genres?: string[];
  name: string;
  status?: string;
  totalBooks?: number;
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, SeriesModule]);
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

function createAuthor(userId: string, name: string): Promise<{ id: string }> {
  return prisma.author.create({
    data: { name, normalizedName: name.toLowerCase(), userId },
    select: { id: true },
  });
}

function createBook(
  userId: string,
  seriesId: string,
  { authorIds = [], ownershipStatus, partNumber, readingStatus }: BookSeed,
): Promise<{ id: string }> {
  return prisma.book.create({
    data: {
      authors: { create: authorIds.map((authorId, index) => ({ authorId, position: index })) },
      ownershipStatus: ownershipStatus ?? "none",
      partNumber: partNumber ?? null,
      readingStatus: readingStatus ?? "not_started",
      seriesId,
      title: `Book ${partNumber ?? 0}`,
      userId,
    },
    select: { id: true },
  });
}

function createSeries(
  userId: string,
  { authorIds = [], genres = [], name, status, totalBooks }: SeriesSeed,
): Promise<{ id: string }> {
  return prisma.series.create({
    data: {
      authors: { create: authorIds.map((authorId) => ({ authorId })) },
      genres,
      name,
      normalizedName: name.toLowerCase(),
      status: status ?? "unknown",
      totalBooks: totalBooks ?? null,
      userId,
    },
    select: { id: true },
  });
}

function itemNames(body: { items: { name: string }[] }): string[] {
  return body.items.map((item) => item.name);
}

function searchSeries(accessToken: string, queryString = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/series${queryString}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function seedProgressFixtures(userId: string): Promise<void> {
  const untouched = await createSeries(userId, { name: "Untouched", totalBooks: 2 });
  await createBook(userId, untouched.id, { partNumber: 1 });
  await createBook(userId, untouched.id, { partNumber: 2 });

  const halfway = await createSeries(userId, { name: "Halfway", totalBooks: 2 });
  await createBook(userId, halfway.id, { partNumber: 1, readingStatus: "finished" });
  await createBook(userId, halfway.id, { partNumber: 2 });

  const done = await createSeries(userId, { name: "Done", totalBooks: 2 });
  await createBook(userId, done.id, { partNumber: 1, readingStatus: "finished" });
  await createBook(userId, done.id, { partNumber: 2, readingStatus: "finished" });

  await createSeries(userId, { name: "Empty" });
}

describe("GET /api/series sorting", () => {
  it("orders by name ascending by default and descending on request", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createSeries(userId, { name: "Beta" });
    await createSeries(userId, { name: "Alpha" });

    const ascending = await searchSeries(accessToken);
    expect(ascending.status).toBe(200);
    expect(itemNames(ascending.body)).toEqual(["Alpha", "Beta"]);

    const descending = await searchSeries(accessToken, "?sort=name_desc");
    expect(descending.status).toBe(200);
    expect(itemNames(descending.body)).toEqual(["Beta", "Alpha"]);
  });

  it("orders by the number of books when asked for books_desc", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const small = await createSeries(userId, { name: "Small" });
    await createBook(userId, small.id, { partNumber: 1 });
    const large = await createSeries(userId, { name: "Large" });
    await createBook(userId, large.id, { partNumber: 1 });
    await createBook(userId, large.id, { partNumber: 2 });

    const res = await searchSeries(accessToken, "?sort=books_desc");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["Large", "Small"]);
  });

  it("orders by reading progress in both directions", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedProgressFixtures(userId);

    const descending = await searchSeries(accessToken, "?sort=progress_desc");
    expect(descending.status).toBe(200);
    expect(itemNames(descending.body).slice(0, 2)).toEqual(["Done", "Halfway"]);

    const ascending = await searchSeries(accessToken, "?sort=progress_asc");
    expect(ascending.status).toBe(200);
    expect(itemNames(ascending.body).at(-1)).toBe("Done");
  });
});

describe("GET /api/series filters", () => {
  it("filters by series status", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createSeries(userId, { name: "Finished Run", status: "completed" });
    await createSeries(userId, { name: "Still Going", status: "ongoing" });

    const res = await searchSeries(accessToken, "?status=completed");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["Finished Run"]);
    expect(res.body.totalCount).toBe(1);
  });

  it("filters by reading state", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedProgressFixtures(userId);

    const completed = await searchSeries(accessToken, "?reading=completed");
    expect(itemNames(completed.body)).toEqual(["Done"]);

    const notStarted = await searchSeries(accessToken, "?reading=not_started");
    expect(itemNames(notStarted.body)).toEqual(["Untouched"]);

    const inProgress = await searchSeries(accessToken, "?reading=in_progress");
    expect(itemNames(inProgress.body)).toEqual(["Halfway"]);

    const empty = await searchSeries(accessToken, "?reading=empty");
    expect(itemNames(empty.body)).toEqual(["Empty"]);
  });

  it("returns only started, unfinished multi-book series on the unfinished tab", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedProgressFixtures(userId);

    const res = await searchSeries(accessToken, "?tab=unfinished");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["Halfway"]);
  });

  it("filters by completeness against the declared total", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const complete = await createSeries(userId, { name: "Complete", totalBooks: 1 });
    await createBook(userId, complete.id, { partNumber: 1 });
    const incomplete = await createSeries(userId, { name: "Incomplete", totalBooks: 5 });
    await createBook(userId, incomplete.id, { partNumber: 1 });
    await createSeries(userId, { name: "No Plan" });

    const res = await searchSeries(accessToken, "?completeness=complete&completeness=no_plan");

    expect(res.status).toBe(200);
    expect(itemNames(res.body).sort()).toEqual(["Complete", "No Plan"]);
  });

  it("filters by the number of books in the series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const one = await createSeries(userId, { name: "One" });
    await createBook(userId, one.id, { partNumber: 1 });
    const three = await createSeries(userId, { name: "Three" });
    await createBook(userId, three.id, { partNumber: 1 });
    await createBook(userId, three.id, { partNumber: 2 });
    await createBook(userId, three.id, { partNumber: 3 });

    const res = await searchSeries(accessToken, "?booksMin=2");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["Three"]);
  });

  it("filters by a progress range", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedProgressFixtures(userId);

    const res = await searchSeries(accessToken, "?progressMin=40&progressMax=60");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["Halfway"]);
  });

  it("filters by genre overlap", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createSeries(userId, { genres: ["fantasy"], name: "Fantasy One" });
    await createSeries(userId, { genres: ["thriller"], name: "Thriller One" });

    const res = await searchSeries(accessToken, "?genres=fantasy");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["Fantasy One"]);
  });

  it("matches the search term against author names as well as the series name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await createAuthor(userId, "Ursula Le Guin");
    await createSeries(userId, { authorIds: [author.id], name: "Earthsea" });
    await createSeries(userId, { name: "Unrelated" });

    const res = await searchSeries(accessToken, "?search=ursula");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["Earthsea"]);
  });

  it("treats a percent sign in the search term as a literal character", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createSeries(userId, { name: "Hundred % Club" });
    await createSeries(userId, { name: "Plain Name" });

    const res = await searchSeries(accessToken, "?search=%25");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["Hundred % Club"]);
  });
});

describe("GET /api/series attention filter", () => {
  it("selects series with a gap in their part numbers", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gapped = await createSeries(userId, { name: "Gapped" });
    await createBook(userId, gapped.id, { partNumber: 1 });
    await createBook(userId, gapped.id, { partNumber: 3 });
    const contiguous = await createSeries(userId, { name: "Contiguous" });
    await createBook(userId, contiguous.id, { partNumber: 1 });
    await createBook(userId, contiguous.id, { partNumber: 2 });

    const res = await searchSeries(accessToken, "?attention=missing_parts");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["Gapped"]);
  });

  it("selects a completed series that holds fewer books than its declared total", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const partial = await createSeries(userId, {
      name: "Partial Set",
      status: "completed",
      totalBooks: 3,
    });
    await createBook(userId, partial.id, { partNumber: 1 });
    const full = await createSeries(userId, {
      name: "Full Set",
      status: "completed",
      totalBooks: 1,
    });
    await createBook(userId, full.id, { partNumber: 1 });

    const res = await searchSeries(accessToken, "?attention=incomplete_set");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["Partial Set"]);
  });

  it("selects a series whose next book is not on the shelf", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const unavailable = await createSeries(userId, { name: "Awaiting Delivery" });
    await createBook(userId, unavailable.id, { partNumber: 1, readingStatus: "finished" });
    await createBook(userId, unavailable.id, { ownershipStatus: "want_to_buy", partNumber: 2 });
    const available = await createSeries(userId, { name: "On The Shelf" });
    await createBook(userId, available.id, { ownershipStatus: "owned", partNumber: 1 });

    const res = await searchSeries(accessToken, "?attention=next_unavailable");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["Awaiting Delivery"]);
  });

  it("selects series missing authors or genres as incomplete data", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await createAuthor(userId, "Complete Author");
    await createSeries(userId, {
      authorIds: [author.id],
      genres: ["fantasy"],
      name: "Fully Described",
    });
    await createSeries(userId, { genres: ["fantasy"], name: "No Author" });

    const res = await searchSeries(accessToken, "?attention=incomplete_data");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["No Author"]);
  });

  it("selects every series with any attention reason when asked for any", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await createAuthor(userId, "Complete Author");
    const clean = await createSeries(userId, {
      authorIds: [author.id],
      genres: ["fantasy"],
      name: "Clean",
      status: "ongoing",
    });
    await createBook(userId, clean.id, { authorIds: [author.id], partNumber: 1 });
    await createSeries(userId, { genres: ["fantasy"], name: "Unknown Status" });

    const res = await searchSeries(accessToken, "?attention=any");

    expect(res.status).toBe(200);
    expect(itemNames(res.body)).toEqual(["Unknown Status"]);
  });
});

describe("GET /api/series query validation", () => {
  it("rejects an inverted progress range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await searchSeries(accessToken, "?progressMin=80&progressMax=20");

    expect(res.status).toBe(400);
  });

  it("rejects an unknown sort value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await searchSeries(accessToken, "?sort=nonsense");

    expect(res.status).toBe(400);
  });
});
