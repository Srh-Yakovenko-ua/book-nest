import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import { addDays, subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { SeriesModule } from "../../series/series.module.js";
import { NotesModule } from "../notes.module.js";

const BOOK_FACETS_PATH = "/api/notes/books/facets";
const BOOK_SUMMARY_PATH = "/api/notes/books/summary";
const OUTSIDE_RECENT_WINDOW_DAYS = 31;
const TRASH_PURGE_DAYS = 30;

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

function authed(method: "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

function authorIdByName(body: { authors: { id: string; name: string }[] }, name: string): string {
  const author = body.authors.find((entry) => entry.name === name);
  expect(author).toBeDefined();
  return author?.id ?? "";
}

async function createBook(
  token: string,
  book: { authors: string[]; title: string },
): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: book.authors.map((name) => ({ name })),
    ownershipStatus: "owned",
    title: book.title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createBookNote(
  token: string,
  bookId: string,
  body: Record<string, unknown> = {},
): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/notes`, token).send({
    text: "A strong scene worth remembering",
    ...body,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

describe("GET /api/notes/books/facets", () => {
  it("keeps other authors in the authors facet while one author is selected", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { authors: ["Frank Herbert"], title: "Dune" });
    const hyperionId = await createBook(accessToken, {
      authors: ["Dan Simmons"],
      title: "Hyperion",
    });
    await createBookNote(accessToken, duneId);
    await createBookNote(accessToken, duneId);
    await createBookNote(accessToken, hyperionId);

    const unfiltered = await authed("get", BOOK_FACETS_PATH, accessToken);
    expect(unfiltered.status).toBe(HttpStatus.OK);
    const herbertId = authorIdByName(unfiltered.body, "Frank Herbert");

    const res = await authed("get", `${BOOK_FACETS_PATH}?author=${herbertId}`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.authors).toEqual([
      { count: 2, id: herbertId, name: "Frank Herbert" },
      { count: 1, id: authorIdByName(unfiltered.body, "Dan Simmons"), name: "Dan Simmons" },
    ]);
    expect(res.body.books).toEqual([{ count: 2, id: duneId, title: "Dune" }]);
    expect(res.body.quickCounts.all).toBe(2);
  });

  it("keeps other books in the books facet while one book is selected", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { authors: ["Frank Herbert"], title: "Dune" });
    const hyperionId = await createBook(accessToken, {
      authors: ["Dan Simmons"],
      title: "Hyperion",
    });
    await createBookNote(accessToken, duneId);
    await createBookNote(accessToken, hyperionId);

    const res = await authed("get", `${BOOK_FACETS_PATH}?book=${duneId}`, accessToken);

    expect(res.body.books).toEqual([
      { count: 1, id: duneId, title: "Dune" },
      { count: 1, id: hyperionId, title: "Hyperion" },
    ]);
    expect(res.body.authors).toEqual([
      expect.objectContaining({ count: 1, name: "Frank Herbert" }),
    ]);
  });

  it("SH-Q-05 BOOK-Q-05 computes quick counts under search and filters but ignores the quick filter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { authors: ["Frank Herbert"], title: "Dune" });
    const hyperionId = await createBook(accessToken, {
      authors: ["Dan Simmons"],
      title: "Hyperion",
    });
    await createBookNote(accessToken, duneId, { isFavorite: true, isPinned: true });
    await createBookNote(accessToken, duneId, { isFavorite: true, isSpoiler: true });
    await createBookNote(accessToken, duneId);
    await createBookNote(accessToken, hyperionId, { isFavorite: true });

    const expectedDuneCounts = {
      all: 3,
      favorite: 2,
      no_spoiler: 2,
      pinned: 1,
      with_spoiler: 1,
    };

    const byBook = await authed("get", `${BOOK_FACETS_PATH}?book=${duneId}`, accessToken);
    expect(byBook.body.quickCounts).toEqual(expectedDuneCounts);

    const pinnedSelected = await authed(
      "get",
      `${BOOK_FACETS_PATH}?book=${duneId}&filter=pinned`,
      accessToken,
    );
    expect(pinnedSelected.body.quickCounts).toEqual(expectedDuneCounts);

    const bySearch = await authed("get", `${BOOK_FACETS_PATH}?search=hyperion`, accessToken);
    expect(bySearch.body.quickCounts).toEqual({
      all: 1,
      favorite: 1,
      no_spoiler: 1,
      pinned: 0,
      with_spoiler: 0,
    });
  });

  it("treats standard and custom categories as one dimension that ignores its own selection", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { authors: ["Frank Herbert"], title: "Dune" });
    const hyperionId = await createBook(accessToken, {
      authors: ["Dan Simmons"],
      title: "Hyperion",
    });
    await createBookNote(accessToken, duneId, { category: "plot" });
    await createBookNote(accessToken, duneId, { category: "other", customCategory: "Spice" });
    await createBookNote(accessToken, hyperionId, { category: "plot" });

    const res = await authed(
      "get",
      `${BOOK_FACETS_PATH}?category=plot&book=${duneId}`,
      accessToken,
    );

    expect(res.body.categories).toEqual([
      { category: "other", count: 1 },
      { category: "plot", count: 1 },
    ]);
    expect(res.body.customCategories).toEqual([{ count: 1, value: "Spice" }]);
    expect(res.body.quickCounts.all).toBe(1);
  });

  it("counts a note of a co-authored book for every author", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const goodOmensId = await createBook(accessToken, {
      authors: ["Terry Pratchett", "Neil Gaiman"],
      title: "Good Omens",
    });
    await createBookNote(accessToken, goodOmensId);

    const res = await authed("get", BOOK_FACETS_PATH, accessToken);

    expect(res.body.authors).toEqual([
      expect.objectContaining({ count: 1, name: "Neil Gaiman" }),
      expect.objectContaining({ count: 1, name: "Terry Pratchett" }),
    ]);
  });
});

describe("GET /api/notes/books/summary", () => {
  it("returns an empty summary when the user has no book notes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("get", BOOK_SUMMARY_PATH, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual({
      bookNotesCount: 0,
      booksWithFiveOrMoreNotesCount: 0,
      booksWithNotesCount: 0,
      createdLast30DaysCount: 0,
      topAuthor: null,
      topBook: null,
    });
  });

  it("summarises active book notes only and stays stable under archive params", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { authors: ["Frank Herbert"], title: "Dune" });
    const hyperionId = await createBook(accessToken, {
      authors: ["Dan Simmons"],
      title: "Hyperion",
    });
    const oldNoteId = await createBookNote(accessToken, duneId);
    await createBookNote(accessToken, duneId, { isPinned: true });
    await createBookNote(accessToken, hyperionId);
    const trashedNoteId = await createBookNote(accessToken, hyperionId);
    const series = await authed("post", "/api/series", accessToken).send({ name: "Earthsea" });
    await authed("post", `/api/series/${series.body.id}/notes`, accessToken).send({
      text: "Series thought",
    });
    const prisma = app.get(PrismaService);
    const trashedAt = new Date();
    await prisma.note.update({
      data: { deletedAt: trashedAt, purgeAt: addDays(trashedAt, TRASH_PURGE_DAYS) },
      where: { id: trashedNoteId },
    });
    await prisma.note.update({
      data: { createdAt: subDays(new Date(), OUTSIDE_RECENT_WINDOW_DAYS) },
      where: { id: oldNoteId },
    });

    const res = await authed("get", BOOK_SUMMARY_PATH, accessToken);

    expect(res.body).toEqual({
      bookNotesCount: 3,
      booksWithFiveOrMoreNotesCount: 0,
      booksWithNotesCount: 2,
      createdLast30DaysCount: 2,
      topAuthor: { leadersCount: 1, name: "Frank Herbert", notesCount: 2 },
      topBook: { leadersCount: 1, notesCount: 2, title: "Dune" },
    });

    const withArchiveParams = await authed(
      "get",
      `${BOOK_SUMMARY_PATH}?search=hyperion&filter=pinned&book=${hyperionId}&sort=oldest`,
      accessToken,
    );
    expect(withArchiveParams.body).toEqual(res.body);
  });
});
