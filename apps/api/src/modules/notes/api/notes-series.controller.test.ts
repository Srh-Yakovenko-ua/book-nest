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

const SERIES_ARCHIVE_PATH = "/api/notes/series";

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

function authed(method: "get" | "patch" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createSeries(
  token: string,
  body: { authors?: { name: string }[]; name: string },
): Promise<string> {
  const res = await authed("post", "/api/series", token).send(body);
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createSeriesBook(
  token: string,
  book: { author: string; partNumber: number; seriesId: string; title: string },
): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: book.author }],
    bookType: "series_part",
    ownershipStatus: "owned",
    partNumber: book.partNumber,
    seriesId: book.seriesId,
    title: book.title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createSeriesNote(
  token: string,
  seriesId: string,
  body: Record<string, unknown> = {},
): Promise<string> {
  const res = await authed("post", `/api/series/${seriesId}/notes`, token).send({
    text: "A thread across the whole saga",
    ...body,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function listIds(body: { items: { id: string }[] }): string[] {
  return body.items.map((item) => item.id);
}

describe("GET /api/notes/series scope", () => {
  it("SERIES-Q-01 returns only series notes, never book notes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(accessToken, { name: "Earthsea" });
    const bookId = await createSeriesBook(accessToken, {
      author: "Ursula Le Guin",
      partNumber: 1,
      seriesId,
      title: "A Wizard of Earthsea",
    });
    await authed("post", `/api/books/${bookId}/notes`, accessToken).send({ text: "Book thought" });
    const seriesNoteId = await createSeriesNote(accessToken, seriesId);

    const res = await authed("get", SERIES_ARCHIVE_PATH, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalCount).toBe(1);
    expect(listIds(res.body)).toEqual([seriesNoteId]);
    expect(res.body.items[0].entityType).toBe("series");
  });

  it("drops chapter and page sent when creating a series note", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(accessToken, { name: "Earthsea" });

    const res = await authed("post", `/api/series/${seriesId}/notes`, accessToken).send({
      chapter: "Chapter 3",
      page: 42,
      text: "Legacy fields should not stick",
    });

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.chapter).toBeNull();
    expect(res.body.page).toBeNull();
  });
});

describe("GET /api/notes/series canonical authors", () => {
  it("derives the preview authors from the series books before the series authors", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(accessToken, {
      authors: [{ name: "Declared Author" }],
      name: "The Expanse",
    });
    await createSeriesBook(accessToken, {
      author: "James S. A. Corey",
      partNumber: 1,
      seriesId,
      title: "Leviathan Wakes",
    });
    await createSeriesNote(accessToken, seriesId);

    const res = await authed("get", SERIES_ARCHIVE_PATH, accessToken);

    expect(res.body.items[0].series.authors).toEqual(["James S. A. Corey"]);
  });

  it("falls back to the series authors when the series has no books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(accessToken, {
      authors: [{ name: "Declared Author" }],
      name: "Planned Saga",
    });
    await createSeriesNote(accessToken, seriesId);

    const res = await authed("get", SERIES_ARCHIVE_PATH, accessToken);

    expect(res.body.items[0].series.authors).toEqual(["Declared Author"]);
  });
});

describe("GET /api/notes/series sort", () => {
  it("SERIES-Q-06 sorts by the canonical series author across pages, not by the series name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const alphaId = await createSeries(accessToken, {
      authors: [{ name: "Zelazny Roger" }],
      name: "Alpha Chronicles",
    });
    const omegaId = await createSeries(accessToken, {
      authors: [{ name: "Abercrombie Joe" }],
      name: "Omega Cycle",
    });
    const alphaNoteId = await createSeriesNote(accessToken, alphaId);
    const omegaNoteId = await createSeriesNote(accessToken, omegaId);

    const byTitle = await authed("get", `${SERIES_ARCHIVE_PATH}?sort=title`, accessToken);
    expect(listIds(byTitle.body)).toEqual([alphaNoteId, omegaNoteId]);

    const firstPage = await authed(
      "get",
      `${SERIES_ARCHIVE_PATH}?sort=author&pageSize=1&pageNumber=1`,
      accessToken,
    );
    const secondPage = await authed(
      "get",
      `${SERIES_ARCHIVE_PATH}?sort=author&pageSize=1&pageNumber=2`,
      accessToken,
    );
    expect(firstPage.body.totalCount).toBe(2);
    expect(listIds(firstPage.body)).toEqual([omegaNoteId]);
    expect(listIds(secondPage.body)).toEqual([alphaNoteId]);
  });

  it("SERIES-Q-06 SH-Q-06 promotes pinned notes only under pinned_first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(accessToken, { name: "Earthsea" });
    const pinnedOlderId = await createSeriesNote(accessToken, seriesId, { isPinned: true });
    const newerId = await createSeriesNote(accessToken, seriesId);

    const newest = await authed("get", SERIES_ARCHIVE_PATH, accessToken);
    expect(listIds(newest.body)).toEqual([newerId, pinnedOlderId]);

    const pinnedFirst = await authed(
      "get",
      `${SERIES_ARCHIVE_PATH}?sort=pinned_first`,
      accessToken,
    );
    expect(listIds(pinnedFirst.body)).toEqual([pinnedOlderId, newerId]);
  });
});

