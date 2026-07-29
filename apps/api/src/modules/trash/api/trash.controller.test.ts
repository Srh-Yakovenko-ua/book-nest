import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { BOOK_PURGE_QUEUE_NAME } from "../../books/domain/book-purge.js";
import { LIST_PURGE_QUEUE_NAME } from "../../lists/domain/list-purge.js";
import { ListsModule } from "../../lists/lists.module.js";
import { NOTE_PURGE_QUEUE_NAME } from "../../notes/domain/note-purge.js";
import { NotesModule } from "../../notes/notes.module.js";
import { QUOTE_PURGE_QUEUE_NAME } from "../../quotes/domain/quote-purge.js";
import { QuotesModule } from "../../quotes/quotes.module.js";
import { SERIES_PURGE_QUEUE_NAME } from "../../series/domain/series-purge.js";
import { SeriesModule } from "../../series/series.module.js";
import { TrashModule } from "../trash.module.js";

const queueStub = {
  add: (): Promise<void> => Promise.resolve(),
  remove: (): Promise<void> => Promise.resolve(),
};

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, TrashModule, ListsModule, SeriesModule, QuotesModule, NotesModule, BooksModule],
    [
      { provide: getQueueToken(BOOK_PURGE_QUEUE_NAME), useValue: queueStub },
      { provide: getQueueToken(SERIES_PURGE_QUEUE_NAME), useValue: queueStub },
      { provide: getQueueToken(LIST_PURGE_QUEUE_NAME), useValue: queueStub },
      { provide: getQueueToken(QUOTE_PURGE_QUEUE_NAME), useValue: queueStub },
      { provide: getQueueToken(NOTE_PURGE_QUEUE_NAME), useValue: queueStub },
    ],
  );
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

async function trashOneOfEach(token: string): Promise<{ bookId: string; seriesId: string }> {
  const book = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    newSeries: { name: "Dune Chronicles" },
    ownershipStatus: "owned",
    partNumber: 1,
    title: "Dune",
  });
  expect(book.status).toBe(HttpStatus.CREATED);
  const seriesId = book.body.series.id;

  const list = await authed("post", "/api/lists", token).send({ name: "Autumn" });
  expect(list.status).toBe(HttpStatus.CREATED);
  const quote = await authed("post", `/api/books/${book.body.id}/quotes`, token).send({
    text: "Fear is the mind-killer",
  });
  expect(quote.status).toBe(HttpStatus.CREATED);
  const note = await authed("post", `/api/books/${book.body.id}/notes`, token).send({
    text: "A thought",
  });
  expect(note.status).toBe(HttpStatus.CREATED);

  await authed("delete", `/api/books/${book.body.id}/quotes/${quote.body.id}`, token).expect(
    HttpStatus.OK,
  );
  await authed("delete", `/api/notes/${note.body.id}`, token).expect(HttpStatus.OK);
  await authed("delete", `/api/lists/${list.body.id}`, token).expect(HttpStatus.OK);
  await authed("delete", `/api/series/${seriesId}`, token).expect(HttpStatus.OK);
  await authed("delete", `/api/books/${book.body.id}`, token).expect(HttpStatus.OK);

  return { bookId: book.body.id, seriesId };
}

describe("GET /api/trash/summary", () => {
  it("counts every trashed entity type and reports the retention window", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await trashOneOfEach(accessToken);

    const res = await authed("get", "/api/trash/summary", accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.retentionDays).toBe(TRASH_RETENTION.days);
    expect(res.body.countsByType).toEqual({
      book: 1,
      book_list: 1,
      note: 1,
      quote: 1,
      series: 1,
    });
    expect(res.body.totalCount).toBe(5);
  });

  it("reports an empty trash as zero", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("get", "/api/trash/summary", accessToken);

    expect(res.body.totalCount).toBe(0);
    expect(res.body.countsByType).toEqual({});
  });
});

describe("GET /api/trash", () => {
  it("returns every trashed entity newest first with its purge date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await trashOneOfEach(accessToken);

    const res = await authed("get", "/api/trash", accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalCount).toBe(5);
    expect(res.body.items[0]).toMatchObject({ entityType: "book", id: bookId, title: "Dune" });
    expect(new Date(res.body.items[0].purgeAt)).toEqual(
      TRASH_RETENTION.purgeAfter(new Date(res.body.items[0].deletedAt)),
    );
    expect(res.body.items.map((item: { entityType: string }) => item.entityType).sort()).toEqual([
      "book",
      "book_list",
      "note",
      "quote",
      "series",
    ]);
  });

  it("filters by entity type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await trashOneOfEach(accessToken);

    const res = await authed("get", "/api/trash?entityType=quote", accessToken);

    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      context: "Dune",
      entityType: "quote",
      title: "Fear is the mind-killer",
    });
  });

  it("never leaks another user trash", async () => {
    const owner = await context.registerVerifyAndLogin();
    await trashOneOfEach(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await authed("get", "/api/trash", stranger.accessToken);

    expect(res.body.totalCount).toBe(0);
    expect(res.body.items).toEqual([]);
  });
});
