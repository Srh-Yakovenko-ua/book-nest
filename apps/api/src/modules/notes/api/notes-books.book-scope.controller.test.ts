import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import { addMinutes } from "date-fns";
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

const BOOK_ARCHIVE_PATH = "/api/notes/books";
const BASE_TIME = new Date("2026-03-01T12:00:00.000Z");

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

function authed(method: "delete" | "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

function byId(ids: string[]): string[] {
  return [...ids].sort();
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

async function createBookNotes(token: string, bookId: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    ids.push(await createBookNote(token, bookId));
  }
  return ids;
}

function listIds(body: { items: { id: string }[] }): string[] {
  return body.items.map((item) => item.id);
}

async function seedDuneAndHyperion(token: string): Promise<{ duneId: string; hyperionId: string }> {
  const duneId = await createBook(token, { author: "Frank Herbert", title: "Dune" });
  const hyperionId = await createBook(token, { author: "Dan Simmons", title: "Hyperion" });
  return { duneId, hyperionId };
}

async function stampTimes(
  noteId: string,
  times: { createdAt: Date; updatedAt?: Date },
): Promise<void> {
  await prisma.note.update({
    data: { createdAt: times.createdAt, updatedAt: times.updatedAt ?? times.createdAt },
    where: { id: noteId },
  });
}

describe("GET /api/notes/books?book=<id>&sort=page", () => {
  it("orders one book's notes by page ascending, newer first within a page, missing pages last", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const anathemId = await createBook(accessToken, {
      author: "Neal Stephenson",
      title: "Anathem",
    });
    const anathemNote = await createBookNote(accessToken, anathemId, { page: 1 });
    const noPageNote = await createBookNote(accessToken, duneId);
    const page5NewerNote = await createBookNote(accessToken, duneId, { page: 5 });
    const page3Note = await createBookNote(accessToken, duneId, { page: 3 });
    const page5OlderNote = await createBookNote(accessToken, duneId, { page: 5 });
    await stampTimes(anathemNote, { createdAt: addMinutes(BASE_TIME, 50) });
    await stampTimes(noPageNote, { createdAt: addMinutes(BASE_TIME, 40) });
    await stampTimes(page5NewerNote, { createdAt: addMinutes(BASE_TIME, 30) });
    await stampTimes(page5OlderNote, { createdAt: addMinutes(BASE_TIME, 10) });
    await stampTimes(page3Note, { createdAt: addMinutes(BASE_TIME, 5) });

    const res = await authed("get", `${BOOK_ARCHIVE_PATH}?book=${duneId}&sort=page`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(listIds(res.body)).toEqual([page3Note, page5NewerNote, page5OlderNote, noPageNote]);
  });

  it("orders notes on the same page with equal createdAt by id after the newer ones", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const tiedNotes = [
      await createBookNote(accessToken, duneId, { page: 7 }),
      await createBookNote(accessToken, duneId, { page: 7 }),
      await createBookNote(accessToken, duneId, { page: 7 }),
    ];
    const newerNote = await createBookNote(accessToken, duneId, { page: 7 });
    await Promise.all(tiedNotes.map((noteId) => stampTimes(noteId, { createdAt: BASE_TIME })));
    await stampTimes(newerNote, { createdAt: addMinutes(BASE_TIME, 1) });

    const res = await authed("get", `${BOOK_ARCHIVE_PATH}?book=${duneId}&sort=page`, accessToken);

    expect(listIds(res.body)).toEqual([newerNote, ...byId(tiedNotes)]);
  });

  it("keeps a pinned note at its page position under page sort", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const page2Note = await createBookNote(accessToken, duneId, { page: 2 });
    const pinnedPage9Note = await createBookNote(accessToken, duneId, { isPinned: true, page: 9 });
    await stampTimes(page2Note, { createdAt: BASE_TIME });
    await stampTimes(pinnedPage9Note, { createdAt: addMinutes(BASE_TIME, 10) });

    const res = await authed("get", `${BOOK_ARCHIVE_PATH}?book=${duneId}&sort=page`, accessToken);

    expect(listIds(res.body)).toEqual([page2Note, pinnedPage9Note]);
  });
});

