import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { TimelineModule } from "../timeline.module.js";

const DEFAULT_TIMELINE_NAME = "Основна часова лінія";
const MISSING_ID = "99999999-9999-4999-8999-999999999999";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, TimelineModule]);
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

function authed(
  method: "delete" | "get" | "patch" | "post",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createTimeline(
  token: string,
  bookId: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return authed("post", `/api/books/${bookId}/timelines`, token).send(body);
}

async function listTimelines(token: string, bookId: string): Promise<request.Response> {
  return authed("get", `/api/books/${bookId}/timelines`, token);
}

describe("timeline lazy default", () => {
  it("returns a single default timeline for a fresh book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const res = await listTimelines(accessToken, bookId);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.timelines).toHaveLength(1);
    expect(res.body.timelines[0]).toMatchObject({
      eventsCount: 0,
      isDefault: true,
      name: DEFAULT_TIMELINE_NAME,
    });
  });

  it("keeps exactly one default across repeated reads", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    await listTimelines(accessToken, bookId);
    const second = await listTimelines(accessToken, bookId);
    expect(second.body.timelines).toHaveLength(1);
    expect(
      second.body.timelines.filter((line: { isDefault: boolean }) => line.isDefault),
    ).toHaveLength(1);
  });
});

describe("timeline creation", () => {
  it("creates an additional non-default line after the default", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const created = await createTimeline(accessToken, bookId, {
      colorKey: "amber",
      description: "The heroine's past",
      name: "Flashbacks",
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body).toMatchObject({
      colorKey: "amber",
      description: "The heroine's past",
      isDefault: false,
      name: "Flashbacks",
    });

    const list = await listTimelines(accessToken, bookId);
    expect(list.body.timelines).toHaveLength(2);
    expect(list.body.timelines[0].isDefault).toBe(true);
    expect(list.body.timelines[1].name).toBe("Flashbacks");
  });

  it("rejects a duplicate name case-insensitively", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createTimeline(accessToken, bookId, { name: "Flashbacks" });

    const duplicate = await createTimeline(accessToken, bookId, { name: "flashbacks" });
    expect(duplicate.status).toBe(HttpStatus.CONFLICT);
    expect(duplicate.body.code).toBe("timeline_duplicate_name");
  });

  it("rejects an unknown color key", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const res = await createTimeline(accessToken, bookId, { colorKey: "chartreuse", name: "X" });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("rejects a blank name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const res = await createTimeline(accessToken, bookId, { name: "   " });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });
});

describe("timeline update", () => {
  it("renames the default line and normalizes an empty description", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const list = await listTimelines(accessToken, bookId);
    const defaultId = list.body.timelines[0].id;

    const res = await authed("patch", `/api/timelines/${defaultId}`, accessToken).send({
      description: "   ",
      name: "Main story",
    });
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({ description: null, isDefault: true, name: "Main story" });
  });

  it("rejects renaming into another line's name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createTimeline(accessToken, bookId, { name: "Flashbacks" });
    const other = await createTimeline(accessToken, bookId, { name: "Future" });

    const res = await authed("patch", `/api/timelines/${other.body.id}`, accessToken).send({
      name: "flashbacks",
    });
    expect(res.status).toBe(HttpStatus.CONFLICT);
  });
});

describe("timeline default reassignment", () => {
  it("moves the default flag to another line, keeping exactly one default", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const list = await listTimelines(accessToken, bookId);
    const defaultId = list.body.timelines[0].id;
    const other = await createTimeline(accessToken, bookId, { name: "Flashbacks" });

    const res = await authed(
      "post",
      `/api/timelines/${other.body.id}/set-default`,
      accessToken,
    ).send({});
    expect(res.status).toBe(HttpStatus.OK);

    const defaults = res.body.timelines.filter((line: { isDefault: boolean }) => line.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(other.body.id);
    const previous = res.body.timelines.find((line: { id: string }) => line.id === defaultId);
    expect(previous.isDefault).toBe(false);
  });
});

describe("timeline reorder", () => {
  it("moves a line before another and rejects a stale token with 409", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const first = await createTimeline(accessToken, bookId, { name: "A" });
    const second = await createTimeline(accessToken, bookId, { name: "B" });

    const staleToken = second.body.updatedAt;
    const reorder = await authed(
      "post",
      `/api/books/${bookId}/timelines/reorder`,
      accessToken,
    ).send({
      beforeTimelineId: first.body.id,
      expectedUpdatedAt: second.body.updatedAt,
      timelineId: second.body.id,
    });
    expect(reorder.status).toBe(HttpStatus.OK);
    const names = reorder.body.timelines.map((line: { name: string }) => line.name);
    expect(names.indexOf("B")).toBeLessThan(names.indexOf("A"));

    const stale = await authed("post", `/api/books/${bookId}/timelines/reorder`, accessToken).send({
      beforeTimelineId: first.body.id,
      expectedUpdatedAt: staleToken,
      timelineId: second.body.id,
    });
    expect(stale.status).toBe(HttpStatus.CONFLICT);
    expect(stale.body.code).toBe("timeline_reorder_conflict");
  });
});

