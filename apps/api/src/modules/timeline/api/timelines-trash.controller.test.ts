import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { TimelineLifecycleService } from "../application/timeline-lifecycle.service.js";
import type { TimelinePurgeReconciler } from "../application/timeline-purge.reconciler.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { TIMELINE_PURGE_QUEUE_NAME } from "../domain/timeline-purge.js";
import { TimelineModule } from "../timeline.module.js";

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
let lifecycleService: TimelineLifecycleService;
let reconciler: TimelinePurgeReconciler;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, TimelineModule, BooksModule],
    [{ provide: getQueueToken(TIMELINE_PURGE_QUEUE_NAME), useValue: queueStub }],
  );
  app = context.app;
  prisma = app.get(PrismaService);
  const lifecycleModule = await import("../application/timeline-lifecycle.service.js");
  const reconcilerModule = await import("../application/timeline-purge.reconciler.js");
  lifecycleService = app.get(lifecycleModule.TimelineLifecycleService);
  reconciler = app.get(reconcilerModule.TimelinePurgeReconciler);
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

async function backdateDeletion(timelineId: string, days: number): Promise<void> {
  await prisma.bookTimeline.update({
    data: { deletedAt: subDays(new Date(), days) },
    where: { id: timelineId },
  });
}

async function createBookWithTimeline(
  token: string,
  name: string,
): Promise<{ bookId: string; timelineId: string }> {
  const book = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
  });
  expect(book.status).toBe(HttpStatus.CREATED);
  const timeline = await authed("post", `/api/books/${book.body.id}/timelines`, token).send({
    name,
  });
  expect(timeline.status).toBe(HttpStatus.CREATED);
  return { bookId: book.body.id, timelineId: timeline.body.id };
}

describe("timeline trash", () => {
  it("moves the timeline to the trash and schedules its purge", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { timelineId } = await createBookWithTimeline(accessToken, "Side plot");

    const res = await authed("delete", `/api/timelines/${timelineId}`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.timelineId).toBe(timelineId);
    expect(new Date(res.body.purgeAt)).toEqual(
      TRASH_RETENTION.purgeAfter(new Date(res.body.deletedAt)),
    );
    expect(addCalls[0]).toMatchObject({
      data: { timelineId },
      opts: { delay: TRASH_RETENTION.purgeDelayMs, jobId: timelineId },
    });
  });

  it("hides the trashed timeline from the book listing and lists it in the trash", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, timelineId } = await createBookWithTimeline(accessToken, "Hidden line");

    await authed("delete", `/api/timelines/${timelineId}`, accessToken).expect(HttpStatus.OK);

    const listing = await authed("get", `/api/books/${bookId}/timelines`, accessToken);
    expect(listing.body.timelines.map((line: { id: string }) => line.id)).not.toContain(timelineId);

    const trash = await authed("get", "/api/timelines/trash", accessToken);
    expect(trash.body.totalCount).toBe(1);
    expect(trash.body.items[0]).toMatchObject({
      bookTitle: "Dune",
      id: timelineId,
      name: "Hidden line",
    });
  });

  it("keeps the events of a trashed timeline and brings them back on restore", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, timelineId } = await createBookWithTimeline(accessToken, "With events");
    const event = await authed("post", `/api/books/${bookId}/timeline-events`, accessToken).send({
      timelineId,
      title: "The duel",
    });
    expect(event.status).toBe(HttpStatus.CREATED);

    await authed("delete", `/api/timelines/${timelineId}?strategy=delete`, accessToken).expect(
      HttpStatus.OK,
    );

    const hidden = await authed("get", `/api/books/${bookId}/timeline-events`, accessToken);
    expect(hidden.body.totalCount).toBe(0);
    expect(await prisma.bookTimelineEvent.count({ where: { timelineId } })).toBe(1);

    removeCalls.length = 0;
    await authed("post", `/api/timelines/${timelineId}/restore`, accessToken).expect(
      HttpStatus.NO_CONTENT,
    );
    expect(removeCalls).toEqual([timelineId]);

    const back = await authed("get", `/api/books/${bookId}/timeline-events`, accessToken);
    expect(back.body.totalCount).toBe(1);
  });

  it("returns 404 restoring a timeline that is not in the trash", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { timelineId } = await createBookWithTimeline(accessToken, "Active");

    const res = await authed("post", `/api/timelines/${timelineId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("purges an overdue timeline with its events and keeps a fresh one", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const overdue = await createBookWithTimeline(accessToken, "Overdue");
    const fresh = await createBookWithTimeline(accessToken, "Fresh");
    await authed("post", `/api/books/${overdue.bookId}/timeline-events`, accessToken)
      .send({ timelineId: overdue.timelineId, title: "Doomed event" })
      .expect(HttpStatus.CREATED);

    await authed(
      "delete",
      `/api/timelines/${overdue.timelineId}?strategy=delete`,
      accessToken,
    ).expect(HttpStatus.OK);
    await authed("delete", `/api/timelines/${fresh.timelineId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(overdue.timelineId, TRASH_RETENTION.days + 1);

    await lifecycleService.purge({ timelineId: overdue.timelineId, userId });
    await lifecycleService.purge({ timelineId: fresh.timelineId, userId });

    expect(await prisma.bookTimeline.findUnique({ where: { id: overdue.timelineId } })).toBeNull();
    expect(
      await prisma.bookTimelineEvent.count({ where: { timelineId: overdue.timelineId } }),
    ).toBe(0);
    expect(
      await prisma.bookTimeline.findUnique({ where: { id: fresh.timelineId } }),
    ).not.toBeNull();
  });

  it("reconciles overdue timelines the delayed job never fired for", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { timelineId } = await createBookWithTimeline(accessToken, "Swept");

    await authed("delete", `/api/timelines/${timelineId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(timelineId, TRASH_RETENTION.days + 1);

    await reconciler.sweep();

    expect(await prisma.bookTimeline.findUnique({ where: { id: timelineId } })).toBeNull();
  });
});

describe("timeline names while trashed", () => {
  it("frees the name for a new timeline and returns 409 if the old one is restored", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, timelineId } = await createBookWithTimeline(accessToken, "Contested");

    await authed("delete", `/api/timelines/${timelineId}`, accessToken).expect(HttpStatus.OK);

    const recreated = await authed("post", `/api/books/${bookId}/timelines`, accessToken).send({
      name: "Contested",
    });
    expect(recreated.status).toBe(HttpStatus.CREATED);

    const res = await authed("post", `/api/timelines/${timelineId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.CONFLICT);
  });
});

describe("timeline trash tenant isolation", () => {
  it("never leaks or restores another user trashed timeline", async () => {
    const owner = await context.registerVerifyAndLogin();
    const { timelineId } = await createBookWithTimeline(owner.accessToken, "Private");
    await authed("delete", `/api/timelines/${timelineId}`, owner.accessToken).expect(HttpStatus.OK);

    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const listing = await authed("get", "/api/timelines/trash", stranger.accessToken);
    expect(listing.body.totalCount).toBe(0);

    const restore = await authed(
      "post",
      `/api/timelines/${timelineId}/restore`,
      stranger.accessToken,
    );
    expect(restore.status).toBe(HttpStatus.NOT_FOUND);
    expect(
      await prisma.bookTimeline.findUniqueOrThrow({ where: { id: timelineId } }),
    ).toMatchObject({ deletedAt: expect.any(Date) });
  });
});