describe("GET /api/notes/books?book=<id> with the other sorts", () => {
  it.each([
    { order: ["third", "second", "first"], sort: "newest" },
    { order: ["first", "second", "third"], sort: "oldest" },
    { order: ["second", "first", "third"], sort: "recently_updated" },
    { order: ["first", "third", "second"], sort: "pinned_first" },
  ])("orders one book's notes under $sort", async ({ order, sort }) => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, hyperionId } = await seedDuneAndHyperion(accessToken);
    const first = await createBookNote(accessToken, duneId, { isPinned: true });
    const second = await createBookNote(accessToken, duneId);
    const third = await createBookNote(accessToken, duneId);
    const otherBookNote = await createBookNote(accessToken, hyperionId, { isPinned: true });
    await stampTimes(first, {
      createdAt: addMinutes(BASE_TIME, 1),
      updatedAt: addMinutes(BASE_TIME, 20),
    });
    await stampTimes(second, {
      createdAt: addMinutes(BASE_TIME, 2),
      updatedAt: addMinutes(BASE_TIME, 30),
    });
    await stampTimes(third, {
      createdAt: addMinutes(BASE_TIME, 3),
      updatedAt: addMinutes(BASE_TIME, 10),
    });
    await stampTimes(otherBookNote, { createdAt: addMinutes(BASE_TIME, 40) });
    const noteIdByLabel: Record<string, string> = { first, second, third };

    const res = await authed(
      "get",
      `${BOOK_ARCHIVE_PATH}?book=${duneId}&sort=${sort}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(listIds(res.body)).toEqual(order.map((label) => noteIdByLabel[label]));
  });
});

describe("GET /api/notes/books searchIn", () => {
  it("matches only the note's own fields when searchIn=notes and the term is the book title", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId } = await seedDuneAndHyperion(accessToken);
    const ownMatchId = await createBookNote(accessToken, duneId, {
      text: "Sand covers every dune",
    });
    await createBookNote(accessToken, duneId, { text: "Spice" });

    const res = await authed(
      "get",
      `${BOOK_ARCHIVE_PATH}?book=${duneId}&search=Dune&searchIn=notes`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(listIds(res.body)).toEqual([ownMatchId]);
    expect(res.body.totalCount).toBe(1);
  });

  it("does not match the book author when searchIn=notes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId } = await seedDuneAndHyperion(accessToken);
    const ownMatchId = await createBookNote(accessToken, duneId, {
      text: "Herbert wrote this in 1965",
    });
    await createBookNote(accessToken, duneId, { text: "Spice" });

    const res = await authed(
      "get",
      `${BOOK_ARCHIVE_PATH}?book=${duneId}&search=herbert&searchIn=notes`,
      accessToken,
    );

    expect(listIds(res.body)).toEqual([ownMatchId]);
  });

  it("returns every note of the book when its title is searched with the default scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, hyperionId } = await seedDuneAndHyperion(accessToken);
    const duneNotes = [
      await createBookNote(accessToken, duneId, { text: "Sand covers every dune" }),
      await createBookNote(accessToken, duneId, { text: "Spice" }),
    ];
    await createBookNote(accessToken, hyperionId, { text: "Pilgrims" });

    const res = await authed("get", `${BOOK_ARCHIVE_PATH}?search=Dune`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(byId(listIds(res.body))).toEqual(byId(duneNotes));
  });

  it("returns 400 for an unknown searchIn value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("get", `${BOOK_ARCHIVE_PATH}?searchIn=everything`, accessToken);

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "searchIn" })]),
    );
  });
});

describe("GET /api/notes/books?book=<id> quick filters", () => {
  it.each([
    { expected: ["favoritePinned", "spoiler", "plain"], filter: "all" },
    { expected: ["favoritePinned", "plain"], filter: "no_spoiler" },
    { expected: ["spoiler"], filter: "with_spoiler" },
    { expected: ["favoritePinned"], filter: "favorite" },
    { expected: ["favoritePinned"], filter: "pinned" },
  ])(
    "returns only the selected book's notes under filter=$filter",
    async ({ expected, filter }) => {
      const { accessToken } = await context.registerVerifyAndLogin();
      const { duneId, hyperionId } = await seedDuneAndHyperion(accessToken);
      const noteIdByLabel: Record<string, string> = {
        favoritePinned: await createBookNote(accessToken, duneId, {
          isFavorite: true,
          isPinned: true,
        }),
        plain: await createBookNote(accessToken, duneId),
        spoiler: await createBookNote(accessToken, duneId, { isSpoiler: true }),
      };
      await createBookNote(accessToken, hyperionId, {
        isFavorite: true,
        isPinned: true,
        isSpoiler: true,
      });
      await createBookNote(accessToken, hyperionId);

      const res = await authed(
        "get",
        `${BOOK_ARCHIVE_PATH}?book=${duneId}&filter=${filter}`,
        accessToken,
      );

      expect(res.status).toBe(HttpStatus.OK);
      expect(byId(listIds(res.body))).toEqual(
        byId(expected.map((label) => noteIdByLabel[label] ?? "")),
      );
    },
  );
});

describe("GET /api/notes/books?book=<id> categories", () => {
  it("narrows a book's notes to a standard category without pulling in another book's", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, hyperionId } = await seedDuneAndHyperion(accessToken);
    const dunePlotId = await createBookNote(accessToken, duneId, { category: "plot" });
    await createBookNote(accessToken, duneId, { category: "characters" });
    await createBookNote(accessToken, hyperionId, { category: "plot" });

    const res = await authed(
      "get",
      `${BOOK_ARCHIVE_PATH}?book=${duneId}&category=plot`,
      accessToken,
    );

    expect(listIds(res.body)).toEqual([dunePlotId]);
  });

  it("narrows a book's notes to a custom category without pulling in another book's", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, hyperionId } = await seedDuneAndHyperion(accessToken);
    const duneSpiceId = await createBookNote(accessToken, duneId, {
      category: "other",
      customCategory: "Spice",
    });
    await createBookNote(accessToken, duneId);
    await createBookNote(accessToken, hyperionId, { category: "other", customCategory: "Spice" });

    const res = await authed(
      "get",
      `${BOOK_ARCHIVE_PATH}?book=${duneId}&customCategory=Spice`,
      accessToken,
    );

    expect(listIds(res.body)).toEqual([duneSpiceId]);
  });
});

describe("GET /api/notes/books?book=<id> access and trash", () => {
  it("returns an empty page for another user's book id", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const ownerBookId = await createBook(owner.accessToken, {
      author: "Frank Herbert",
      title: "Dune",
    });
    await createBookNote(owner.accessToken, ownerBookId);
    const strangerBookId = await createBook(stranger.accessToken, {
      author: "Dan Simmons",
      title: "Hyperion",
    });
    await createBookNotes(stranger.accessToken, strangerBookId, 2);

    const res = await authed(
      "get",
      `${BOOK_ARCHIVE_PATH}?book=${strangerBookId}`,
      owner.accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({ items: [], pagesCount: 0, totalCount: 0 });
  });

  it("excludes soft-deleted notes from a book's notes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await createBook(accessToken, { author: "Frank Herbert", title: "Dune" });
    const [trashedId, ...keptIds] = await createBookNotes(accessToken, duneId, 3);
    await authed("delete", `/api/notes/${trashedId}`, accessToken).expect(HttpStatus.OK);

    const res = await authed("get", `${BOOK_ARCHIVE_PATH}?book=${duneId}`, accessToken);

    expect(byId(listIds(res.body))).toEqual(byId(keptIds));
    expect(res.body.totalCount).toBe(2);
  });
});

describe("GET /api/notes/books?book=<id> pagination", () => {
  it("splits 41 notes of one book into pages of 20, 20 and 1", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, hyperionId } = await seedDuneAndHyperion(accessToken);
    const duneNotes = await createBookNotes(accessToken, duneId, 41);
    await createBookNotes(accessToken, hyperionId, 2);

    const pages = await Promise.all(
      [1, 2, 3].map((pageNumber) =>
        authed(
          "get",
          `${BOOK_ARCHIVE_PATH}?book=${duneId}&pageSize=20&pageNumber=${pageNumber}`,
          accessToken,
        ),
      ),
    );

    expect(pages.map((page) => page.body.items.length)).toEqual([20, 20, 1]);
    expect(pages.map((page) => page.body.pagesCount)).toEqual([3, 3, 3]);
    expect(pages.map((page) => page.body.totalCount)).toEqual([41, 41, 41]);
    expect(byId(pages.flatMap((page) => listIds(page.body)))).toEqual(byId(duneNotes));
  });

  it("reports a single page for exactly 20 notes of one book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, hyperionId } = await seedDuneAndHyperion(accessToken);
    await createBookNotes(accessToken, duneId, 20);
    await createBookNote(accessToken, hyperionId);

    const res = await authed(
      "get",
      `${BOOK_ARCHIVE_PATH}?book=${duneId}&pageSize=20&pageNumber=1`,
      accessToken,
    );

    expect(res.body).toMatchObject({ pagesCount: 1, totalCount: 20 });
    expect(res.body.items).toHaveLength(20);
  });
});