describe("GET /api/notes/series filters and search", () => {
  it("SERIES-Q-02 SERIES-Q-03 searches series name and canonical authors but not the titles of books in the series", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(accessToken, { name: "Hyperion Cantos" });
    await createSeriesBook(accessToken, {
      author: "Dan Simmons",
      partNumber: 1,
      seriesId,
      title: "Endymion",
    });
    const noteId = await createSeriesNote(accessToken, seriesId);

    const byName = await authed("get", `${SERIES_ARCHIVE_PATH}?search=cantos`, accessToken);
    expect(listIds(byName.body)).toEqual([noteId]);

    const byAuthor = await authed("get", `${SERIES_ARCHIVE_PATH}?search=simmons`, accessToken);
    expect(listIds(byAuthor.body)).toEqual([noteId]);

    const byBookTitle = await authed("get", `${SERIES_ARCHIVE_PATH}?search=endymion`, accessToken);
    expect(byBookTitle.body.totalCount).toBe(0);
  });

  it("SERIES-Q-04 SH-Q-02 filters by series, status and reading state with OR inside a dimension", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const emptyId = await createSeries(accessToken, { name: "Empty Saga" });
    const startedId = await createSeries(accessToken, { name: "Started Saga" });
    await createSeriesBook(accessToken, {
      author: "Robin Hobb",
      partNumber: 1,
      seriesId: startedId,
      title: "Assassin's Apprentice",
    });
    const emptyNoteId = await createSeriesNote(accessToken, emptyId);
    const startedNoteId = await createSeriesNote(accessToken, startedId);

    const emptyOnly = await authed("get", `${SERIES_ARCHIVE_PATH}?reading=empty`, accessToken);
    expect(listIds(emptyOnly.body)).toEqual([emptyNoteId]);

    const bothStates = await authed(
      "get",
      `${SERIES_ARCHIVE_PATH}?reading=empty&reading=not_started`,
      accessToken,
    );
    expect(bothStates.body.totalCount).toBe(2);

    const bySeries = await authed("get", `${SERIES_ARCHIVE_PATH}?series=${startedId}`, accessToken);
    expect(listIds(bySeries.body)).toEqual([startedNoteId]);

    const byStatus = await authed("get", `${SERIES_ARCHIVE_PATH}?status=completed`, accessToken);
    expect(byStatus.body.totalCount).toBe(0);
  });
});

describe("GET /api/notes/series acceptance gaps", () => {
  it("SERIES-Q-02 SERIES-Q-03 matches note text and custom category but never page, chapter or a raw category key", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(accessToken, { name: "Earthsea" });
    const textId = await createSeriesNote(accessToken, seriesId, { text: "The true names" });
    const customId = await createSeriesNote(accessToken, seriesId, {
      category: "other",
      customCategory: "Dragons",
      text: "Old speech",
    });
    const legacyId = await createSeriesNote(accessToken, seriesId, {
      category: "worldbuilding",
      text: "Archipelago",
    });
    await app
      .get(PrismaService)
      .note.update({ data: { chapter: "Roke Knoll", page: 77 }, where: { id: legacyId } });

    const byText = await authed("get", `${SERIES_ARCHIVE_PATH}?search=names`, accessToken);
    const byCustom = await authed("get", `${SERIES_ARCHIVE_PATH}?search=dragons`, accessToken);
    const byChapter = await authed("get", `${SERIES_ARCHIVE_PATH}?search=roke`, accessToken);
    const byPage = await authed("get", `${SERIES_ARCHIVE_PATH}?search=77`, accessToken);
    const byRawCategory = await authed(
      "get",
      `${SERIES_ARCHIVE_PATH}?search=worldbuilding`,
      accessToken,
    );

    expect(listIds(byText.body)).toEqual([textId]);
    expect(listIds(byCustom.body)).toEqual([customId]);
    expect(byChapter.body.totalCount).toBe(0);
    expect(byPage.body.totalCount).toBe(0);
    expect(byRawCategory.body.totalCount).toBe(0);
  });

  it("SERIES-Q-05 filters by a stable canonical author id derived from the series books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const expanseId = await createSeries(accessToken, {
      authors: [{ name: "Declared Author" }],
      name: "The Expanse",
    });
    await createSeriesBook(accessToken, {
      author: "James S. A. Corey",
      partNumber: 1,
      seriesId: expanseId,
      title: "Leviathan Wakes",
    });
    const earthseaId = await createSeries(accessToken, {
      authors: [{ name: "Ursula Le Guin" }],
      name: "Earthsea",
    });
    const expanseNoteId = await createSeriesNote(accessToken, expanseId);
    await createSeriesNote(accessToken, earthseaId);
    const facets = await authed("get", `${SERIES_ARCHIVE_PATH}/facets`, accessToken);
    const corey = facets.body.authors.find(
      (author: { name: string }) => author.name === "James S. A. Corey",
    );

    const res = await authed("get", `${SERIES_ARCHIVE_PATH}?author=${corey.id}`, accessToken);

    expect(listIds(res.body)).toEqual([expanseNoteId]);
  });
});
