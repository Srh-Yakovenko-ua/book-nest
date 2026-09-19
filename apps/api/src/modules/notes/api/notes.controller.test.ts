import type { INestApplication } from "@nestjs/common";

import { NOTE_ERROR_CODES } from "@app/shared";
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
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, SeriesModule, NotesModule]);
  app = context.app;
  prisma = app.get(PrismaService);
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

async function addAlternateAuthorName(
  bookId: string,
  alternate: { locale: string; name: string; normalizedName: string },
): Promise<void> {
  const link = await prisma.bookAuthor.findFirstOrThrow({
    select: { authorId: true },
    where: { bookId },
  });
  await prisma.authorName.create({
    data: {
      authorId: link.authorId,
      isPrimary: false,
      locale: alternate.locale,
      name: alternate.name,
      normalizedName: alternate.normalizedName,
    },
  });
}

async function archiveTotals(token: string): Promise<{ books: number; series: number }> {
  const [books, series] = await Promise.all([
    authed("get", "/api/notes/books", token),
    authed("get", "/api/notes/series", token),
  ]);
  expect(books.status).toBe(HttpStatus.OK);
  expect(series.status).toBe(HttpStatus.OK);
  return { books: books.body.totalCount, series: series.body.totalCount };
}

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
  it("creates, lists, edits and trashes a book note", async () => {
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
    expect(removed.status).toBe(HttpStatus.OK);

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

describe("note updatedAt on edit", () => {
  const STALE_UPDATED_AT = new Date("2026-01-02T03:04:05.000Z");

  async function createNoteWithStaleUpdatedAt(token: string): Promise<string> {
    const bookId = await createBook(token);
    const created = await createBookNote(token, bookId, noteBody());
    expect(created.status).toBe(HttpStatus.CREATED);
    await prisma.note.update({
      data: { updatedAt: STALE_UPDATED_AT },
      where: { id: created.body.id },
    });
    return created.body.id;
  }

  async function storedUpdatedAt(noteId: string): Promise<Date> {
    const stored = await prisma.note.findUniqueOrThrow({ where: { id: noteId } });
    return stored.updatedAt;
  }

  it("keeps updatedAt when only the pin and favorite flags change", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const noteId = await createNoteWithStaleUpdatedAt(accessToken);

    const pinned = await authed("patch", `/api/notes/${noteId}`, accessToken).send({
      isPinned: true,
    });
    expect(pinned.status).toBe(HttpStatus.OK);
    expect(pinned.body).toMatchObject({
      isPinned: true,
      updatedAt: STALE_UPDATED_AT.toISOString(),
    });

    const favorited = await authed("patch", `/api/notes/${noteId}`, accessToken).send({
      isFavorite: true,
      isPinned: false,
    });
    expect(favorited.status).toBe(HttpStatus.OK);
    expect(favorited.body).toMatchObject({
      isFavorite: true,
      isPinned: false,
      updatedAt: STALE_UPDATED_AT.toISOString(),
    });
    expect(await storedUpdatedAt(noteId)).toEqual(STALE_UPDATED_AT);
  });

  it("advances updatedAt on a text edit", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const noteId = await createNoteWithStaleUpdatedAt(accessToken);

    const edited = await authed("patch", `/api/notes/${noteId}`, accessToken).send({
      isPinned: true,
      text: "Revised thought",
    });
    expect(edited.status).toBe(HttpStatus.OK);
    expect(edited.body.updatedAt).not.toBe(STALE_UPDATED_AT.toISOString());
    expect(await storedUpdatedAt(noteId)).not.toEqual(STALE_UPDATED_AT);
  });

  it("advances updatedAt on a spoiler change", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const noteId = await createNoteWithStaleUpdatedAt(accessToken);

    const edited = await authed("patch", `/api/notes/${noteId}`, accessToken).send({
      isSpoiler: true,
    });
    expect(edited.status).toBe(HttpStatus.OK);
    expect(edited.body.updatedAt).not.toBe(STALE_UPDATED_AT.toISOString());
    expect(await storedUpdatedAt(noteId)).not.toEqual(STALE_UPDATED_AT);
  });
});

