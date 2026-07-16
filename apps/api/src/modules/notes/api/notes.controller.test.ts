import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_ID = "99999999-9999-4999-8999-999999999999";

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

function createBookNote(
  token: string,
  bookId: string,
  body: Record<string, unknown>,
): request.Test {
  return authed("post", `/api/books/${bookId}/notes`, token).send(body);
}

async function createSeries(token: string, name = "Legendary Villains"): Promise<string> {
  const res = await authed("post", "/api/series", token).send({ name });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

const noteBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  text: "A strong scene worth remembering",
  ...overrides,
});

describe("book notes CRUD", () => {
  it("creates, lists, edits and deletes a book note", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const created = await createBookNote(
      accessToken,
      bookId,
      noteBody({ chapter: "Chapter 8", page: 146 }),
    );
    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body).toMatchObject({
      book: { id: bookId, title: "Dune" },
      chapter: "Chapter 8",
      entityType: "book",
      isFavorite: false,
      isPinned: false,
      isSpoiler: false,
      page: 146,
      series: null,
      text: "A strong scene worth remembering",
    });
    expect(created.body.id).toMatch(UUID);
    expect(created.body.book.cover).toBeNull();

    const list = await authed("get", `/api/books/${bookId}/notes`, accessToken);
    expect(list.status).toBe(HttpStatus.OK);
    expect(list.body.totalCount).toBe(1);
    expect(list.body.notes).toHaveLength(1);

    const edited = await authed("patch", `/api/notes/${created.body.id}`, accessToken).send({
      isFavorite: true,
      isPinned: true,
    });
    expect(edited.status).toBe(HttpStatus.OK);
    expect(edited.body.isFavorite).toBe(true);
    expect(edited.body.isPinned).toBe(true);

    const removed = await authed("delete", `/api/notes/${created.body.id}`, accessToken);
    expect(removed.status).toBe(HttpStatus.NO_CONTENT);

    const empty = await authed("get", `/api/books/${bookId}/notes`, accessToken);
    expect(empty.body.totalCount).toBe(0);
  });

  it("creates a series note bound only to the series", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(accessToken);

    const created = await authed("post", `/api/series/${seriesId}/notes`, accessToken).send(
      noteBody({ chapter: "Book 2, finale" }),
    );
    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body).toMatchObject({
      book: null,
      entityType: "series",
      series: { id: seriesId, name: "Legendary Villains" },
    });

    const list = await authed("get", `/api/series/${seriesId}/notes`, accessToken);
    expect(list.body.totalCount).toBe(1);
  });
});

describe("note validation", () => {
  it("rejects invalid note payloads", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const empty = await createBookNote(accessToken, bookId, { text: "   " });
    expect(empty.status).toBe(HttpStatus.BAD_REQUEST);

    const tooLong = await createBookNote(accessToken, bookId, { text: "x".repeat(5001) });
    expect(tooLong.status).toBe(HttpStatus.BAD_REQUEST);

    const zeroPage = await createBookNote(accessToken, bookId, noteBody({ page: 0 }));
    expect(zeroPage.status).toBe(HttpStatus.BAD_REQUEST);

    const negativePage = await createBookNote(accessToken, bookId, noteBody({ page: -3 }));
    expect(negativePage.status).toBe(HttpStatus.BAD_REQUEST);

    const longChapter = await createBookNote(
      accessToken,
      bookId,
      noteBody({ chapter: "c".repeat(101) }),
    );
    expect(longChapter.status).toBe(HttpStatus.BAD_REQUEST);

    const longCustom = await createBookNote(
      accessToken,
      bookId,
      noteBody({ category: "other", customCategory: "y".repeat(101) }),
    );
    expect(longCustom.status).toBe(HttpStatus.BAD_REQUEST);

    const maxText = await createBookNote(accessToken, bookId, { text: "x".repeat(5000) });
    expect(maxText.status).toBe(HttpStatus.CREATED);
  });

  it("drops the custom category unless the category is other", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const dropped = await createBookNote(
      accessToken,
      bookId,
      noteBody({ category: "characters", customCategory: "ignored" }),
    );
    expect(dropped.body.category).toBe("characters");
    expect(dropped.body.customCategory).toBeNull();

    const kept = await createBookNote(
      accessToken,
      bookId,
      noteBody({ category: "other", customCategory: "love line" }),
    );
    expect(kept.body.customCategory).toBe("love line");
  });
});

describe("note independence", () => {
  it("does not change the book favorite state when a note is favorited", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    await createBookNote(
      accessToken,
      bookId,
      noteBody({ isFavorite: true, isPinned: true, isSpoiler: true }),
    );

    const book = await authed("get", `/api/books/${bookId}`, accessToken);
    expect(book.body.isFavorite).toBe(false);
  });
});

