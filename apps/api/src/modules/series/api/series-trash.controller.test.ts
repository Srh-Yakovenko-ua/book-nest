import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { SeriesLifecycleService } from "../application/series-lifecycle.service.js";
import type { SeriesPurgeReconciler } from "../application/series-purge.reconciler.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { SERIES_PURGE_QUEUE_NAME } from "../domain/series-purge.js";
import { SeriesModule } from "../series.module.js";

const addCalls: { data: unknown; opts: unknown }[] = [];
const removeCalls: string[] = [];

const queueStub = {
  add: (_name: string, data: unknown, opts: unknown): Promise<void> => {
    addCalls.push({ data, opts });
    return Promise.resolve();
  },
  remove: (jobId: string): Promise<void> => {
    removeCalls.push(jobId);
    return Promise.resolve();
  },
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let lifecycleService: SeriesLifecycleService;
let reconciler: SeriesPurgeReconciler;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule, SeriesModule],
    [{ provide: getQueueToken(SERIES_PURGE_QUEUE_NAME), useValue: queueStub }],
  );
  app = context.app;
  prisma = app.get(PrismaService);
  const lifecycleModule = await import("../application/series-lifecycle.service.js");
  const reconcilerModule = await import("../application/series-purge.reconciler.js");
  lifecycleService = app.get(lifecycleModule.SeriesLifecycleService);
  reconciler = app.get(reconcilerModule.SeriesPurgeReconciler);
});

