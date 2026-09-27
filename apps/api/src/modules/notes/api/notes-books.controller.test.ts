import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { SeriesModule } from "../../series/series.module.js";
import { NotesModule } from "../notes.module.js";

const BOOK_ARCHIVE_PATH = "/api/notes/books";

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

async function createBook(token: string, book: { author: string; title: string }): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: book.author }],
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

function listIds(body: { items: { id: string }[] }): string[] {
  return body.items.map((item) => item.id);
}

describe("GET /api/notes/books", () => {
  it("BOOK-Q-01 returns only active book notes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const noteId = await createBookNote(accessToken, bookId);
    const series = await authed("post", "/api/series", accessToken).send({ name: "Earthsea" });
    await authed("post", `/api/series/${series.body.id}/notes`, accessToken).send({
      text: "Series thought",
    });

    const res = await authed("get", BOOK_ARCHIVE_PATH, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(listIds(res.body)).toEqual([noteId]);
  });

  it("SH-Q-06 promotes pinned notes only under pinned_first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const pinnedOlderId = await createBookNote(accessToken, bookId, { isPinned: true });
    const newerId = await createBookNote(accessToken, bookId);

    const newest = await authed("get", BOOK_ARCHIVE_PATH, accessToken);
    expect(listIds(newest.body)).toEqual([newerId, pinnedOlderId]);

    const pinnedFirst = await authed("get", `${BOOK_ARCHIVE_PATH}?sort=pinned_first`, accessToken);
    expect(listIds(pinnedFirst.body)).toEqual([pinnedOlderId, newerId]);
  });

  it("SH-Q-02 BOOK-Q-04 ORs book ids inside the dimension and ANDs the category dimension", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const hyperionId = await createBook(accessToken, { author: "Dan Simmons", title: "Hyperion" });
    const plotNoteId = await createBookNote(accessToken, duneId, { category: "plot" });
    const customNoteId = await createBookNote(accessToken, hyperionId, {
      category: "other",
      customCategory: "Shrike",
    });
    await createBookNote(accessToken, hyperionId, { category: "characters" });

    const bothBooks = await authed(
      "get",
      `${BOOK_ARCHIVE_PATH}?book=${duneId}&book=${hyperionId}`,
      accessToken,
    );
    expect(bothBooks.body.totalCount).toBe(3);

    const categoryDimension = await authed(
      "get",
      `${BOOK_ARCHIVE_PATH}?category=plot&customCategory=Shrike&sort=oldest`,
      accessToken,
    );
    expect(listIds(categoryDimension.body)).toEqual([plotNoteId, customNoteId]);

    const narrowed = await authed(
      "get",
      `${BOOK_ARCHIVE_PATH}?category=plot&customCategory=Shrike&book=${hyperionId}`,
      accessToken,
    );
    expect(listIds(narrowed.body)).toEqual([customNoteId]);
  });

  it("does not match a raw standard category key through search", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    await createBookNote(accessToken, bookId, { category: "worldbuilding", text: "Spice" });

    const res = await authed("get", `${BOOK_ARCHIVE_PATH}?search=worldbuilding`, accessToken);

    expect(res.body.totalCount).toBe(0);
  });
});

describe("GET /api/notes/books search", () => {
  it("BOOK-Q-02 matches a note by its exact page number only", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const exactId = await createBookNote(accessToken, bookId, { page: 146, text: "Desert" });
    await createBookNote(accessToken, bookId, { page: 14, text: "Desert" });
    await createBookNote(accessToken, bookId, { page: 1460, text: "Desert" });

    const res = await authed("get", `${BOOK_ARCHIVE_PATH}?search=146`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(listIds(res.body)).toEqual([exactId]);
    expect(res.body.totalCount).toBe(1);
  });

  it("BOOK-Q-02 matches a note by its chapter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const chapterId = await createBookNote(accessToken, bookId, {
      chapter: "Arrakeen Palace",
      text: "Desert",
    });
    await createBookNote(accessToken, bookId, { chapter: "Sietch Tabr", text: "Desert" });

    const res = await authed("get", `${BOOK_ARCHIVE_PATH}?search=arrakeen`, accessToken);

    expect(listIds(res.body)).toEqual([chapterId]);
  });

  it("BOOK-Q-02 matches a note through its book original title", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const translated = await authed("post", "/api/books", accessToken).send({
      authors: [{ name: "Frank Herbert" }],
      originalTitle: "Children of Dune",
      ownershipStatus: "owned",
      title: "Діти Дюни",
    });
    expect(translated.status).toBe(HttpStatus.CREATED);
    const matchingId = await createBookNote(accessToken, translated.body.id, { text: "Leto" });
    const otherBookId = await createBook(accessToken, { author: "Dan Simmons", title: "Hyperion" });
    await createBookNote(accessToken, otherBookId, { text: "Leto" });

    const res = await authed("get", `${BOOK_ARCHIVE_PATH}?search=children`, accessToken);

    expect(listIds(res.body)).toEqual([matchingId]);
  });
});

