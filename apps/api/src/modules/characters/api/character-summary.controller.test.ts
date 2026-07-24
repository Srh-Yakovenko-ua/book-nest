import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";

const MISSING_ID = "99999999-9999-4999-8999-999999999999";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, CharactersModule]);
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

const bookProfile = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  importance: "supporting",
  ...overrides,
});

async function addSeriesBook(
  token: string,
  seriesId: string,
  partNumber: number,
  title: string,
): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    ownershipStatus: "owned",
    partNumber,
    seriesId,
    title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createBook(token: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Foundation",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createInBook(
  token: string,
  bookId: string,
  character: Record<string, unknown>,
  profile: Record<string, unknown> = {},
): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: bookProfile(profile),
    character,
    mode: "new",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createSeriesFirstBook(
  token: string,
  seriesName: string,
): Promise<{ bookId: string; seriesId: string }> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    newSeries: { name: seriesName },
    ownershipStatus: "owned",
    partNumber: 1,
    title: "Dune",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return { bookId: res.body.id, seriesId: res.body.series.id };
}

async function linkExisting(
  token: string,
  bookId: string,
  characterId: string,
  profile: Record<string, unknown> = {},
): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: bookProfile(profile),
    characterId,
    mode: "existing",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
}

describe("book character summary", () => {
  it("returns an empty recap for a book with no characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const res = await authed("get", `/api/books/${bookId}/character-summary`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual({
      bookId,
      byImportance: { central: 0, episodic: 0, major: 0, mentioned: 0, supporting: 0 },
      favoritesCount: 0,
      hasHiddenRecords: false,
      povCount: 0,
      top: [],
      totalVisibleCharacters: 0,
    });
  });

  it("counts visible characters and excludes hidden presences", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createInBook(
      accessToken,
      bookId,
      { isFavorite: true, name: "Paul" },
      {
        displayName: "Muad'Dib",
        displayNameIsSpoiler: true,
        importance: "central",
        isPovCharacter: true,
      },
    );
    await createInBook(accessToken, bookId, { name: "Jessica" }, { importance: "central" });
    await createInBook(accessToken, bookId, { name: "Gurney" }, { importance: "major" });
    await createInBook(accessToken, bookId, { name: "Stilgar" }, { importance: "supporting" });
    await createInBook(accessToken, bookId, { name: "Duncan" }, { importance: "episodic" });
    await createInBook(
      accessToken,
      bookId,
      { name: "The Traitor" },
      { hidePresenceAsSpoiler: true, importance: "central" },
    );

    const res = await authed("get", `/api/books/${bookId}/character-summary`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalVisibleCharacters).toBe(5);
    expect(res.body.povCount).toBe(1);
    expect(res.body.favoritesCount).toBe(1);
    expect(res.body.byImportance).toEqual({
      central: 2,
      episodic: 1,
      major: 1,
      mentioned: 0,
      supporting: 1,
    });
    expect(res.body.hasHiddenRecords).toBe(true);
  });

  it("lists central and major characters in the top without leaking spoiler names", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createInBook(
      accessToken,
      bookId,
      { name: "Paul" },
      {
        displayName: "Muad'Dib",
        displayNameIsSpoiler: true,
        importance: "central",
        isPovCharacter: true,
      },
    );
    await createInBook(accessToken, bookId, { name: "Jessica" }, { importance: "central" });
    await createInBook(accessToken, bookId, { name: "Gurney" }, { importance: "major" });
    await createInBook(accessToken, bookId, { name: "Stilgar" }, { importance: "supporting" });

    const res = await authed("get", `/api/books/${bookId}/character-summary`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.top.map((entry: { name: string }) => entry.name)).toEqual([
      "Jessica",
      "Paul",
      "Gurney",
    ]);
    expect(
      res.body.top.every((entry: { importance: string }) =>
        ["central", "major"].includes(entry.importance),
      ),
    ).toBe(true);
    const paul = res.body.top.find((entry: { name: string }) => entry.name === "Paul");
    expect(paul.displayName).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain("Muad'Dib");
  });

  it("returns 404 for a book the user does not own", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const bookId = await createBook(owner.accessToken);

    const foreign = await authed(
      "get",
      `/api/books/${bookId}/character-summary`,
      intruder.accessToken,
    );
    expect(foreign.status).toBe(HttpStatus.NOT_FOUND);

    const missing = await authed(
      "get",
      `/api/books/${MISSING_ID}/character-summary`,
      owner.accessToken,
    );
    expect(missing.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("series character summary", () => {
  it("aggregates the whole series when no context book is given", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    await createInBook(accessToken, firstBook, { name: "Paul" }, { importance: "central" });
    await createInBook(accessToken, secondBook, { name: "Alia" }, { importance: "central" });

    const res = await authed("get", `/api/series/${seriesId}/character-summary`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.seriesId).toBe(seriesId);
    expect(res.body.contextBookId).toBeNull();
    expect(res.body.totalVisibleCharacters).toBe(2);
    expect(res.body.byImportance.central).toBe(2);
    expect(res.body.top.map((entry: { name: string }) => entry.name)).toEqual(["Alia", "Paul"]);
  });

  it("excludes future characters and reports hidden records up to the context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    await createInBook(
      accessToken,
      firstBook,
      { name: "Paul" },
      { importance: "central", isPovCharacter: true },
    );
    await createInBook(
      accessToken,
      firstBook,
      { name: "The Ghost" },
      { hidePresenceAsSpoiler: true, importance: "supporting" },
    );
    await createInBook(accessToken, secondBook, { name: "Alia" }, { importance: "central" });

    const res = await authed(
      "get",
      `/api/series/${seriesId}/character-summary?contextBookId=${firstBook}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.contextBookId).toBe(firstBook);
    expect(res.body.totalVisibleCharacters).toBe(1);
    expect(res.body.povCount).toBe(1);
    expect(res.body.byImportance.central).toBe(1);
    expect(res.body.hasHiddenRecords).toBe(true);
    expect(res.body.top.map((entry: { name: string }) => entry.name)).toEqual(["Paul"]);
    expect(JSON.stringify(res.body)).not.toContain("Alia");
  });

  it("does not flag hidden records for a character with a visible appearance", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const characterId = await createInBook(
      accessToken,
      firstBook,
      { name: "Paul" },
      { importance: "central" },
    );
    await linkExisting(accessToken, secondBook, characterId, { hidePresenceAsSpoiler: true });

    const res = await authed("get", `/api/series/${seriesId}/character-summary`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalVisibleCharacters).toBe(1);
    expect(res.body.hasHiddenRecords).toBe(false);
  });

  it("redacts spoiler display names in the series top list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    await createInBook(
      accessToken,
      bookId,
      { name: "Paul" },
      { displayName: "Kwisatz Haderach", displayNameIsSpoiler: true, importance: "central" },
    );

    const res = await authed("get", `/api/series/${seriesId}/character-summary`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.top[0].displayName).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain("Kwisatz Haderach");
  });

  it("rejects a context book that belongs to another series", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const other = await createSeriesFirstBook(accessToken, "Foundation Saga");

    const res = await authed(
      "get",
      `/api/series/${seriesId}/character-summary?contextBookId=${other.bookId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("character_book_not_found");
  });

  it("returns 404 for a foreign or missing series", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const { seriesId } = await createSeriesFirstBook(owner.accessToken, "Dune Saga");

    const foreign = await authed(
      "get",
      `/api/series/${seriesId}/character-summary`,
      intruder.accessToken,
    );
    expect(foreign.status).toBe(HttpStatus.NOT_FOUND);

    const missing = await authed(
      "get",
      `/api/series/${MISSING_ID}/character-summary`,
      owner.accessToken,
    );
    expect(missing.status).toBe(HttpStatus.NOT_FOUND);
  });
});
