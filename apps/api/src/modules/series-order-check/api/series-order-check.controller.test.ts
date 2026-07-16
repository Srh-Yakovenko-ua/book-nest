import type { INestApplication } from "@nestjs/common";

import { READING_QUEUE_LIMIT, SERIES_ORDER_ERROR_CODES } from "@app/shared";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ReadingQueueModule } from "../../reading-queue/reading-queue.module.js";
import { SeriesOrderCheckRepository } from "../infrastructure/series-order-check.repository.js";
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

type MultipleMissingScenario = {
  bookFourId: string;
  bookThreeId: string;
  bookTwoId: string;
  seriesId: string;
};

type OutOfOrderScenario = {
  bookThreeId: string;
  bookTwoId: string;
  seriesId: string;
  soloId: string;
};

type SeededScenario = {
  bookThreeId: string;
  bookTwoId: string;
  seriesId: string;
};

function applyFix(
  accessToken: string,
  fingerprint: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/reading-queue/series-order-issues/${fingerprint}/apply`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

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

async function createSoloBook(accessToken: string, body: Record<string, unknown>): Promise<string> {
  const res = await createBook(accessToken, {
    authors: [{ name: "Frank Herbert" }],
    bookType: "solo",
    ownershipStatus: "owned",
    ...body,
  });
  expect(res.status).toBe(201);
  return res.body.id;
}

async function firstIssue(
  accessToken: string,
): Promise<{ fingerprint: string; queueVersion: string }> {
  const res = await getIssues(accessToken);
  expect(res.status).toBe(200);
  const issue = res.body.items[0];
  expect(issue).toBeDefined();
  return { fingerprint: issue.fingerprint, queueVersion: res.body.queueVersion };
}

function getIssues(accessToken: string, query = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/reading-queue/series-order-issues${query}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getQueue(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/reading-queue")
    .set("Authorization", `Bearer ${accessToken}`);
}

function getSeriesOrderPreference(accessToken: string, seriesId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/series/${seriesId}/order-check-preference`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function ignoreIssue(accessToken: string, fingerprint: string): request.Test {
  return request(app.getHttpServer())
    .post(`/api/reading-queue/series-order-issues/${fingerprint}/ignore`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function previewFix(
  accessToken: string,
  fingerprint: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/reading-queue/series-order-issues/${fingerprint}/preview`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
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

async function seedMultipleMissingScenario(accessToken: string): Promise<MultipleMissingScenario> {
  const bookFour = await createSeriesPartBook(accessToken, {
    newSeries: { name: "Dune" },
    partNumber: 4,
    readingStatus: "not_started",
    title: "God Emperor of Dune",
  });
  const bookTwo = await createSeriesPartBook(accessToken, {
    partNumber: 2,
    readingStatus: "not_started",
    seriesId: bookFour.seriesId,
    title: "Dune Messiah",
  });
  const bookThree = await createSeriesPartBook(accessToken, {
    partNumber: 3,
    readingStatus: "not_started",
    seriesId: bookFour.seriesId,
    title: "Children of Dune",
  });

  expect((await queueBook(accessToken, bookFour.bookId)).status).toBe(200);

  return {
    bookFourId: bookFour.bookId,
    bookThreeId: bookThree.bookId,
    bookTwoId: bookTwo.bookId,
    seriesId: bookFour.seriesId,
  };
}

async function seedOutOfOrderScenario(accessToken: string): Promise<OutOfOrderScenario> {
  const bookThree = await createSeriesPartBook(accessToken, {
    newSeries: { name: "Dune" },
    partNumber: 3,
    readingStatus: "not_started",
    title: "Children of Dune",
  });
  const bookTwo = await createSeriesPartBook(accessToken, {
    partNumber: 2,
    readingStatus: "not_started",
    seriesId: bookThree.seriesId,
    title: "Dune Messiah",
  });
  const soloId = await createSoloBook(accessToken, { title: "Standalone" });

  expect((await queueBook(accessToken, bookThree.bookId)).status).toBe(200);
  expect((await queueBook(accessToken, soloId)).status).toBe(200);
  expect((await queueBook(accessToken, bookTwo.bookId)).status).toBe(200);

  return {
    bookThreeId: bookThree.bookId,
    bookTwoId: bookTwo.bookId,
    seriesId: bookThree.seriesId,
    soloId,
  };
}

function setSeriesOrderPreference(
  accessToken: string,
  seriesId: string,
  enabled: boolean,
): request.Test {
  return request(app.getHttpServer())
    .put(`/api/series/${seriesId}/order-check-preference`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ enabled });
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

describe("POST /api/reading-queue/series-order-issues/:fingerprint/preview", () => {
  it("previews ADD_NEXT_PREVIOUS_BEFORE with the added book placed before the affected book", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);
    const { fingerprint, queueVersion } = await firstIssue(user.accessToken);

    const res = await previewFix(user.accessToken, fingerprint, {
      expectedQueueVersion: queueVersion,
      strategy: "ADD_NEXT_PREVIOUS_BEFORE",
    });

    expect(res.status).toBe(200);
    expect(res.body.strategy).toBe("ADD_NEXT_PREVIOUS_BEFORE");
    expect(res.body.addedBooksCount).toBe(1);
    expect(res.body.queueVersion).toBe(queueVersion);

    const addedItem = res.body.after.find(
      (item: { bookId: string }) => item.bookId === scenario.bookTwoId,
    );
    const affectedItem = res.body.after.find(
      (item: { bookId: string }) => item.bookId === scenario.bookThreeId,
    );
    expect(addedItem.queuePosition).toBeLessThan(affectedItem.queuePosition);
    expect(addedItem.belongsToAffectedSeries).toBe(true);

    const addChange = res.body.changes.find(
      (change: { bookId: string }) => change.bookId === scenario.bookTwoId,
    );
    expect(addChange).toMatchObject({ fromPosition: null, type: "add" });
  });

  it("previews REORDER_SERIES_SLOTS leaving unrelated books' positions unchanged", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedOutOfOrderScenario(user.accessToken);
    const { fingerprint, queueVersion } = await firstIssue(user.accessToken);

    const res = await previewFix(user.accessToken, fingerprint, {
      expectedQueueVersion: queueVersion,
      strategy: "REORDER_SERIES_SLOTS",
    });

    expect(res.status).toBe(200);
    expect(res.body.addedBooksCount).toBe(0);
    expect(res.body.shiftedUnrelatedBooksCount).toBe(0);

    const beforeSolo = res.body.before.find(
      (item: { bookId: string }) => item.bookId === scenario.soloId,
    );
    const afterSolo = res.body.after.find(
      (item: { bookId: string }) => item.bookId === scenario.soloId,
    );
    expect(afterSolo.queuePosition).toBe(beforeSolo.queuePosition);
    expect(afterSolo.belongsToAffectedSeries).toBe(false);

    const afterTwo = res.body.after.find(
      (item: { bookId: string }) => item.bookId === scenario.bookTwoId,
    );
    const afterThree = res.body.after.find(
      (item: { bookId: string }) => item.bookId === scenario.bookThreeId,
    );
    expect(afterTwo.queuePosition).toBeLessThan(afterThree.queuePosition);
  });

  it("rejects a strategy that is not allowed for the issue", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedMissingPreviousScenario(user.accessToken);
    const { fingerprint, queueVersion } = await firstIssue(user.accessToken);

    const res = await previewFix(user.accessToken, fingerprint, {
      expectedQueueVersion: queueVersion,
      strategy: "REORDER_SERIES_SLOTS",
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(SERIES_ORDER_ERROR_CODES.INVALID_FIX_STRATEGY);
  });

  it("does not leak another user's issue", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedMissingPreviousScenario(owner.accessToken);
    const { fingerprint, queueVersion } = await firstIssue(owner.accessToken);

    const other = await context.registerVerifyAndLogin({ email: "other@example.com" });
    const res = await previewFix(other.accessToken, fingerprint, {
      expectedQueueVersion: queueVersion,
      strategy: "ADD_NEXT_PREVIOUS_BEFORE",
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(SERIES_ORDER_ERROR_CODES.ISSUE_STALE);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/reading-queue/series-order-issues/anything/preview")
      .send({ expectedQueueVersion: "x", strategy: "ADD_NEXT_PREVIOUS_BEFORE" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/reading-queue/series-order-issues/:fingerprint/apply", () => {
  it("applies ADD_NEXT_PREVIOUS_BEFORE and inserts the book with a contiguous queue", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);
    const { fingerprint, queueVersion } = await firstIssue(user.accessToken);

    const res = await applyFix(user.accessToken, fingerprint, {
      expectedQueueVersion: queueVersion,
      strategy: "ADD_NEXT_PREVIOUS_BEFORE",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.addedBookIds).toEqual([scenario.bookTwoId]);
    expect(res.body.resolvedFingerprint).toBe(fingerprint);
    expect(res.body.queueVersion).not.toBe(queueVersion);

    const queueRes = await getQueue(user.accessToken);
    const positions = queueRes.body.items.map(
      (item: { book: { id: string }; position: number }) => ({
        bookId: item.book.id,
        position: item.position,
      }),
    );
    expect(positions).toHaveLength(2);
    expect(positions.map((entry: { position: number }) => entry.position)).toEqual([1, 2]);
    const bookTwoPos = positions.find(
      (entry: { bookId: string }) => entry.bookId === scenario.bookTwoId,
    ).position;
    const bookThreePos = positions.find(
      (entry: { bookId: string }) => entry.bookId === scenario.bookThreeId,
    ).position;
    expect(bookTwoPos).toBeLessThan(bookThreePos);
  });

  it("applies REORDER_SERIES_SLOTS swapping only the series books", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedOutOfOrderScenario(user.accessToken);
    const { fingerprint, queueVersion } = await firstIssue(user.accessToken);

    const res = await applyFix(user.accessToken, fingerprint, {
      expectedQueueVersion: queueVersion,
      strategy: "REORDER_SERIES_SLOTS",
    });

    expect(res.status).toBe(200);
    expect(res.body.addedBookIds).toEqual([]);

    const queueRes = await getQueue(user.accessToken);
    const positionByBookId = new Map<string, number>(
      queueRes.body.items.map((item: { book: { id: string }; position: number }) => [
        item.book.id,
        item.position,
      ]),
    );
    expect(positionByBookId.get(scenario.bookTwoId)).toBe(1);
    expect(positionByBookId.get(scenario.soloId)).toBe(2);
    expect(positionByBookId.get(scenario.bookThreeId)).toBe(3);
  });

  it("applies ADD_ALL_PREVIOUS_BEFORE inserting every missing previous before the affected book", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMultipleMissingScenario(user.accessToken);
    const { fingerprint, queueVersion } = await firstIssue(user.accessToken);

    const res = await applyFix(user.accessToken, fingerprint, {
      expectedQueueVersion: queueVersion,
      strategy: "ADD_ALL_PREVIOUS_BEFORE",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.addedBookIds).toHaveLength(2);
    expect(res.body.addedBookIds).toEqual(
      expect.arrayContaining([scenario.bookTwoId, scenario.bookThreeId]),
    );

    const queueRes = await getQueue(user.accessToken);
    expect(queueRes.body.items).toHaveLength(3);
    const positionByBookId = new Map<string, number>(
      queueRes.body.items.map((item: { book: { id: string }; position: number }) => [
        item.book.id,
        item.position,
      ]),
    );
    expect(positionByBookId.get(scenario.bookTwoId)).toBe(1);
    expect(positionByBookId.get(scenario.bookThreeId)).toBe(2);
    expect(positionByBookId.get(scenario.bookFourId)).toBe(3);
  });

  it("returns 409 ISSUE_STALE when re-applying the same fingerprint after success", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedMissingPreviousScenario(user.accessToken);
    const { fingerprint, queueVersion } = await firstIssue(user.accessToken);

    const applied = await applyFix(user.accessToken, fingerprint, {
      expectedQueueVersion: queueVersion,
      strategy: "ADD_NEXT_PREVIOUS_BEFORE",
    });
    expect(applied.status).toBe(200);

    const replay = await applyFix(user.accessToken, fingerprint, {
      expectedQueueVersion: applied.body.queueVersion,
      strategy: "ADD_NEXT_PREVIOUS_BEFORE",
    });
    expect(replay.status).toBe(409);
    expect(replay.body.code).toBe(SERIES_ORDER_ERROR_CODES.ISSUE_STALE);
  });

  it("returns 409 QUEUE_STALE when the expected queue version is stale", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);
    const { fingerprint } = await firstIssue(user.accessToken);

    const res = await applyFix(user.accessToken, fingerprint, {
      expectedQueueVersion: "0000000000000000",
      strategy: "ADD_NEXT_PREVIOUS_BEFORE",
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(SERIES_ORDER_ERROR_CODES.QUEUE_STALE);

    const prisma = app.get(PrismaService);
    const bookTwo = await prisma.book.findUnique({ where: { id: scenario.bookTwoId } });
    expect(bookTwo?.queuePosition).toBeNull();
  });

  it("returns 422 QUEUE_LIMIT_REACHED and adds nothing when the queue is full", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);

    const prisma = app.get(PrismaService);
    const fillerCount = READING_QUEUE_LIMIT - 1;
    await prisma.book.createMany({
      data: Array.from({ length: fillerCount }, (_unused, index) => ({
        queuePosition: index + 2,
        title: `Filler ${index + 2}`,
        userId: user.userId,
      })),
    });

    const { fingerprint, queueVersion } = await firstIssue(user.accessToken);

    const res = await applyFix(user.accessToken, fingerprint, {
      expectedQueueVersion: queueVersion,
      strategy: "ADD_NEXT_PREVIOUS_BEFORE",
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(SERIES_ORDER_ERROR_CODES.QUEUE_LIMIT_REACHED);

    const bookTwo = await prisma.book.findUnique({ where: { id: scenario.bookTwoId } });
    expect(bookTwo?.queuePosition).toBeNull();
    const queuedCount = await prisma.book.count({
      where: { queuePosition: { not: null }, userId: user.userId },
    });
    expect(queuedCount).toBe(READING_QUEUE_LIMIT);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/reading-queue/series-order-issues/anything/apply")
      .send({ expectedQueueVersion: "x", strategy: "ADD_NEXT_PREVIOUS_BEFORE" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/reading-queue/series-order-issues/:fingerprint/ignore", () => {
  it("removes the ignored issue from detection and persists the ignored row", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);
    const { fingerprint } = await firstIssue(user.accessToken);

    const res = await ignoreIssue(user.accessToken, fingerprint);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toHaveLength(0);

    const after = await getIssues(user.accessToken);
    expect(after.body.total).toBe(0);

    const prisma = app.get(PrismaService);
    const rows = await prisma.seriesOrderIgnoredIssue.findMany({ where: { userId: user.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.fingerprint).toBe(fingerprint);
    expect(rows[0]?.seriesId).toBe(scenario.seriesId);
  });

  it("returns 409 ISSUE_STALE when re-ignoring an already ignored fingerprint", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedMissingPreviousScenario(user.accessToken);
    const { fingerprint } = await firstIssue(user.accessToken);

    expect((await ignoreIssue(user.accessToken, fingerprint)).status).toBe(200);

    const replay = await ignoreIssue(user.accessToken, fingerprint);
    expect(replay.status).toBe(409);
    expect(replay.body.code).toBe(SERIES_ORDER_ERROR_CODES.ISSUE_STALE);
  });

  it("keeps the ignored write idempotent without duplicate rows", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);

    const repository = app.get(SeriesOrderCheckRepository);
    const payload = {
      fingerprint: "same-fingerprint",
      seriesId: scenario.seriesId,
      userId: user.userId,
    };
    await repository.addIgnoredIssue(payload);
    await expect(repository.addIgnoredIssue(payload)).resolves.toBeUndefined();

    const prisma = app.get(PrismaService);
    const rows = await prisma.seriesOrderIgnoredIssue.findMany({
      where: { fingerprint: "same-fingerprint", userId: user.userId },
    });
    expect(rows).toHaveLength(1);
  });

  it("returns 409 ISSUE_STALE for an unknown fingerprint", async () => {
    const user = await context.registerVerifyAndLogin();
    await seedMissingPreviousScenario(user.accessToken);

    const res = await ignoreIssue(user.accessToken, "not-a-real-fingerprint");

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(SERIES_ORDER_ERROR_CODES.ISSUE_STALE);
  });

  it("re-surfaces the issue when the conflict essence changes", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);
    const { fingerprint } = await firstIssue(user.accessToken);

    expect((await ignoreIssue(user.accessToken, fingerprint)).status).toBe(200);

    const prisma = app.get(PrismaService);
    await prisma.book.update({
      data: { readingStatus: "reading" },
      where: { id: scenario.bookThreeId },
    });

    const res = await getIssues(user.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].fingerprint).not.toBe(fingerprint);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app.getHttpServer()).post(
      "/api/reading-queue/series-order-issues/anything/ignore",
    );
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/series/:seriesId/order-check-preference", () => {
  it("stops detection for a series when the check is disabled", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);
    expect((await getIssues(user.accessToken)).body.total).toBe(1);

    const res = await setSeriesOrderPreference(user.accessToken, scenario.seriesId, false);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false });

    const after = await getIssues(user.accessToken);
    expect(after.body.total).toBe(0);
  });

  it("resumes detection when the check is re-enabled", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);

    expect(
      (await setSeriesOrderPreference(user.accessToken, scenario.seriesId, false)).status,
    ).toBe(200);
    expect((await getIssues(user.accessToken)).body.total).toBe(0);

    const res = await setSeriesOrderPreference(user.accessToken, scenario.seriesId, true);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: true });
    expect((await getIssues(user.accessToken)).body.total).toBe(1);
  });

  it("is idempotent when the check is disabled twice", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);

    expect(
      (await setSeriesOrderPreference(user.accessToken, scenario.seriesId, false)).status,
    ).toBe(200);
    expect(
      (await setSeriesOrderPreference(user.accessToken, scenario.seriesId, false)).status,
    ).toBe(200);

    expect((await getIssues(user.accessToken)).body.total).toBe(0);

    const prisma = app.get(PrismaService);
    const rows = await prisma.seriesOrderDisabledSeries.findMany({
      where: { seriesId: scenario.seriesId, userId: user.userId },
    });
    expect(rows).toHaveLength(1);
  });

  it("returns 404 for a series not owned by the user", async () => {
    const user = await context.registerVerifyAndLogin();

    const res = await setSeriesOrderPreference(user.accessToken, randomUUID(), false);

    expect(res.status).toBe(404);
  });

  it("does not let one user's disable affect another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const ownerScenario = await seedMissingPreviousScenario(owner.accessToken);

    const other = await context.registerVerifyAndLogin({ email: "other@example.com" });
    await seedMissingPreviousScenario(other.accessToken);

    expect(
      (await setSeriesOrderPreference(owner.accessToken, ownerScenario.seriesId, false)).status,
    ).toBe(200);

    expect((await getIssues(owner.accessToken)).body.total).toBe(0);
    expect((await getIssues(other.accessToken)).body.total).toBe(1);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/series/${randomUUID()}/order-check-preference`)
      .send({ enabled: false });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/series/:seriesId/order-check-preference", () => {
  it("returns enabled true by default when the series was never disabled", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);

    const res = await getSeriesOrderPreference(user.accessToken, scenario.seriesId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: true });
  });

  it("returns enabled false after the check is disabled", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);

    expect(
      (await setSeriesOrderPreference(user.accessToken, scenario.seriesId, false)).status,
    ).toBe(200);

    const res = await getSeriesOrderPreference(user.accessToken, scenario.seriesId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false });
  });

  it("returns enabled false when a disabled row is seeded directly", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);

    const prisma = app.get(PrismaService);
    await prisma.seriesOrderDisabledSeries.create({
      data: { seriesId: scenario.seriesId, userId: user.userId },
    });

    const res = await getSeriesOrderPreference(user.accessToken, scenario.seriesId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false });
  });

  it("returns enabled true again after the check is re-enabled", async () => {
    const user = await context.registerVerifyAndLogin();
    const scenario = await seedMissingPreviousScenario(user.accessToken);

    expect(
      (await setSeriesOrderPreference(user.accessToken, scenario.seriesId, false)).status,
    ).toBe(200);
    expect((await getSeriesOrderPreference(user.accessToken, scenario.seriesId)).body).toEqual({
      enabled: false,
    });

    expect((await setSeriesOrderPreference(user.accessToken, scenario.seriesId, true)).status).toBe(
      200,
    );

    const res = await getSeriesOrderPreference(user.accessToken, scenario.seriesId);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: true });
  });

  it("returns 404 for a series not owned by the user", async () => {
    const user = await context.registerVerifyAndLogin();

    const res = await getSeriesOrderPreference(user.accessToken, randomUUID());

    expect(res.status).toBe(404);
  });

  it("does not leak another user's series preference", async () => {
    const owner = await context.registerVerifyAndLogin();
    const ownerScenario = await seedMissingPreviousScenario(owner.accessToken);
    expect(
      (await setSeriesOrderPreference(owner.accessToken, ownerScenario.seriesId, false)).status,
    ).toBe(200);

    const other = await context.registerVerifyAndLogin({ email: "other@example.com" });
    const res = await getSeriesOrderPreference(other.accessToken, ownerScenario.seriesId);

    expect(res.status).toBe(404);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/series/${randomUUID()}/order-check-preference`,
    );
    expect(res.status).toBe(401);
  });
});
