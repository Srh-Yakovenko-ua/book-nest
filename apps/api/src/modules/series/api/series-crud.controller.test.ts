import type { INestApplication } from "@nestjs/common";

import {
  BOOK_SERIES_PART_NUMBER_TAKEN_CODE,
  SeriesDetailsViewSchema,
  SeriesOverviewViewSchema,
  SeriesViewSchema,
} from "@app/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { SeriesModule } from "../series.module.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, SeriesModule, BooksModule]);
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

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function createSeries(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/series")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function deleteSeries(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .delete(`/api/series/${id}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getBook(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${id}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getOverview(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/series/overview")
    .set("Authorization", `Bearer ${accessToken}`);
}

function getSeries(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/series/${id}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function patchSeries(accessToken: string, id: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/series/${id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function seedDetailSeries(accessToken: string): Promise<string> {
  const first = await createBook(accessToken, {
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    newSeries: { name: "Detail Series", status: "ongoing", totalBooks: 3 },
    pagesCount: 300,
    partNumber: 1,
    readingProgress: { finishedAt: "2026-02-05", rating: 8 },
    readingStatus: "finished",
    title: "Part One",
  });
  const seriesId = first.body.series.id;
  await createBook(accessToken, {
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    pagesCount: 200,
    partNumber: 2,
    readingProgress: { currentPage: 50, startedAt: "2026-02-01" },
    readingStatus: "reading",
    seriesId,
    title: "Part Two",
  });
  await createBook(accessToken, {
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    partNumber: 3,
    readingStatus: "not_started",
    seriesId,
    title: "Part Three",
  });
  return seriesId;
}

async function seedOverviewLibrary(accessToken: string): Promise<{
  emptySeriesId: string;
  fullyReadSeriesId: string;
  unfinishedSeriesId: string;
}> {
  const fullyReadFirst = await createBook(accessToken, {
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    newSeries: { name: "Fully Read", status: "ongoing" },
    partNumber: 1,
    readingProgress: { finishedAt: "2026-02-05" },
    readingStatus: "finished",
    title: "Fully Read One",
  });
  const fullyReadSeriesId = fullyReadFirst.body.series.id;
  await createBook(accessToken, {
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    partNumber: 2,
    readingProgress: { finishedAt: "2026-02-06" },
    readingStatus: "finished",
    seriesId: fullyReadSeriesId,
    title: "Fully Read Two",
  });

  const unfinishedFirst = await createBook(accessToken, {
    authors: [{ name: "Leigh Bardugo" }],
    bookType: "series_part",
    newSeries: { name: "Unfinished", status: "unknown" },
    partNumber: 1,
    readingProgress: { finishedAt: "2026-02-05" },
    readingStatus: "finished",
    title: "Unfinished One",
  });
  const unfinishedSeriesId = unfinishedFirst.body.series.id;
  await createBook(accessToken, {
    authors: [{ name: "Leigh Bardugo" }],
    bookType: "series_part",
    partNumber: 2,
    readingStatus: "not_started",
    seriesId: unfinishedSeriesId,
    title: "Unfinished Two",
  });

  const empty = await createSeries(accessToken, { name: "Empty Series", status: "completed" });

  return {
    emptySeriesId: empty.body.id,
    fullyReadSeriesId,
    unfinishedSeriesId,
  };
}

describe("POST /api/series", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).post("/api/series").send({ name: "Throne" });

    expect(res.status).toBe(401);
  });

  it("creates a series and returns a body matching the view schema", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createSeries(accessToken, {
      description: "An epic saga",
      name: "Throne of Glass",
      status: "ongoing",
      totalBooks: 3,
    });

    expect(res.status).toBe(201);
    expect(SeriesViewSchema.safeParse(res.body).success).toBe(true);
    expect(res.body).toMatchObject({
      description: "An epic saga",
      name: "Throne of Glass",
      status: "ongoing",
      totalBooks: 3,
    });
    expect(res.body.id).toMatch(UUID);
  });

  it("rejects a duplicate name regardless of case and spacing with 409", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createSeries(accessToken, { name: "Throne of Glass" });

    const res = await createSeries(accessToken, { name: "  throne   OF glass " });

    expect(res.status).toBe(409);
  });

  it("returns 400 with a field error for a too-short name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createSeries(accessToken, { name: "a" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "name" })]),
    );
  });
});

describe("GET /api/series/overview", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/series/overview");

    expect(res.status).toBe(401);
  });

  it("returns an overview matching the schema", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewLibrary(accessToken);

    const res = await getOverview(accessToken);

    expect(res.status).toBe(200);
    expect(SeriesOverviewViewSchema.safeParse(res.body).success).toBe(true);
  });

  it("counts fully-read, unfinished and empty series with their linked books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewLibrary(accessToken);

    const res = await getOverview(accessToken);

    expect(res.body).toMatchObject({
      booksInSeries: 4,
      fullyReadSeries: 1,
      totalSeries: 3,
      unfinishedSeries: 1,
    });
  });

  it("tallies status counts and surfaces the unfinished series in topUnfinished", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { unfinishedSeriesId } = await seedOverviewLibrary(accessToken);

    const res = await getOverview(accessToken);

    expect(res.body.statusCounts).toEqual({ completed: 1, ongoing: 1, unknown: 1 });
    expect(res.body.topUnfinished).toHaveLength(1);
    expect(res.body.topUnfinished[0].id).toBe(unfinishedSeriesId);
  });
});