describe("GET /api/notes/books sort across pages", () => {
  const PAGE_SIZE = 2;

  async function collectPages(token: string, sort: string, pageCount: number): Promise<string[]> {
    const pageNumbers = Array.from({ length: pageCount }, (_unused, index) => index + 1);
    const pages = await Promise.all(
      pageNumbers.map((pageNumber) =>
        authed(
          "get",
          `${BOOK_ARCHIVE_PATH}?sort=${sort}&pageSize=${PAGE_SIZE}&pageNumber=${pageNumber}`,
          token,
        ),
      ),
    );
    return pages.flatMap((page) => {
      expect(page.status).toBe(HttpStatus.OK);
      expect(page.body.items.length).toBeLessThanOrEqual(PAGE_SIZE);
      return listIds(page.body);
    });
  }

  function byId(ids: string[]): string[] {
    return [...ids].sort();
  }

  it("orders by first author, then title, then id without gaps or repeats", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const herbertId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const asimovId = await createBook(accessToken, { author: "Isaac Asimov", title: "Foundation" });
    const simmonsId = await createBook(accessToken, { author: "Dan Simmons", title: "Hyperion" });
    const herbertNotes = [
      await createBookNote(accessToken, herbertId),
      await createBookNote(accessToken, herbertId),
    ];
    const asimovNotes = [
      await createBookNote(accessToken, asimovId),
      await createBookNote(accessToken, asimovId),
    ];
    const simmonsNote = await createBookNote(accessToken, simmonsId);

    const ids = await collectPages(accessToken, "author", 3);

    expect(ids).toEqual([simmonsNote, ...byId(herbertNotes), ...byId(asimovNotes)]);
  });

  it("BOOK-Q-06 orders by book title, then page with missing pages last, then id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const anathemId = await createBook(accessToken, {
      author: "Neal Stephenson",
      title: "Anathem",
    });
    const anathemNote = await createBookNote(accessToken, anathemId, { page: 900 });
    const noPageNote = await createBookNote(accessToken, duneId);
    const page30Note = await createBookNote(accessToken, duneId, { page: 30 });
    const page10Notes = [
      await createBookNote(accessToken, duneId, { page: 10 }),
      await createBookNote(accessToken, duneId, { page: 10 }),
    ];

    const ids = await collectPages(accessToken, "page", 3);

    expect(ids).toEqual([anathemNote, ...byId(page10Notes), page30Note, noPageNote]);
  });
});

describe("GET /api/notes/books acceptance gaps", () => {
  it("BOOK-Q-02 matches note text, book title, canonical author and custom category", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const hyperionId = await createBook(accessToken, { author: "Dan Simmons", title: "Hyperion" });
    const textId = await createBookNote(accessToken, duneId, { text: "The spice must flow" });
    const customId = await createBookNote(accessToken, duneId, {
      category: "other",
      customCategory: "Bene Gesserit",
      text: "Litany",
    });
    const hyperionNoteId = await createBookNote(accessToken, hyperionId, { text: "Pilgrims" });

    const byText = await authed("get", `${BOOK_ARCHIVE_PATH}?search=spice`, accessToken);
    const byTitle = await authed("get", `${BOOK_ARCHIVE_PATH}?search=hyperion`, accessToken);
    const byAuthor = await authed("get", `${BOOK_ARCHIVE_PATH}?search=simmons`, accessToken);
    const byCustom = await authed("get", `${BOOK_ARCHIVE_PATH}?search=gesserit`, accessToken);

    expect(listIds(byText.body)).toEqual([textId]);
    expect(listIds(byTitle.body)).toEqual([hyperionNoteId]);
    expect(listIds(byAuthor.body)).toEqual([hyperionNoteId]);
    expect(listIds(byCustom.body)).toEqual([customId]);
  });

  it("BOOK-Q-04 filters by author id and page or chapter presence, ignoring series-only keys", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const hyperionId = await createBook(accessToken, { author: "Dan Simmons", title: "Hyperion" });
    const pagedId = await createBookNote(accessToken, duneId, { page: 12 });
    const chapteredId = await createBookNote(accessToken, duneId, { chapter: "Arrakeen" });
    const hyperionNoteId = await createBookNote(accessToken, hyperionId);
    const facets = await authed("get", `${BOOK_ARCHIVE_PATH}/facets`, accessToken);
    const herbert = facets.body.authors.find(
      (author: { name: string }) => author.name === "Frank Herbert",
    );

    const byAuthor = await authed(
      "get",
      `${BOOK_ARCHIVE_PATH}?author=${herbert.id}&sort=oldest`,
      accessToken,
    );
    const withPage = await authed("get", `${BOOK_ARCHIVE_PATH}?hasPage=true`, accessToken);
    const withChapter = await authed("get", `${BOOK_ARCHIVE_PATH}?hasChapter=true`, accessToken);
    const withSeriesKey = await authed(
      "get",
      `${BOOK_ARCHIVE_PATH}?status=completed&reading=empty`,
      accessToken,
    );

    expect(listIds(byAuthor.body)).toEqual([pagedId, chapteredId]);
    expect(listIds(withPage.body)).toEqual([pagedId]);
    expect(listIds(withChapter.body)).toEqual([chapteredId]);
    expect(withSeriesKey.body.totalCount).toBe(3);
    expect(listIds(withSeriesKey.body)).toContain(hyperionNoteId);
  });
});
