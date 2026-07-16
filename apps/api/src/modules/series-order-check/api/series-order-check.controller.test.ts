import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ReadingQueueModule } from "../../reading-queue/reading-queue.module.js";
import { SeriesOrderCheckModule } from "../series-order-check.module.js";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([
    AuthModule,
    BooksModule,
    ReadingQueueModule,
    SeriesOrderCheckModule,
  ]);
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

type SeededScenario = {
  bookThreeId: string;
  bookTwoId: string;
  seriesId: string;
};

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function createSeriesPartBook(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ bookId: string; seriesId: string }> {
  const res = await createBook(accessToken, {
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    ownershipStatus: "owned",
    ...body,
  });
  expect(res.status).toBe(201);
  const seriesId = res.body.series?.id;
  expect(typeof seriesId).toBe("string");
  return { bookId: res.body.id, seriesId };
}

function getIssues(accessToken: string, query = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/reading-queue/series-order-issues${query}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function queueBook(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .post("/api/reading-queue")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ bookId, placement: "end" });
}

async function seedMissingPreviousScenario(accessToken: string): Promise<SeededScenario> {
  const bookThree = await createSeriesPartBook(accessToken, {
    newSeries: { name: "Dune" },
    partNumber: 3,
    title: "Children of Dune",
  });
  const bookTwo = await createSeriesPartBook(accessToken, {
    partNumber: 2,
    readingStatus: "not_started",
    seriesId: bookThree.seriesId,
    title: "Dune Messiah",
  });

  expect((await queueBook(accessToken, bookThree.bookId)).status).toBe(200);

  return {
    bookThreeId: bookThree.bookId,
    bookTwoId: bookTwo.bookId,
    seriesId: bookThree.seriesId,
  };
}

describe("GET /api/reading-queue/series-order-issues", () => {
  it("detects a previous book missing from the queue", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);

    const res = await getIssues(user.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(typeof res.body.queueVersion).toBe("string");
    expect(res.body.queueVersion.length).toBeGreaterThan(0);

    const issue = res.body.items[0];
    expect(issue.problemType).toBe("missing_previous_from_queue");
    expect(issue.series.id).toBe(scenario.seriesId);
    expect(issue.affectedBook.id).toBe(scenario.bookThreeId);
    expect(issue.previousBook.id).toBe(scenario.bookTwoId);
    expect(issue.fingerprint.length).toBeGreaterThan(0);
  });

  it("returns no issue when the series order check is disabled", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);

    const prisma = app.get(PrismaService);
    await prisma.seriesOrderDisabledSeries.create({
      data: { seriesId: scenario.seriesId, userId: user.userId },
    });

    const res = await getIssues(user.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toHaveLength(0);
  });

  it("does not leak another user's series order issues", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedMissingPreviousScenario(owner.accessToken);

    const other = await context.registerVerifyAndLogin({ email: "other@example.com" });
    const otherRes = await getIssues(other.accessToken);

    expect(otherRes.status).toBe(200);
    expect(otherRes.body.total).toBe(0);
    expect(otherRes.body.items).toHaveLength(0);

    const ownerRes = await getIssues(owner.accessToken);
    expect(ownerRes.body.total).toBe(1);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app.getHttpServer()).get("/api/reading-queue/series-order-issues");
    expect(res.status).toBe(401);
  });
});
