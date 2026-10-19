import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { NotesModule } from "../../notes/notes.module.js";
import { SeriesModule } from "../../series/series.module.js";
import { BooksModule } from "../books.module.js";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, SeriesModule, NotesModule]);
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

function authed(method: "delete" | "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, body: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
    ...body,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createBookNote(token: string, bookId: string): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/notes`, token).send({
    text: "A strong scene worth remembering",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createBookNotes(token: string, bookId: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    ids.push(await createBookNote(token, bookId));
  }
  return ids;
}

async function notesCountOf(token: string, bookId: string): Promise<number> {
  const res = await authed("get", `/api/books/${bookId}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body.notesCount;
}

describe("GET /api/books/:id notesCount", () => {
  it("returns 0 for a book without notes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const res = await authed("get", `/api/books/${bookId}`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({ id: bookId, notesCount: 0, title: "Dune" });
  });

  it("returns 11 for a book with 11 active notes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createBookNotes(accessToken, bookId, 11);

    expect(await notesCountOf(accessToken, bookId)).toBe(11);
  });

  it("counts only the requested book's notes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const otherBookId = await createBook(accessToken, { title: "Hyperion" });
    await createBookNotes(accessToken, bookId, 2);
    await createBookNotes(accessToken, otherBookId, 3);

    expect(await notesCountOf(accessToken, bookId)).toBe(2);
  });

  it("does not count soft-deleted notes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const [trashedId, trashedAgainId] = await createBookNotes(accessToken, bookId, 5);
    await authed("delete", `/api/notes/${trashedId}`, accessToken).expect(HttpStatus.OK);
    await authed("delete", `/api/notes/${trashedAgainId}`, accessToken).expect(HttpStatus.OK);

    expect(await notesCountOf(accessToken, bookId)).toBe(3);
  });

  it("does not count series notes of the series the book belongs to", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await authed("post", "/api/series", accessToken).send({ name: "Dune Saga" });
    expect(series.status).toBe(HttpStatus.CREATED);
    const bookId = await createBook(accessToken, {
      bookType: "series_part",
      partNumber: 1,
      seriesId: series.body.id,
    });
    await createBookNote(accessToken, bookId);
    const seriesNote = await authed(
      "post",
      `/api/series/${series.body.id}/notes`,
      accessToken,
    ).send({ text: "A thread across the whole saga" });
    expect(seriesNote.status).toBe(HttpStatus.CREATED);

    expect(await notesCountOf(accessToken, bookId)).toBe(1);
  });

  it("does not let another user's book notes leak into the owner's count", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    await createBookNote(owner.accessToken, bookId);
    const strangerBookId = await createBook(stranger.accessToken);
    await createBookNotes(stranger.accessToken, strangerBookId, 3);

    const strangerAttempt = await authed(
      "post",
      `/api/books/${bookId}/notes`,
      stranger.accessToken,
    ).send({ text: "Not my book" });

    expect(strangerAttempt.status).toBe(HttpStatus.NOT_FOUND);
    expect(await notesCountOf(owner.accessToken, bookId)).toBe(1);
  });

  it("returns 404 without notesCount when another user requests the owner's book with notes", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    await createBookNotes(owner.accessToken, bookId, 2);

    const res = await authed("get", `/api/books/${bookId}`, stranger.accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body).not.toHaveProperty("notesCount");
  });

  it("matches the totalCount of the book notes archive filtered by the same book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await authed("post", "/api/series", accessToken).send({ name: "Dune Saga" });
    expect(series.status).toBe(HttpStatus.CREATED);
    const bookId = await createBook(accessToken, {
      bookType: "series_part",
      partNumber: 1,
      seriesId: series.body.id,
    });
    const otherBookId = await createBook(accessToken, { title: "Hyperion" });
    const [trashedId] = await createBookNotes(accessToken, bookId, 4);
    await authed("delete", `/api/notes/${trashedId}`, accessToken).expect(HttpStatus.OK);
    await createBookNotes(accessToken, otherBookId, 2);
    const seriesNote = await authed(
      "post",
      `/api/series/${series.body.id}/notes`,
      accessToken,
    ).send({ text: "A thread across the whole saga" });
    expect(seriesNote.status).toBe(HttpStatus.CREATED);

    const archive = await authed("get", `/api/notes/books?book=${bookId}`, accessToken);

    expect(archive.status).toBe(HttpStatus.OK);
    expect(archive.body.totalCount).toBe(3);
    expect(await notesCountOf(accessToken, bookId)).toBe(archive.body.totalCount);
  });
});

describe("GET /api/books notesCount", () => {
  it("does not add notesCount to book list items", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createBookNotes(accessToken, bookId, 2);

    const res = await authed("get", "/api/books", accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ id: bookId });
    expect(res.body.items[0]).not.toHaveProperty("notesCount");
  });
});