describe("note ownership (IDOR)", () => {
  it("prevents access to another user's book, series and notes", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });

    const bookId = await createBook(owner.accessToken);
    const seriesId = await createSeries(owner.accessToken);
    const note = await createBookNote(owner.accessToken, bookId, noteBody());
    const noteId = note.body.id;

    const attachToForeignBook = await createBookNote(intruder.accessToken, bookId, noteBody());
    expect(attachToForeignBook.status).toBe(HttpStatus.NOT_FOUND);

    const attachToForeignSeries = await authed(
      "post",
      `/api/series/${seriesId}/notes`,
      intruder.accessToken,
    ).send(noteBody());
    expect(attachToForeignSeries.status).toBe(HttpStatus.NOT_FOUND);

    const readForeignBookNotes = await authed(
      "get",
      `/api/books/${bookId}/notes`,
      intruder.accessToken,
    );
    expect(readForeignBookNotes.status).toBe(HttpStatus.NOT_FOUND);

    const editForeignNote = await authed(
      "patch",
      `/api/notes/${noteId}`,
      intruder.accessToken,
    ).send({
      isFavorite: true,
    });
    expect(editForeignNote.status).toBe(HttpStatus.NOT_FOUND);

    const deleteForeignNote = await authed("delete", `/api/notes/${noteId}`, intruder.accessToken);
    expect(deleteForeignNote.status).toBe(HttpStatus.NOT_FOUND);

    const intruderArchive = await authed("get", "/api/notes", intruder.accessToken);
    expect(intruderArchive.body.totalCount).toBe(0);
  });

  it("returns 404 for a well-formed but missing note or book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const missingNote = await authed("patch", `/api/notes/${MISSING_ID}`, accessToken).send({
      isPinned: true,
    });
    expect(missingNote.status).toBe(HttpStatus.NOT_FOUND);

    const missingBook = await createBookNote(accessToken, MISSING_ID, noteBody());
    expect(missingBook.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("notes archive", () => {
  it("returns the sidebar summary and treats summary as a static route", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const seriesId = await createSeries(accessToken);

    await createBookNote(accessToken, bookId, noteBody({ isFavorite: true, isSpoiler: true }));
    await createBookNote(accessToken, bookId, noteBody({ isPinned: true }));
    await authed("post", `/api/series/${seriesId}/notes`, accessToken).send(noteBody());

    const summary = await authed("get", "/api/notes/summary", accessToken);
    expect(summary.status).toBe(HttpStatus.OK);
    expect(summary.body).toMatchObject({
      bookNotesCount: 2,
      booksWithNotesCount: 1,
      favoriteCount: 1,
      pinnedCount: 1,
      seriesNotesCount: 1,
      seriesWithNotesCount: 1,
      total: 3,
      withoutSpoilerCount: 2,
      withSpoilerCount: 1,
    });
  });

  it("paginates, filters, sorts and searches the archive", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { title: "Hyperion" });
    const seriesId = await createSeries(accessToken, "Broken Empire");

    const first = await createBookNote(
      accessToken,
      bookId,
      noteBody({ page: 10, text: "alpha thought" }),
    );
    const spoiler = await createBookNote(
      accessToken,
      bookId,
      noteBody({ isSpoiler: true, page: 200, text: "beta spoiler" }),
    );
    await authed("post", `/api/series/${seriesId}/notes`, accessToken).send(
      noteBody({ text: "gamma series thought" }),
    );
    await authed("patch", `/api/notes/${spoiler.body.id}`, accessToken).send({ isPinned: true });

    const page = await authed("get", "/api/notes?pageSize=2&pageNumber=1", accessToken);
    expect(page.body.totalCount).toBe(3);
    expect(page.body.items).toHaveLength(2);
    expect(page.body.pagesCount).toBe(2);

    const pinnedFirst = await authed("get", "/api/notes", accessToken);
    expect(pinnedFirst.body.items[0].id).toBe(spoiler.body.id);

    const spoilerOnly = await authed("get", "/api/notes?filter=with_spoiler", accessToken);
    expect(spoilerOnly.body.totalCount).toBe(1);
    expect(spoilerOnly.body.items[0].isSpoiler).toBe(true);

    const booksOnly = await authed("get", "/api/notes?entityType=book", accessToken);
    expect(booksOnly.body.totalCount).toBe(2);

    const seriesOnly = await authed("get", "/api/notes?entityType=series", accessToken);
    expect(seriesOnly.body.totalCount).toBe(1);

    const oldestFirst = await authed("get", "/api/notes?sort=oldest", accessToken);
    expect(oldestFirst.body.items[0].id).toBe(spoiler.body.id);
    expect(oldestFirst.body.items[1].id).toBe(first.body.id);

    const byTitle = await authed("get", "/api/notes?search=Hyperion", accessToken);
    expect(byTitle.body.totalCount).toBe(2);

    const bySeriesName = await authed("get", "/api/notes?search=Broken", accessToken);
    expect(bySeriesName.body.totalCount).toBe(1);

    const byText = await authed("get", "/api/notes?search=gamma", accessToken);
    expect(byText.body.totalCount).toBe(1);

    const byPage = await authed("get", "/api/notes?search=200", accessToken);
    expect(byPage.body.totalCount).toBe(1);
    expect(byPage.body.items[0].id).toBe(spoiler.body.id);

    const withPage = await authed("get", "/api/notes?hasPage=true", accessToken);
    expect(withPage.body.totalCount).toBe(2);

    const withoutPage = await authed("get", "/api/notes?hasPage=false", accessToken);
    expect(withoutPage.body.totalCount).toBe(1);
  });
});

