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

async function markFinished(token: string, bookId: string): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/reading-status`, token).send({
    date: "2026-01-01",
    status: "finished",
  });
  expect(res.status).toBe(HttpStatus.OK);
}

describe("character details reading-mode masking", () => {
  it("returns full values with no reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const characterId = await createInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      {
        displayName: "Muad'Dib",
        displayNameIsSpoiler: true,
        status: "dead",
        statusIsSpoiler: true,
      },
    );

    const res = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.appearances[0].displayName).toBe("Muad'Dib");
    expect(res.body.appearances[0].status).toBe("dead");
  });

  it("masks appearances beyond the context book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const characterId = await createInBook(accessToken, firstBook, { name: "Paul Atreides" });
    await linkExisting(accessToken, secondBook, characterId);

    const full = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(full.body.appearances).toHaveLength(2);

    const masked = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${firstBook}`,
      accessToken,
    );
    expect(masked.status).toBe(HttpStatus.OK);
    expect(masked.body.appearances).toHaveLength(1);
    expect(masked.body.appearances[0].bookId).toBe(firstBook);
  });

  it("redacts spoiler field values and reports hiddenFields in reading mode", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const characterId = await createInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      {
        description: "Becomes the Emperor",
        descriptionIsSpoiler: true,
        displayName: "Muad'Dib",
        displayNameIsSpoiler: true,
        portraitIsSpoiler: true,
        status: "dead",
        statusIsSpoiler: true,
      },
    );

    const res = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${bookId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    const entry = res.body.appearances[0];
    expect(entry.displayName).toBeNull();
    expect(entry.description).toBeNull();
    expect(entry.status).toBeNull();
    expect(entry.portrait).toBeNull();
    expect(entry.hiddenFields).toEqual(["description", "displayName", "portrait", "status"]);
    expect(res.body.hiddenFields).toEqual(["description", "displayName", "portrait", "status"]);
    expect(JSON.stringify(res.body)).not.toContain("Muad'Dib");
    expect(JSON.stringify(res.body)).not.toContain("Becomes the Emperor");
    expect(JSON.stringify(res.body)).not.toContain("dead");
  });

  it("reveals only the named fields without opening future appearances", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const characterId = await createInBook(
      accessToken,
      firstBook,
      { name: "Paul Atreides" },
      {
        displayName: "Usul",
        displayNameIsSpoiler: true,
        status: "dead",
        statusIsSpoiler: true,
      },
    );
    await linkExisting(accessToken, secondBook, characterId);

    const res = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${firstBook}&revealFieldIds=displayName`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.appearances).toHaveLength(1);
    const entry = res.body.appearances[0];
    expect(entry.displayName).toBe("Usul");
    expect(entry.status).toBeNull();
    expect(entry.hiddenFields).toEqual(["status"]);
    expect(res.body.hiddenFields).toEqual(["status"]);
  });

  it("returns 404 when the character only appears beyond the reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const characterId = await createInBook(accessToken, secondBook, { name: "Alia" });

    const masked = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${firstBook}`,
      accessToken,
    );
    expect(masked.status).toBe(HttpStatus.NOT_FOUND);
    expect(masked.body.code).toBe("character_not_found");
  });

  it("returns 404 when the in-context presence is hidden as a spoiler", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const characterId = await createInBook(
      accessToken,
      bookId,
      { name: "The Traitor" },
      { hidePresenceAsSpoiler: true },
    );

    const masked = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${bookId}`,
      accessToken,
    );
    expect(masked.status).toBe(HttpStatus.NOT_FOUND);
    expect(masked.body.code).toBe("character_not_found");
  });

  it("returns 404 for a context book that is not owned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const characterId = await createInBook(accessToken, bookId, { name: "Paul Atreides" });

    const masked = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${MISSING_ID}`,
      accessToken,
    );
    expect(masked.status).toBe(HttpStatus.NOT_FOUND);
    expect(masked.body.code).toBe("character_book_not_found");
  });

  it("masks appearances to a standalone context book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const standalone = await createBook(accessToken, { title: "Foundation" });
    const seriesBook = (await createSeriesFirstBook(accessToken, "Dune Saga")).bookId;
    const characterId = await createInBook(accessToken, standalone, { name: "Hari Seldon" });
    await linkExisting(accessToken, seriesBook, characterId);

    const masked = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${standalone}`,
      accessToken,
    );
    expect(masked.status).toBe(HttpStatus.OK);
    expect(masked.body.appearances).toHaveLength(1);
    expect(masked.body.appearances[0].bookId).toBe(standalone);
  });

  it("rejects an unknown reveal field id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const characterId = await createInBook(accessToken, bookId, { name: "Paul Atreides" });

    const res = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${bookId}&revealFieldIds=notAField`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });
});

describe("series default reading context", () => {
  it("resolves the last finished book with the greatest part number", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    await addSeriesBook(accessToken, seriesId, 3, "Children of Dune");
    await markFinished(accessToken, firstBook);
    await markFinished(accessToken, secondBook);

    const res = await authed("get", `/api/series/${seriesId}/reading-context/default`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual({
      contextBookId: secondBook,
      partNumber: 2,
      source: "last_finished_book",
    });
  });

  it("falls back to the first book when nothing is finished", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");

    const res = await authed("get", `/api/series/${seriesId}/reading-context/default`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual({ contextBookId: firstBook, partNumber: 1, source: "first_book" });
  });

  it("returns 404 for a foreign or missing series", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const { seriesId } = await createSeriesFirstBook(owner.accessToken, "Dune Saga");

    const foreign = await authed(
      "get",
      `/api/series/${seriesId}/reading-context/default`,
      intruder.accessToken,
    );
    expect(foreign.status).toBe(HttpStatus.NOT_FOUND);

    const missing = await authed(
      "get",
      `/api/series/${MISSING_ID}/reading-context/default`,
      owner.accessToken,
    );
    expect(missing.status).toBe(HttpStatus.NOT_FOUND);
  });
});
