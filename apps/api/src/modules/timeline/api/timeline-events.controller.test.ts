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

function createEvent(token: string, bookId: string, body: Record<string, unknown>): request.Test {
  return authed("post", `/api/books/${bookId}/timeline-events`, token).send(body);
}

async function createTitledEvent(
  token: string,
  bookId: string,
  title: string,
  extra: Record<string, unknown> = {},
): Promise<request.Response> {
  const res = await createEvent(token, bookId, { title, ...extra });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res;
}

async function listEvents(
  token: string,
  bookId: string,
  queryString = "",
): Promise<request.Response> {
  return authed("get", `/api/books/${bookId}/timeline-events${queryString}`, token);
}

async function setCurrentPage(token: string, bookId: string, currentPage: number): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/reading-progress`, token).send({
    currentPage,
  });
  expect(res.status).toBe(HttpStatus.OK);
}

describe("quick add", () => {
  it("creates an event from only a title with default type, importance and timeline", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const created = await createTitledEvent(accessToken, bookId, "The spice is found");
    expect(created.body).toMatchObject({
      eventType: "main",
      importance: "medium",
      pageNumber: null,
      threadStatus: null,
      title: "The spice is found",
    });
    expect(created.body.bookOrder).toBeGreaterThan(0);
    expect(created.body.timelineOrder).toBeGreaterThan(0);

    const timelines = await authed("get", `/api/books/${bookId}/timelines`, accessToken);
    expect(created.body.timelineId).toBe(timelines.body.timelines[0].id);
  });

  it("allows duplicate titles", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createTitledEvent(accessToken, bookId, "Same");
    const second = await createEvent(accessToken, bookId, { title: "Same" });
    expect(second.status).toBe(HttpStatus.CREATED);
  });
});

describe("event field handling", () => {
  it("stores all fields, trims text and normalizes empty strings to null", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 500 });

    const created = await createTitledEvent(accessToken, bookId, "  Betrayal  ", {
      chapter: "Глава 7.2",
      description: "  A long description  ",
      eventType: "betrayal",
      importance: "key",
      location: "  Arrakis  ",
      personalNote: "   ",
      storyTime: "три тижні по тому",
      summary: "  Short recap  ",
    });
    expect(created.body).toMatchObject({
      chapter: "Глава 7.2",
      description: "A long description",
      eventType: "betrayal",
      importance: "key",
      location: "Arrakis",
      personalNote: null,
      storyTime: "три тижні по тому",
      summary: "Short recap",
      title: "Betrayal",
    });
  });

  it("keeps a textual chapter such as a prologue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createTitledEvent(accessToken, bookId, "Opening", { chapter: "Пролог" });
    expect(created.body.chapter).toBe("Пролог");
  });

  it("rejects a story time over the limit", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const res = await createEvent(accessToken, bookId, {
      storyTime: "x".repeat(101),
      title: "Too long",
    });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });
});

describe("page validation", () => {
  it("accepts a null page and a page within the book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 300 });
    const withPage = await createTitledEvent(accessToken, bookId, "Page ok", { pageNumber: 150 });
    expect(withPage.body.pageNumber).toBe(150);
    const noPage = await createTitledEvent(accessToken, bookId, "No page");
    expect(noPage.body.pageNumber).toBeNull();
  });

  it("rejects zero, negative and fractional pages", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 300 });
    for (const pageNumber of [0, -5, 12.5]) {
      const res = await createEvent(accessToken, bookId, { pageNumber, title: "Bad" });
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it("rejects a page beyond the book page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 100 });
    const res = await createEvent(accessToken, bookId, { pageNumber: 250, title: "Beyond" });
    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe("timeline_page_exceeds_book");
  });

  it("accepts any page when the book has no page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const res = await createTitledEvent(accessToken, bookId, "Any page", { pageNumber: 9999 });
    expect(res.body.pageNumber).toBe(9999);
  });
});

describe("timeline binding", () => {
  it("rejects a timeline that belongs to another book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const otherBookId = await createBook(accessToken, { title: "Other" });
    const otherTimelines = await authed("get", `/api/books/${otherBookId}/timelines`, accessToken);

    const res = await createEvent(accessToken, bookId, {
      timelineId: otherTimelines.body.timelines[0].id,
      title: "Wrong line",
    });
    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });
});

describe("two independent orders", () => {
  it("keeps book order and timeline order independent", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const first = await createTitledEvent(accessToken, bookId, "First");
    const second = await createTitledEvent(accessToken, bookId, "Second");

    const reorder = await authed(
      "post",
      `/api/timeline-events/${second.body.id}/reorder`,
      accessToken,
    ).send({
      beforeEventId: first.body.id,
      expectedUpdatedAt: second.body.updatedAt,
      scope: "timeline",
    });
    expect(reorder.status).toBe(HttpStatus.OK);

    const byBook = await listEvents(accessToken, bookId, "?sort=book_order");
    expect(byBook.body.items.map((event: { title: string }) => event.title)).toEqual([
      "First",
      "Second",
    ]);
    const byTimeline = await listEvents(accessToken, bookId, "?sort=timeline_order");
    expect(byTimeline.body.items.map((event: { title: string }) => event.title)).toEqual([
      "Second",
      "First",
    ]);
  });
});

describe("event reorder", () => {
  it("moves an event to the start and rejects a stale token with 409", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const first = await createTitledEvent(accessToken, bookId, "A");
    await createTitledEvent(accessToken, bookId, "B");
    const third = await createTitledEvent(accessToken, bookId, "C");

    const staleToken = third.body.updatedAt;
    const reorder = await authed(
      "post",
      `/api/timeline-events/${third.body.id}/reorder`,
      accessToken,
    ).send({
      beforeEventId: first.body.id,
      expectedUpdatedAt: third.body.updatedAt,
      scope: "book",
    });
    expect(reorder.status).toBe(HttpStatus.OK);

    const list = await listEvents(accessToken, bookId, "?sort=book_order");
    expect(list.body.items.map((event: { title: string }) => event.title)).toEqual(["C", "A", "B"]);

    const stale = await authed(
      "post",
      `/api/timeline-events/${third.body.id}/reorder`,
      accessToken,
    ).send({ beforeEventId: first.body.id, expectedUpdatedAt: staleToken, scope: "book" });
    expect(stale.status).toBe(HttpStatus.CONFLICT);
    expect(stale.body.code).toBe("timeline_reorder_conflict");
  });

  it("keeps positions unique after many insertions at the start", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const anchor = await createTitledEvent(accessToken, bookId, "anchor");

    for (let index = 0; index < 15; index += 1) {
      const created = await createTitledEvent(accessToken, bookId, `event-${index}`);
      const firstList = await listEvents(accessToken, bookId, "?sort=book_order&pageSize=1");
      const firstId = firstList.body.items[0].id;
      const reorder = await authed(
        "post",
        `/api/timeline-events/${created.body.id}/reorder`,
        accessToken,
      ).send({
        beforeEventId: firstId,
        expectedUpdatedAt: created.body.updatedAt,
        scope: "book",
      });
      expect(reorder.status).toBe(HttpStatus.OK);
    }

    const all = await listEvents(accessToken, bookId, "?sort=book_order&pageSize=100");
    const orders = all.body.items.map((event: { bookOrder: number }) => event.bookOrder);
    expect(new Set(orders).size).toBe(orders.length);
    expect(all.body.items[all.body.items.length - 1].id).toBe(anchor.body.id);
  });
});

describe("move between timelines", () => {
  it("recomputes timeline order, preserves book order, relations and thread status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const targetLine = await authed("post", `/api/books/${bookId}/timelines`, accessToken).send({
      name: "Future",
    });
    const anchor = await createTitledEvent(accessToken, bookId, "target anchor", {
      timelineId: targetLine.body.id,
    });
    const mover = await createTitledEvent(accessToken, bookId, "mover", { threadStatus: "open" });
    await authed("post", `/api/timeline-events/${mover.body.id}/relations`, accessToken).send({
      relationType: "related",
      targetEventId: anchor.body.id,
    });

    const move = await authed(
      "post",
      `/api/timeline-events/${mover.body.id}/move`,
      accessToken,
    ).send({ targetTimelineId: targetLine.body.id });
    expect(move.status).toBe(HttpStatus.OK);
    expect(move.body.timelineId).toBe(targetLine.body.id);
    expect(move.body.bookOrder).toBe(mover.body.bookOrder);
    expect(move.body.timelineOrder).toBeGreaterThan(anchor.body.timelineOrder);

    const detail = await authed("get", `/api/timeline-events/${mover.body.id}`, accessToken);
    expect(detail.body.threadStatus).toBe("open");
    expect(detail.body.relations.outgoing).toHaveLength(1);
  });

  it("moves an event after an interior neighbor without a unique collision", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const targetLine = await authed("post", `/api/books/${bookId}/timelines`, accessToken).send({
      name: "Future",
    });
    const first = await createTitledEvent(accessToken, bookId, "T1", {
      timelineId: targetLine.body.id,
    });
    const second = await createTitledEvent(accessToken, bookId, "T2", {
      timelineId: targetLine.body.id,
    });
    await createTitledEvent(accessToken, bookId, "T3", { timelineId: targetLine.body.id });
    const mover = await createTitledEvent(accessToken, bookId, "mover");

    const move = await authed(
      "post",
      `/api/timeline-events/${mover.body.id}/move`,
      accessToken,
    ).send({ afterEventId: first.body.id, targetTimelineId: targetLine.body.id });
    expect(move.status).toBe(HttpStatus.OK);
    expect(move.body.timelineId).toBe(targetLine.body.id);
    expect(move.body.bookOrder).toBe(mover.body.bookOrder);
    expect(move.body.timelineOrder).toBeGreaterThan(first.body.timelineOrder);
    expect(move.body.timelineOrder).toBeLessThan(second.body.timelineOrder);

    const list = await listEvents(
      accessToken,
      bookId,
      `?sort=timeline_order&pageSize=100&timelineId=${targetLine.body.id}`,
    );
    expect(list.body.items.map((event: { title: string }) => event.title)).toEqual([
      "T1",
      "mover",
      "T2",
      "T3",
    ]);
  });
});

describe("interior neighbor reorder", () => {
  it("places an event after an interior neighbor without a unique collision", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const first = await createTitledEvent(accessToken, bookId, "A");
    const second = await createTitledEvent(accessToken, bookId, "B");
    const third = await createTitledEvent(accessToken, bookId, "C");

    const reorder = await authed(
      "post",
      `/api/timeline-events/${third.body.id}/reorder`,
      accessToken,
    ).send({ afterEventId: first.body.id, expectedUpdatedAt: third.body.updatedAt, scope: "book" });
    expect(reorder.status).toBe(HttpStatus.OK);
    expect(reorder.body.bookOrder).toBeGreaterThan(first.body.bookOrder);
    expect(reorder.body.bookOrder).toBeLessThan(second.body.bookOrder);

    const list = await listEvents(accessToken, bookId, "?sort=book_order&pageSize=100");
    expect(list.body.items.map((event: { title: string }) => event.title)).toEqual(["A", "C", "B"]);
    const orders = list.body.items.map((event: { bookOrder: number }) => event.bookOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("places an event before an interior neighbor without a unique collision", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const first = await createTitledEvent(accessToken, bookId, "A");
    const second = await createTitledEvent(accessToken, bookId, "B");
    const third = await createTitledEvent(accessToken, bookId, "C");

    const reorder = await authed(
      "post",
      `/api/timeline-events/${first.body.id}/reorder`,
      accessToken,
    ).send({
      beforeEventId: third.body.id,
      expectedUpdatedAt: first.body.updatedAt,
      scope: "book",
    });
    expect(reorder.status).toBe(HttpStatus.OK);
    expect(reorder.body.bookOrder).toBeGreaterThan(second.body.bookOrder);
    expect(reorder.body.bookOrder).toBeLessThan(third.body.bookOrder);

    const list = await listEvents(accessToken, bookId, "?sort=book_order&pageSize=100");
    expect(list.body.items.map((event: { title: string }) => event.title)).toEqual(["B", "A", "C"]);
  });

  it("resolves non-adjacent both-anchor reorder deterministically as place-after", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const first = await createTitledEvent(accessToken, bookId, "A");
    const second = await createTitledEvent(accessToken, bookId, "B");
    const third = await createTitledEvent(accessToken, bookId, "C");
    const fourth = await createTitledEvent(accessToken, bookId, "D");

    const reorder = await authed(
      "post",
      `/api/timeline-events/${fourth.body.id}/reorder`,
      accessToken,
    ).send({
      afterEventId: first.body.id,
      beforeEventId: third.body.id,
      expectedUpdatedAt: fourth.body.updatedAt,
      scope: "book",
    });
    expect(reorder.status).toBe(HttpStatus.OK);
    expect(reorder.body.bookOrder).toBeGreaterThan(first.body.bookOrder);
    expect(reorder.body.bookOrder).toBeLessThan(second.body.bookOrder);

    const list = await listEvents(accessToken, bookId, "?sort=book_order&pageSize=100");
    expect(list.body.items.map((event: { title: string }) => event.title)).toEqual([
      "A",
      "D",
      "B",
      "C",
    ]);
  });

  it("triggers a rebalance when the integer gap is exhausted and still lands correctly", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const anchor = await createTitledEvent(accessToken, bookId, "anchor");
    const tail = await createTitledEvent(accessToken, bookId, "tail");

    for (let index = 0; index < 15; index += 1) {
      const created = await createTitledEvent(accessToken, bookId, `filler-${index}`);
      const reorder = await authed(
        "post",
        `/api/timeline-events/${created.body.id}/reorder`,
        accessToken,
      ).send({
        afterEventId: anchor.body.id,
        expectedUpdatedAt: created.body.updatedAt,
        scope: "book",
      });
      expect(reorder.status).toBe(HttpStatus.OK);
      expect(reorder.body.bookOrder).toBeGreaterThan(anchor.body.bookOrder);
    }

    const all = await listEvents(accessToken, bookId, "?sort=book_order&pageSize=100");
    const orders = all.body.items.map((event: { bookOrder: number }) => event.bookOrder);
    expect(new Set(orders).size).toBe(orders.length);
    expect(all.body.items[0].id).toBe(anchor.body.id);
    expect(all.body.items[all.body.items.length - 1].id).toBe(tail.body.id);
  });
});

describe("pagination bounds", () => {
  it("rejects an out-of-range page number instead of overflowing the offset", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const res = await listEvents(accessToken, bookId, "?pageNumber=99999999999");
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.status).not.toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});

describe("event relations", () => {
  it("creates a relation shown in both directions and rejects invalid targets", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const source = await createTitledEvent(accessToken, bookId, "cause");
    const target = await createTitledEvent(accessToken, bookId, "effect");

    const created = await authed(
      "post",
      `/api/timeline-events/${source.body.id}/relations`,
      accessToken,
    ).send({ relationType: "foreshadows", targetEventId: target.body.id });
    expect(created.status).toBe(HttpStatus.CREATED);

    const selfRef = await authed(
      "post",
      `/api/timeline-events/${source.body.id}/relations`,
      accessToken,
    ).send({ relationType: "related", targetEventId: source.body.id });
    expect(selfRef.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(selfRef.body.code).toBe("timeline_self_relation");

    const duplicate = await authed(
      "post",
      `/api/timeline-events/${source.body.id}/relations`,
      accessToken,
    ).send({ relationType: "foreshadows", targetEventId: target.body.id });
    expect(duplicate.status).toBe(HttpStatus.CONFLICT);

    const sourceDetail = await authed("get", `/api/timeline-events/${source.body.id}`, accessToken);
    expect(sourceDetail.body.relations.outgoing).toHaveLength(1);
    const targetDetail = await authed("get", `/api/timeline-events/${target.body.id}`, accessToken);
    expect(targetDetail.body.relations.incoming).toHaveLength(1);
  });

  it("rejects a relation to an event of another book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const otherBookId = await createBook(accessToken, { title: "Other" });
    const source = await createTitledEvent(accessToken, bookId, "here");
    const foreign = await createTitledEvent(accessToken, otherBookId, "there");

    const res = await authed(
      "post",
      `/api/timeline-events/${source.body.id}/relations`,
      accessToken,
    ).send({ relationType: "related", targetEventId: foreign.body.id });
    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe("timeline_cross_book_relation");
  });

  it("removes relations in both directions when an event is deleted", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const a = await createTitledEvent(accessToken, bookId, "A");
    const b = await createTitledEvent(accessToken, bookId, "B");
    const c = await createTitledEvent(accessToken, bookId, "C");
    await authed("post", `/api/timeline-events/${a.body.id}/relations`, accessToken).send({
      relationType: "follows_from",
      targetEventId: b.body.id,
    });
    await authed("post", `/api/timeline-events/${b.body.id}/relations`, accessToken).send({
      relationType: "follows_from",
      targetEventId: c.body.id,
    });

    const deleted = await authed("delete", `/api/timeline-events/${b.body.id}`, accessToken);
    expect(deleted.status).toBe(HttpStatus.NO_CONTENT);

    const aDetail = await authed("get", `/api/timeline-events/${a.body.id}`, accessToken);
    expect(aDetail.body.relations.outgoing).toHaveLength(0);
    const cDetail = await authed("get", `/api/timeline-events/${c.body.id}`, accessToken);
    expect(cDetail.body.relations.incoming).toHaveLength(0);
  });

  it("keeps relations after a reorder", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const a = await createTitledEvent(accessToken, bookId, "A");
    const b = await createTitledEvent(accessToken, bookId, "B");
    await authed("post", `/api/timeline-events/${a.body.id}/relations`, accessToken).send({
      relationType: "related",
      targetEventId: b.body.id,
    });

    const reorder = await authed(
      "post",
      `/api/timeline-events/${a.body.id}/reorder`,
      accessToken,
    ).send({ afterEventId: b.body.id, expectedUpdatedAt: a.body.updatedAt, scope: "book" });
    expect(reorder.status).toBe(HttpStatus.OK);

    const detail = await authed("get", `/api/timeline-events/${a.body.id}`, accessToken);
    expect(detail.body.relations.outgoing).toHaveLength(1);
  });
});

describe("thread status and resolution", () => {
  it("filters unresolved events", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createTitledEvent(accessToken, bookId, "open question", { threadStatus: "open" });
    await createTitledEvent(accessToken, bookId, "resolved thread", { threadStatus: "resolved" });
    await createTitledEvent(accessToken, bookId, "plain");

    const res = await listEvents(accessToken, bookId, "?unresolved=true");
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0].title).toBe("open question");
  });

  it("links a resolving event of the same book and rejects a cross-book resolution", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const otherBookId = await createBook(accessToken, { title: "Other" });
    const question = await createTitledEvent(accessToken, bookId, "mystery", {
      threadStatus: "open",
    });
    const answer = await createTitledEvent(accessToken, bookId, "reveal");
    const foreign = await createTitledEvent(accessToken, otherBookId, "foreign");

    const resolved = await authed(
      "patch",
      `/api/timeline-events/${question.body.id}`,
      accessToken,
    ).send({ resolvedByEventId: answer.body.id, threadStatus: "resolved" });
    expect(resolved.status).toBe(HttpStatus.OK);
    expect(resolved.body.resolvedByEventId).toBe(answer.body.id);

    const detail = await authed("get", `/api/timeline-events/${question.body.id}`, accessToken);
    expect(detail.body.resolvedBy.id).toBe(answer.body.id);

    const crossBook = await authed(
      "patch",
      `/api/timeline-events/${question.body.id}`,
      accessToken,
    ).send({ resolvedByEventId: foreign.body.id });
    expect(crossBook.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(crossBook.body.code).toBe("timeline_invalid_resolved_by");
  });
});

describe("recap filter", () => {
  it("includes events up to the position and page-less events, excluding those ahead", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 100 });
    await setCurrentPage(accessToken, bookId, 50);
    await createTitledEvent(accessToken, bookId, "behind", { pageNumber: 30 });
    await createTitledEvent(accessToken, bookId, "ahead", { pageNumber: 70 });
    await createTitledEvent(accessToken, bookId, "unknown page");

    const res = await listEvents(accessToken, bookId, "?recap=true&sort=book_order");
    const titles = res.body.items.map((event: { title: string }) => event.title);
    expect(titles).toContain("behind");
    expect(titles).toContain("unknown page");
    expect(titles).not.toContain("ahead");
  });

  it("returns all events for recap when the reading position is unknown", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 100 });
    await createTitledEvent(accessToken, bookId, "one", { pageNumber: 10 });
    await createTitledEvent(accessToken, bookId, "two", { pageNumber: 90 });

    const res = await listEvents(accessToken, bookId, "?recap=true");
    expect(res.body.totalCount).toBe(2);
  });
});

describe("importance filters", () => {
  it("applies the important and key-only presets", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createTitledEvent(accessToken, bookId, "low one", { importance: "low" });
    await createTitledEvent(accessToken, bookId, "high one", { importance: "high" });
    await createTitledEvent(accessToken, bookId, "key one", { importance: "key" });

    const important = await listEvents(accessToken, bookId, "?important=true");
    expect(important.body.totalCount).toBe(2);
    const keyOnly = await listEvents(accessToken, bookId, "?keyOnly=true");
    expect(keyOnly.body.totalCount).toBe(1);
    expect(keyOnly.body.items[0].title).toBe("key one");
  });
});

describe("overview", () => {
  it("returns distributions that match the real counts and the reading split", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 100 });
    await setCurrentPage(accessToken, bookId, 50);
    await createTitledEvent(accessToken, bookId, "battle one", {
      eventType: "battle",
      importance: "high",
      pageNumber: 20,
    });
    await createTitledEvent(accessToken, bookId, "battle two", {
      eventType: "battle",
      importance: "high",
      pageNumber: 80,
    });
    await createTitledEvent(accessToken, bookId, "mystery one", {
      eventType: "mystery",
      threadStatus: "open",
    });

    const res = await authed("get", `/api/books/${bookId}/timeline/overview`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalEvents).toBe(3);
    expect(res.body.unresolvedCount).toBe(1);
    expect(res.body.readingPosition).toEqual({
      currentPage: 50,
      guardDefault: true,
      positionKnown: true,
    });
    expect(res.body.eventsBeforePosition).toBe(1);
    expect(res.body.eventsAfterPosition).toBe(1);
    expect(res.body.eventsUnknownPosition).toBe(1);

    const battle = res.body.byType.find((row: { eventType: string }) => row.eventType === "battle");
    expect(battle.count).toBe(2);
  });
});

describe("event ownership", () => {
  it("hides another user's event from every operation", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const bookId = await createBook(owner.accessToken);
    const event = await createTitledEvent(owner.accessToken, bookId, "secret");

    const get = await authed("get", `/api/timeline-events/${event.body.id}`, intruder.accessToken);
    expect(get.status).toBe(HttpStatus.NOT_FOUND);
    const patch = await authed(
      "patch",
      `/api/timeline-events/${event.body.id}`,
      intruder.accessToken,
    ).send({ title: "hijack" });
    expect(patch.status).toBe(HttpStatus.NOT_FOUND);
    const del = await authed(
      "delete",
      `/api/timeline-events/${event.body.id}`,
      intruder.accessToken,
    );
    expect(del.status).toBe(HttpStatus.NOT_FOUND);
    const listAttempt = await listEvents(intruder.accessToken, bookId);
    expect(listAttempt.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 404 for a missing event", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await authed("get", `/api/timeline-events/${MISSING_ID}`, accessToken);
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});