describe("note page bounds (int4)", () => {
  const OUT_OF_RANGE_PAGE = 3_000_000_000;

  it("rejects an out-of-range page on create and update without a 500", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const created = await createBookNote(
      accessToken,
      bookId,
      noteBody({ page: OUT_OF_RANGE_PAGE }),
    );
    expect(created.status).toBe(HttpStatus.BAD_REQUEST);

    const valid = await createBookNote(accessToken, bookId, noteBody({ page: 42 }));
    expect(valid.status).toBe(HttpStatus.CREATED);

    const edited = await authed("patch", `/api/notes/${valid.body.id}`, accessToken).send({
      page: OUT_OF_RANGE_PAGE,
    });
    expect(edited.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("treats an out-of-range numeric search as an empty result without a 500", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createBookNote(accessToken, bookId, noteBody({ page: 200 }));

    const res = await authed("get", "/api/notes?search=9999999999", accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalCount).toBe(0);
  });
});

describe("note entity previews", () => {
  it("exposes the book author and the series authors + books count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const bookId = await createBook(accessToken, {
      authors: [{ name: "N. K. Jemisin" }],
      title: "The Fifth Season",
    });
    await createBookNote(accessToken, bookId, noteBody());

    const seriesRes = await authed("post", "/api/series", accessToken).send({
      authors: [{ name: "Ursula Le Guin" }],
      name: "Earthsea",
    });
    expect(seriesRes.status).toBe(HttpStatus.CREATED);
    const seriesId = seriesRes.body.id;

    await createBook(accessToken, {
      authors: [{ name: "Ursula Le Guin" }],
      bookType: "series_part",
      partNumber: 1,
      seriesId,
      title: "A Wizard of Earthsea",
    });
    await authed("post", `/api/series/${seriesId}/notes`, accessToken).send(noteBody());

    const bookNotes = await authed("get", `/api/books/${bookId}/notes`, accessToken);
    expect(bookNotes.body.notes[0].book.author).toBe("N. K. Jemisin");

    const seriesNotes = await authed("get", `/api/series/${seriesId}/notes`, accessToken);
    expect(seriesNotes.body.notes[0].series.authors).toEqual(["Ursula Le Guin"]);
    expect(seriesNotes.body.notes[0].series.booksCount).toBe(1);

    const archive = await authed("get", "/api/notes?entityType=series", accessToken);
    expect(archive.body.items[0].series.authors).toEqual(["Ursula Le Guin"]);
    expect(archive.body.items[0].series.booksCount).toBe(1);
  });
});

describe("custom category filter", () => {
  it("filters by a custom category and lists the distinct custom categories", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    await createBookNote(
      accessToken,
      bookId,
      noteBody({ category: "other", customCategory: "translation notes" }),
    );
    await createBookNote(
      accessToken,
      bookId,
      noteBody({ category: "other", customCategory: "translation notes" }),
    );
    await createBookNote(
      accessToken,
      bookId,
      noteBody({ category: "other", customCategory: "cover design" }),
    );
    await createBookNote(accessToken, bookId, noteBody({ category: "plot" }));

    const filtered = await authed(
      "get",
      "/api/notes?customCategory=translation notes",
      accessToken,
    );
    expect(filtered.body.totalCount).toBe(2);
    expect(
      filtered.body.items.every(
        (note: { customCategory: string }) => note.customCategory === "translation notes",
      ),
    ).toBe(true);

    const summary = await authed("get", "/api/notes/summary", accessToken);
    expect(summary.body.availableCustomCategories).toEqual(["cover design", "translation notes"]);
  });
});

describe("cascade and invariants", () => {
  it("removes notes when their book or series is deleted", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const seriesId = await createSeries(accessToken);
    await createBookNote(accessToken, bookId, noteBody());
    await authed("post", `/api/series/${seriesId}/notes`, accessToken).send(noteBody());

    expect((await authed("get", "/api/notes", accessToken)).body.totalCount).toBe(2);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.NO_CONTENT);
    expect((await authed("get", "/api/notes", accessToken)).body.totalCount).toBe(1);

    await authed("delete", `/api/series/${seriesId}`, accessToken).expect(HttpStatus.NO_CONTENT);
    expect((await authed("get", "/api/notes", accessToken)).body.totalCount).toBe(0);
  });

  it("cascades note deletion when the owning user is removed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(accessToken);
    await authed("post", `/api/series/${seriesId}/notes`, accessToken).send(noteBody());

    const prisma = app.get(PrismaService);
    expect(await prisma.note.count({ where: { userId } })).toBe(1);

    await prisma.user.delete({ where: { id: userId } });
    expect(await prisma.note.count({ where: { userId } })).toBe(0);
  });

  it("rejects a note that is bound to neither a book nor a series", async () => {
    const { userId } = await context.registerVerifyAndLogin();
    const prisma = app.get(PrismaService);

    await expect(
      prisma.note.create({
        data: { bookId: null, entityType: "book", seriesId: null, text: "orphan", userId },
      }),
    ).rejects.toThrow();
  });
});
