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

const SERIES_FACETS_PATH = "/api/notes/series/facets";
const SERIES_SUMMARY_PATH = "/api/notes/series/summary";
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
  book: { author: string; seriesId: string; title: string },
): Promise<void> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: book.author }],
    bookType: "series_part",
    ownershipStatus: "owned",
    partNumber: 1,
    seriesId: book.seriesId,
    title: book.title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
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

async function setSeriesGenres(seriesId: string, genres: string[]): Promise<void> {
  await app.get(PrismaService).series.update({ data: { genres }, where: { id: seriesId } });
}

describe("GET /api/notes/series/facets", () => {
  it("keeps other canonical authors in the authors facet while one author is selected", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const expanseId = await createSeries(accessToken, {
      authors: [{ name: "Declared Author" }],
      name: "The Expanse",
    });
    await createSeriesBook(accessToken, {
      author: "James S. A. Corey",
      seriesId: expanseId,
      title: "Leviathan Wakes",
    });
    const earthseaId = await createSeries(accessToken, {
      authors: [{ name: "Ursula Le Guin" }],
      name: "Earthsea",
    });
    await createSeriesNote(accessToken, expanseId);
    await createSeriesNote(accessToken, expanseId);
    await createSeriesNote(accessToken, earthseaId);

    const unfiltered = await authed("get", SERIES_FACETS_PATH, accessToken);
    expect(unfiltered.status).toBe(HttpStatus.OK);
    expect(unfiltered.body.authors.map((author: { name: string }) => author.name)).toEqual([
      "James S. A. Corey",
      "Ursula Le Guin",
    ]);
    const coreyId = authorIdByName(unfiltered.body, "James S. A. Corey");

    const res = await authed("get", `${SERIES_FACETS_PATH}?author=${coreyId}`, accessToken);

    expect(res.body.authors).toEqual([
      { count: 2, id: coreyId, name: "James S. A. Corey" },
      { count: 1, id: authorIdByName(unfiltered.body, "Ursula Le Guin"), name: "Ursula Le Guin" },
    ]);
    expect(res.body.series).toEqual([{ count: 2, id: expanseId, name: "The Expanse" }]);
    expect(res.body.quickCounts.all).toBe(2);
  });

  it("keeps other series and genres visible while their own dimension is selected", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const earthseaId = await createSeries(accessToken, { name: "Earthsea" });
    const expanseId = await createSeries(accessToken, { name: "The Expanse" });
    await setSeriesGenres(earthseaId, ["fantasy"]);
    await setSeriesGenres(expanseId, ["science_fiction", "space_opera"]);
    await createSeriesNote(accessToken, earthseaId);
    await createSeriesNote(accessToken, expanseId);
    await createSeriesNote(accessToken, expanseId);

    const bySeries = await authed("get", `${SERIES_FACETS_PATH}?series=${earthseaId}`, accessToken);
    expect(bySeries.body.series).toEqual([
      { count: 2, id: expanseId, name: "The Expanse" },
      { count: 1, id: earthseaId, name: "Earthsea" },
    ]);
    expect(bySeries.body.genres).toEqual([{ count: 1, value: "fantasy" }]);

    const byGenre = await authed("get", `${SERIES_FACETS_PATH}?genre=fantasy`, accessToken);
    expect(byGenre.body.genres).toEqual([
      { count: 2, value: "science_fiction" },
      { count: 2, value: "space_opera" },
      { count: 1, value: "fantasy" },
    ]);
    expect(byGenre.body.series).toEqual([{ count: 1, id: earthseaId, name: "Earthsea" }]);
  });

  it("SH-Q-05 computes quick counts under filters but ignores the quick filter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const earthseaId = await createSeries(accessToken, { name: "Earthsea" });
    const expanseId = await createSeries(accessToken, { name: "The Expanse" });
    await createSeriesNote(accessToken, earthseaId, { isFavorite: true, isPinned: true });
    await createSeriesNote(accessToken, earthseaId, { isSpoiler: true });
    await createSeriesNote(accessToken, expanseId, { isFavorite: true });

    const expected = { all: 2, favorite: 1, no_spoiler: 1, pinned: 1, with_spoiler: 1 };

    const bySeries = await authed("get", `${SERIES_FACETS_PATH}?series=${earthseaId}`, accessToken);
    expect(bySeries.body.quickCounts).toEqual(expected);

    const favoriteSelected = await authed(
      "get",
      `${SERIES_FACETS_PATH}?series=${earthseaId}&filter=favorite`,
      accessToken,
    );
    expect(favoriteSelected.body.quickCounts).toEqual(expected);
  });

  it("counts standard and custom categories as one self-excluding dimension", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const earthseaId = await createSeries(accessToken, { name: "Earthsea" });
    await createSeriesNote(accessToken, earthseaId, { category: "plot" });
    await createSeriesNote(accessToken, earthseaId, {
      category: "other",
      customCategory: "Dragons",
    });

    const res = await authed("get", `${SERIES_FACETS_PATH}?customCategory=Dragons`, accessToken);

    expect(res.body.categories).toEqual([
      { category: "other", count: 1 },
      { category: "plot", count: 1 },
    ]);
    expect(res.body.customCategories).toEqual([{ count: 1, value: "Dragons" }]);
    expect(res.body.quickCounts.all).toBe(1);
  });
});

describe("GET /api/notes/series/summary", () => {
  it("summarises active series notes with the 3+ threshold and stays stable under archive params", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const earthseaId = await createSeries(accessToken, {
      authors: [{ name: "Ursula Le Guin" }],
      name: "Earthsea",
    });
    const expanseId = await createSeries(accessToken, {
      authors: [{ name: "James S. A. Corey" }],
      name: "The Expanse",
    });
    const oldNoteId = await createSeriesNote(accessToken, earthseaId);
    await createSeriesNote(accessToken, earthseaId);
    await createSeriesNote(accessToken, earthseaId, { isPinned: true });
    await createSeriesNote(accessToken, expanseId);
    const trashedNoteId = await createSeriesNote(accessToken, expanseId);
    const bookRes = await authed("post", "/api/books", accessToken).send({
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });
    await authed("post", `/api/books/${bookRes.body.id}/notes`, accessToken).send({
      text: "Book thought",
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

    const res = await authed("get", SERIES_SUMMARY_PATH, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual({
      createdLast30DaysCount: 3,
      seriesNotesCount: 4,
      seriesWithNotesCount: 2,
      seriesWithThreeOrMoreNotesCount: 1,
      topAuthor: { leadersCount: 1, name: "Ursula Le Guin", notesCount: 3 },
      topSeries: { leadersCount: 1, name: "Earthsea", notesCount: 3 },
    });

    const withArchiveParams = await authed(
      "get",
      `${SERIES_SUMMARY_PATH}?search=expanse&filter=pinned&series=${expanseId}`,
      accessToken,
    );
    expect(withArchiveParams.body).toEqual(res.body);
  });
});