describe("series note location on edit", () => {
  async function createLegacySeriesNoteWithLocation(token: string): Promise<string> {
    const seriesId = await createSeries(token);
    const created = await authed("post", `/api/series/${seriesId}/notes`, token).send(noteBody());
    expect(created.status).toBe(HttpStatus.CREATED);
    await prisma.note.update({
      data: { chapter: "Book 2, finale", page: 42 },
      where: { id: created.body.id },
    });
    return created.body.id;
  }

  it("rejects adding a page or a chapter to a series note", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const noteId = await createLegacySeriesNoteWithLocation(accessToken);

    const withPage = await authed("patch", `/api/notes/${noteId}`, accessToken).send({ page: 5 });
    expect(withPage.status).toBe(HttpStatus.BAD_REQUEST);
    expect(withPage.body.code).toBe(NOTE_ERROR_CODES.seriesNoteLocationUnsupported);

    const withChapter = await authed("patch", `/api/notes/${noteId}`, accessToken).send({
      chapter: "Prologue",
    });
    expect(withChapter.status).toBe(HttpStatus.BAD_REQUEST);

    const stored = await prisma.note.findUniqueOrThrow({ where: { id: noteId } });
    expect(stored).toMatchObject({ chapter: "Book 2, finale", page: 42 });
  });

  it("preserves an omitted location and clears an explicit null", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const noteId = await createLegacySeriesNoteWithLocation(accessToken);

    const preserved = await authed("patch", `/api/notes/${noteId}`, accessToken).send({
      text: "Revised thought",
    });
    expect(preserved.status).toBe(HttpStatus.OK);
    expect(preserved.body).toMatchObject({ chapter: "Book 2, finale", page: 42 });

    const cleared = await authed("patch", `/api/notes/${noteId}`, accessToken).send({
      page: null,
    });
    expect(cleared.status).toBe(HttpStatus.OK);
    expect(cleared.body).toMatchObject({ chapter: "Book 2, finale", page: null });
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

    expect(await archiveTotals(intruder.accessToken)).toEqual({ books: 0, series: 0 });
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
  it("paginates, filters and sorts the book notes archive", async () => {
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
    await createBookNote(accessToken, bookId, noteBody({ text: "delta thought" }));
    await authed("post", `/api/series/${seriesId}/notes`, accessToken).send(
      noteBody({ text: "gamma series thought" }),
    );

    const page = await authed("get", "/api/notes/books?pageSize=2&pageNumber=1", accessToken);
    expect(page.body.totalCount).toBe(3);
    expect(page.body.items).toHaveLength(2);
    expect(page.body.pagesCount).toBe(2);

    const spoilerOnly = await authed("get", "/api/notes/books?filter=with_spoiler", accessToken);
    expect(spoilerOnly.body.totalCount).toBe(1);
    expect(spoilerOnly.body.items[0].isSpoiler).toBe(true);

    const oldestFirst = await authed("get", "/api/notes/books?sort=oldest", accessToken);
    expect(oldestFirst.body.items[0].id).toBe(first.body.id);
    expect(oldestFirst.body.items[1].id).toBe(spoiler.body.id);

    const byTitle = await authed("get", "/api/notes/books?search=Hyperion", accessToken);
    expect(byTitle.body.totalCount).toBe(3);

    const bySeriesName = await authed("get", "/api/notes/series?search=Broken", accessToken);
    expect(bySeriesName.body.totalCount).toBe(1);
  });

  it("finds book notes by an alternate-locale author name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, {
      authors: [{ name: "Andrzej Sapkowski" }],
      title: "The Witcher",
    });
    await addAlternateAuthorName(bookId, {
      locale: "uk",
      name: "Анджей Сапковський",
      normalizedName: "анджей сапковський",
    });
    await createBookNote(accessToken, bookId, noteBody());

    const res = await authed(
      "get",
      `/api/notes/books?search=${encodeURIComponent("Сапковський")}`,
      accessToken,
    );

    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0].book.id).toBe(bookId);
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

    const res = await authed("get", "/api/notes/books?search=9999999999", accessToken);
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

    const archive = await authed("get", "/api/notes/series", accessToken);
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
      `/api/notes/books?customCategory=${encodeURIComponent("translation notes")}`,
      accessToken,
    );
    expect(filtered.body.totalCount).toBe(2);
    expect(
      filtered.body.items.every(
        (note: { customCategory: string }) => note.customCategory === "translation notes",
      ),
    ).toBe(true);

    const facets = await authed("get", "/api/notes/books/facets", accessToken);
    expect(
      facets.body.customCategories.map((facet: { value: string }) => facet.value).sort(),
    ).toEqual(["cover design", "translation notes"]);
  });
});

describe("cascade and invariants", () => {
  it("hides book notes while the book sits in the trash and restores them with it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const seriesId = await createSeries(accessToken);
    await createBookNote(accessToken, bookId, noteBody());
    await authed("post", `/api/series/${seriesId}/notes`, accessToken).send(noteBody());

    expect(await archiveTotals(accessToken)).toEqual({ books: 1, series: 1 });

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);
    expect(await archiveTotals(accessToken)).toEqual({ books: 0, series: 1 });

    await authed("post", `/api/books/${bookId}/restore`, accessToken).expect(HttpStatus.CREATED);
    expect(await archiveTotals(accessToken)).toEqual({ books: 1, series: 1 });

    await authed("delete", `/api/series/${seriesId}`, accessToken).expect(HttpStatus.OK);
    expect(await archiveTotals(accessToken)).toEqual({ books: 1, series: 0 });

    await authed("post", `/api/series/${seriesId}/restore`, accessToken).expect(HttpStatus.CREATED);
    expect(await archiveTotals(accessToken)).toEqual({ books: 1, series: 1 });
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