beforeEach(() => {
  context.reset();
  addCalls.length = 0;
  removeCalls.length = 0;
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function authed(
  method: "delete" | "get" | "patch" | "post",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function backdateDeletion(seriesId: string, days: number): Promise<void> {
  await prisma.series.update({
    data: { deletedAt: subDays(new Date(), days) },
    where: { id: seriesId },
  });
}

async function createSeriesWithBook(
  token: string,
  name: string,
): Promise<{ bookId: string; seriesId: string }> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    newSeries: { name },
    ownershipStatus: "owned",
    partNumber: 1,
    title: `${name} part one`,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return { bookId: res.body.id, seriesId: res.body.series.id };
}

describe("DELETE /api/series/:id", () => {
  it("moves the series to the trash, keeps its books and reports the purge date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await createSeriesWithBook(accessToken, "Throne of Glass");

    const res = await authed("delete", `/api/series/${seriesId}`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.seriesId).toBe(seriesId);
    expect(new Date(res.body.purgeAt)).toEqual(
      TRASH_RETENTION.purgeAfter(new Date(res.body.deletedAt)),
    );

    const book = await prisma.book.findUniqueOrThrow({
      select: { partNumber: true, seriesId: true },
      where: { id: bookId },
    });
    expect(book.seriesId).toBe(seriesId);
    expect(book.partNumber).toBe(1);

    expect(addCalls[0]).toMatchObject({
      data: { seriesId },
      opts: { delay: TRASH_RETENTION.purgeDelayMs, jobId: seriesId },
    });
  });

  it("hides the series from listings, details and its books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await createSeriesWithBook(accessToken, "Hidden");

    await authed("delete", `/api/series/${seriesId}`, accessToken).expect(HttpStatus.OK);

    const list = await authed("get", "/api/series", accessToken);
    expect(list.body.totalCount).toBe(0);

    const details = await authed("get", `/api/series/${seriesId}`, accessToken);
    expect(details.status).toBe(HttpStatus.NOT_FOUND);

    const book = await authed("get", `/api/books/${bookId}`, accessToken);
    expect(book.body.series).toBeNull();
    expect(book.body.partNumber).toBeNull();
    expect(book.body.bookType).toBe("solo");
  });

  it("frees the series name so the same title can be used again", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { seriesId } = await createSeriesWithBook(accessToken, "Reusable");

    await authed("delete", `/api/series/${seriesId}`, accessToken).expect(HttpStatus.OK);

    const recreated = await authed("post", "/api/series", accessToken).send({
      authors: [],
      genres: [],
      name: "Reusable",
      status: "unknown",
    });

    expect(recreated.status).toBe(HttpStatus.CREATED);
    expect(recreated.body.id).not.toBe(seriesId);
  });

  it("returns 404 when the series is already in the trash", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { seriesId } = await createSeriesWithBook(accessToken, "Twice");

    await authed("delete", `/api/series/${seriesId}`, accessToken).expect(HttpStatus.OK);

    const res = await authed("delete", `/api/series/${seriesId}`, accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("GET /api/series/trash", () => {
  it("lists trashed series with their book count and purge date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { seriesId } = await createSeriesWithBook(accessToken, "Trashed");

    await authed("delete", `/api/series/${seriesId}`, accessToken).expect(HttpStatus.OK);

    const res = await authed("get", "/api/series/trash", accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0]).toMatchObject({ booksCount: 1, id: seriesId, name: "Trashed" });
  });

  it("never leaks another user trash", async () => {
    const owner = await context.registerVerifyAndLogin();
    const { seriesId } = await createSeriesWithBook(owner.accessToken, "Private");
    await authed("delete", `/api/series/${seriesId}`, owner.accessToken).expect(HttpStatus.OK);

    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await authed("get", "/api/series/trash", stranger.accessToken);

    expect(res.body.totalCount).toBe(0);
  });
});

describe("POST /api/series/:id/restore", () => {
  it("brings the series back with its books still attached", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await createSeriesWithBook(accessToken, "Back Again");

    await authed("delete", `/api/series/${seriesId}`, accessToken).expect(HttpStatus.OK);
    removeCalls.length = 0;

    const res = await authed("post", `/api/series/${seriesId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body).toMatchObject({ id: seriesId, name: "Back Again" });
    expect(removeCalls).toEqual([seriesId]);

    const book = await authed("get", `/api/books/${bookId}`, accessToken);
    expect(book.body.series).toMatchObject({ id: seriesId });
    expect(book.body.partNumber).toBe(1);
  });

  it("returns 404 for a series that is not in the trash", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { seriesId } = await createSeriesWithBook(accessToken, "Active");

    const res = await authed("post", `/api/series/${seriesId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("series purge", () => {
  it("detaches the books and deletes the series once the window elapses", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await createSeriesWithBook(accessToken, "Doomed");

    await authed("delete", `/api/series/${seriesId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(seriesId, TRASH_RETENTION.days + 1);

    await lifecycleService.purge({ seriesId, userId });

    expect(await prisma.series.findUnique({ where: { id: seriesId } })).toBeNull();
    const book = await prisma.book.findUniqueOrThrow({
      select: { partNumber: true, seriesId: true },
      where: { id: bookId },
    });
    expect(book.seriesId).toBeNull();
    expect(book.partNumber).toBeNull();
  });

  it("keeps a series whose window has not elapsed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { seriesId } = await createSeriesWithBook(accessToken, "Young");

    await authed("delete", `/api/series/${seriesId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(seriesId, TRASH_RETENTION.days - 1);

    await lifecycleService.purge({ seriesId, userId });

    expect(await prisma.series.findUnique({ where: { id: seriesId } })).not.toBeNull();
  });

  it("reconciles overdue series the delayed job never fired for", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const overdue = await createSeriesWithBook(accessToken, "Overdue");
    const fresh = await createSeriesWithBook(accessToken, "Fresh");

    await authed("delete", `/api/series/${overdue.seriesId}`, accessToken).expect(HttpStatus.OK);
    await authed("delete", `/api/series/${fresh.seriesId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(overdue.seriesId, TRASH_RETENTION.days + 1);

    await reconciler.sweep();

    expect(await prisma.series.findUnique({ where: { id: overdue.seriesId } })).toBeNull();
    expect(await prisma.series.findUnique({ where: { id: fresh.seriesId } })).not.toBeNull();
  });
});

describe("restoring a series whose name was taken meanwhile", () => {
  it("returns 409 instead of failing on the partial unique index", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { seriesId } = await createSeriesWithBook(accessToken, "Contested");

    await authed("delete", `/api/series/${seriesId}`, accessToken).expect(HttpStatus.OK);
    await authed("post", "/api/series", accessToken)
      .send({ authors: [], genres: [], name: "Contested", status: "unknown" })
      .expect(HttpStatus.CREATED);

    const res = await authed("post", `/api/series/${seriesId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.CONFLICT);
  });
});