describe("timeline deletion", () => {
  it("deletes an empty non-default line directly", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const line = await createTimeline(accessToken, bookId, { name: "Flashbacks" });

    const res = await authed("delete", `/api/timelines/${line.body.id}`, accessToken);
    expect(res.status).toBe(HttpStatus.NO_CONTENT);
    const list = await listTimelines(accessToken, bookId);
    expect(list.body.timelines).toHaveLength(1);
  });

  it("refuses to delete the default line", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const list = await listTimelines(accessToken, bookId);
    const defaultId = list.body.timelines[0].id;

    const res = await authed("delete", `/api/timelines/${defaultId}`, accessToken);
    expect(res.status).toBe(HttpStatus.CONFLICT);
    expect(res.body.code).toBe("timeline_default_delete_forbidden");
  });

  it("requires a strategy for a line that has events", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const line = await createTimeline(accessToken, bookId, { name: "Flashbacks" });
    await authed("post", `/api/books/${bookId}/timeline-events`, accessToken).send({
      timelineId: line.body.id,
      title: "A memory",
    });

    const noStrategy = await authed("delete", `/api/timelines/${line.body.id}`, accessToken);
    expect(noStrategy.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(noStrategy.body.code).toBe("timeline_delete_strategy_required");
  });

  it("deletes a non-empty line together with its events", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const line = await createTimeline(accessToken, bookId, { name: "Flashbacks" });
    await authed("post", `/api/books/${bookId}/timeline-events`, accessToken).send({
      timelineId: line.body.id,
      title: "A memory",
    });

    const res = await authed(
      "delete",
      `/api/timelines/${line.body.id}?strategy=delete`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.NO_CONTENT);

    const events = await authed("get", `/api/books/${bookId}/timeline-events`, accessToken);
    expect(events.body.totalCount).toBe(0);
  });

  it("moves events to another line before deleting", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const source = await createTimeline(accessToken, bookId, { name: "Flashbacks" });
    const target = await createTimeline(accessToken, bookId, { name: "Future" });
    const eventId = await createEventInTimeline(accessToken, bookId, source.body.id, "A memory");

    const res = await authed(
      "delete",
      `/api/timelines/${source.body.id}?strategy=move&targetTimelineId=${target.body.id}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.NO_CONTENT);

    const moved = await authed("get", `/api/timeline-events/${eventId}`, accessToken);
    expect(moved.status).toBe(HttpStatus.OK);
    expect(moved.body.timelineId).toBe(target.body.id);
  });
});

describe("timeline summary", () => {
  it("returns per-timeline and total event counts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const line = await createTimeline(accessToken, bookId, { name: "Flashbacks" });
    await createEventInTimeline(accessToken, bookId, line.body.id, "One");
    await createEventInTimeline(accessToken, bookId, line.body.id, "Two");

    const res = await authed("get", `/api/books/${bookId}/timeline/summary`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalEvents).toBe(2);
    const entry = res.body.timelines.find(
      (line2: { timelineId: string }) => line2.timelineId === line.body.id,
    );
    expect(entry.eventsCount).toBe(2);
  });
});

describe("timeline ownership", () => {
  it("hides another user's book and timelines", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const bookId = await createBook(owner.accessToken);
    const line = await createTimeline(owner.accessToken, bookId, { name: "Flashbacks" });

    const listAttempt = await listTimelines(intruder.accessToken, bookId);
    expect(listAttempt.status).toBe(HttpStatus.NOT_FOUND);

    const patchAttempt = await authed(
      "patch",
      `/api/timelines/${line.body.id}`,
      intruder.accessToken,
    ).send({ name: "Hijacked" });
    expect(patchAttempt.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 404 for a missing timeline", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await authed("patch", `/api/timelines/${MISSING_ID}`, accessToken).send({
      name: "Nope",
    });
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});

async function createEventInTimeline(
  token: string,
  bookId: string,
  timelineId: string,
  title: string,
): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/timeline-events`, token).send({
    timelineId,
    title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}