describe("GET /api/series/:id", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(`/api/series/${MISSING_UUID}`);

    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getSeries(accessToken, "not-a-uuid");

    expect(res.status).toBe(400);
  });

  it("returns 404 for a series that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getSeries(accessToken, MISSING_UUID);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a series owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createSeries(owner.accessToken, { name: "Owner Series" });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await getSeries(stranger.accessToken, created.body.id);

    expect(res.status).toBe(404);
  });

  it("returns the details matching the schema with books ordered by part number", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await seedDetailSeries(accessToken);

    const res = await getSeries(accessToken, seriesId);

    expect(res.status).toBe(200);
    expect(SeriesDetailsViewSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.books.map((book: { title: string }) => book.title)).toEqual([
      "Part One",
      "Part Two",
      "Part Three",
    ]);
    expect(res.body.books[1].rating).toBeNull();
  });

  it("computes the reading stats", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await seedDetailSeries(accessToken);

    const res = await getSeries(accessToken, seriesId);

    expect(res.body.stats).toEqual({
      averageRating: 8,
      booksCount: 3,
      finishedCount: 1,
      pagesCount: 500,
      readingCount: 1,
      unreadCount: 1,
    });
  });

  it("orders a linked book without a part number last", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesRow = await prisma.series.create({
      data: { name: "Companion Set", normalizedName: "companion set", userId },
    });
    await prisma.book.create({
      data: { partNumber: null, seriesId: seriesRow.id, title: "Companion", userId },
    });
    await prisma.book.create({
      data: { partNumber: 1, seriesId: seriesRow.id, title: "Main", userId },
    });

    const res = await getSeries(accessToken, seriesRow.id);

    expect(res.status).toBe(200);
    expect(res.body.books.map((book: { title: string }) => book.title)).toEqual([
      "Main",
      "Companion",
    ]);
  });
});

describe("PATCH /api/series/:id", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/series/${MISSING_UUID}`)
      .send({ name: "Renamed" });

    expect(res.status).toBe(401);
  });

  it("updates the name, status, description and total books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createSeries(accessToken, { name: "Original", status: "unknown" });

    const res = await patchSeries(accessToken, created.body.id, {
      description: "An epic saga",
      name: "Renamed Saga",
      status: "completed",
      totalBooks: 7,
    });

    expect(res.status).toBe(200);
    expect(SeriesViewSchema.safeParse(res.body).success).toBe(true);
    expect(res.body).toMatchObject({
      description: "An epic saga",
      name: "Renamed Saga",
      status: "completed",
      totalBooks: 7,
    });
  });

  it("rejects lowering total books below the linked book count with 422", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Trilogy" },
      partNumber: 1,
      title: "One",
    });
    const seriesId = first.body.series.id;
    await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 2,
      seriesId,
      title: "Two",
    });

    const res = await patchSeries(accessToken, seriesId, { totalBooks: 1 });

    expect(res.status).toBe(422);
  });

  it("rejects renaming to a name already used by another own series with 409", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createSeries(accessToken, { name: "Alpha" });
    const beta = await createSeries(accessToken, { name: "Beta" });

    const res = await patchSeries(accessToken, beta.body.id, { name: "alpha" });

    expect(res.status).toBe(409);
  });

  it("allows renaming a series to its own current name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const beta = await createSeries(accessToken, { name: "Beta" });

    const res = await patchSeries(accessToken, beta.body.id, { name: "Beta" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Beta");
  });

  it("reflects a replaced author list in the response", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createSeries(accessToken, { name: "Author Swap" });

    const res = await patchSeries(accessToken, created.body.id, {
      authors: [{ name: "New Author" }],
    });

    expect(res.status).toBe(200);
    expect(res.body.authors).toEqual([expect.objectContaining({ name: "New Author" })]);
    expect(res.body.authors[0].id).toMatch(UUID);
  });

  it("returns 404 when updating a series owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createSeries(owner.accessToken, { name: "Owner Series" });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await patchSeries(stranger.accessToken, created.body.id, { name: "Hijack" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/series/:id", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).delete(`/api/series/${MISSING_UUID}`);

    expect(res.status).toBe(401);
  });

  it("detaches the linked books and returns 204, keeping their reading status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Delete Me" },
      partNumber: 1,
      readingProgress: { finishedAt: "2026-02-05" },
      readingStatus: "finished",
      title: "Kept Book",
    });
    const seriesId = created.body.series.id;
    const bookId = created.body.id;

    const del = await deleteSeries(accessToken, seriesId);
    expect(del.status).toBe(204);

    const read = await getBook(accessToken, bookId);
    expect(read.status).toBe(200);
    expect(read.body.series).toBeNull();
    expect(read.body.partNumber).toBeNull();
    expect(read.body.readingStatus).toBe("finished");
  });

  it("returns 404 on a second delete of the same series", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createSeries(accessToken, { name: "Once" });

    const first = await deleteSeries(accessToken, created.body.id);
    expect(first.status).toBe(204);

    const second = await deleteSeries(accessToken, created.body.id);
    expect(second.status).toBe(404);
  });

  it("returns 404 when deleting a series owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createSeries(owner.accessToken, { name: "Owner Series" });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await deleteSeries(stranger.accessToken, created.body.id);

    expect(res.status).toBe(404);
  });
});

describe("POST /api/books series part number uniqueness", () => {
  it("rejects a second book reusing a part number in the series with the taken code", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Duplicate Parts" },
      partNumber: 1,
      title: "One",
    });
    const seriesId = first.body.series.id;

    const duplicate = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 1,
      seriesId,
      title: "Two",
    });

    expect(duplicate.status).toBe(400);
    expect(duplicate.body.errorsMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: BOOK_SERIES_PART_NUMBER_TAKEN_CODE,
          field: "partNumber",
        }),
      ]),
    );
  });
});
