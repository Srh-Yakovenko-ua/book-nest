import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { SeriesModule } from "../series.module.js";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, SeriesModule, BooksModule]);
  app = context.app;
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

function getSeries(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/series/${id}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function seedStatsSeries(
  accessToken: string,
): Promise<{ favoriteBookId: string; seriesId: string }> {
  const alpha = await createBook(accessToken, {
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    isFavorite: true,
    newSeries: { name: "Stats Series", status: "ongoing", totalBooks: 3 },
    pagesCount: 320,
    partNumber: 1,
    readingProgress: { finishedAt: "2026-01-12", rating: 9, startedAt: "2026-01-02" },
    readingStatus: "finished",
    title: "Alpha",
  });
  const seriesId = alpha.body.series.id;
  await createBook(accessToken, {
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    partNumber: 2,
    readingProgress: { finishedAt: "2026-01-20", startedAt: "2026-01-06" },
    readingStatus: "finished",
    seriesId,
    title: "Bravo",
  });
  await createBook(accessToken, {
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    pagesCount: 180,
    partNumber: 3,
    readingProgress: { currentPage: 30, startedAt: "2026-01-15" },
    readingStatus: "reading",
    seriesId,
    title: "Charlie",
  });
  return { favoriteBookId: alpha.body.id, seriesId };
}

describe("GET /api/series/:id stats", () => {
  it("sums pages only over finished books and flags the sum partial when one lacks pages", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { seriesId } = await seedStatsSeries(accessToken);

    const res = await getSeries(accessToken, seriesId);

    expect(res.status).toBe(200);
    expect(res.body.stats.readPagesCount).toBe(320);
    expect(res.body.stats.readPagesPartial).toBe(true);
  });

  it("averages pages over every book that has one, ignoring the book without pages", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { seriesId } = await seedStatsSeries(accessToken);

    const res = await getSeries(accessToken, seriesId);

    expect(res.body.stats.averagePages).toBe(250);
  });

  it("returns the favorite book as an id and title reference", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { favoriteBookId, seriesId } = await seedStatsSeries(accessToken);

    const res = await getSeries(accessToken, seriesId);

    expect(res.body.stats.favoriteBook).toEqual({ id: favoriteBookId, title: "Alpha" });
  });

  it("serializes the earliest start and latest finish loaded from reading progress as ISO strings", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { seriesId } = await seedStatsSeries(accessToken);

    const res = await getSeries(accessToken, seriesId);

    expect(res.body.stats.startedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(res.body.stats.lastFinishedAt).toBe("2026-01-20T00:00:00.000Z");
  });

  it("computes the reading duration in calendar days between the start and last finish", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { seriesId } = await seedStatsSeries(accessToken);

    const res = await getSeries(accessToken, seriesId);

    expect(res.body.stats.readingDurationDays).toBe(18);
  });
});
