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
    title: "Dune",
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

describe("series character profile", () => {
  it("returns the character identity and an appearance timeline ordered by part number", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const characterId = await createInBook(
      accessToken,
      firstBook,
      { gender: "male", name: "Paul Atreides", species: "human" },
      { importance: "central" },
    );
    await linkExisting(accessToken, secondBook, characterId, { importance: "major" });

    const res = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({
      characterId,
      gender: "male",
      name: "Paul Atreides",
      species: "human",
    });
    expect(res.body.appearances).toHaveLength(2);
    expect(res.body.appearances[0]).toMatchObject({ bookId: firstBook, partNumber: 1 });
    expect(res.body.appearances[1]).toMatchObject({ bookId: secondBook, partNumber: 2 });
  });

  it("masks later-part appearances by reading context and reveals them with includeFuture", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const characterId = await createInBook(accessToken, firstBook, { name: "Paul Atreides" });
    await linkExisting(accessToken, secondBook, characterId);

    const asOfFirst = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${firstBook}`,
      accessToken,
    );
    expect(asOfFirst.status).toBe(HttpStatus.OK);
    expect(asOfFirst.body.appearances).toHaveLength(1);
    expect(asOfFirst.body.appearances[0].bookId).toBe(firstBook);

    const withFuture = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${firstBook}&includeFuture=true`,
      accessToken,
    );
    expect(withFuture.body.appearances).toHaveLength(2);
  });

  it("excludes appearances that hide their presence as a spoiler", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const characterId = await createInBook(accessToken, firstBook, { name: "Paul Atreides" });
    await linkExisting(accessToken, secondBook, characterId, { hidePresenceAsSpoiler: true });

    const res = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.appearances).toHaveLength(1);
    expect(res.body.appearances[0].bookId).toBe(firstBook);
  });

  it("returns 404 when the character only appears in hidden appearances", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const characterId = await createInBook(
      accessToken,
      bookId,
      { name: "The Traitor" },
      { hidePresenceAsSpoiler: true },
    );

    const res = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("character_not_found");
  });

  it("returns 404 when the character only appears beyond the reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const characterId = await createInBook(accessToken, secondBook, { name: "Alia" });

    const masked = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${firstBook}`,
      accessToken,
    );
    expect(masked.status).toBe(HttpStatus.NOT_FOUND);

    const withFuture = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${firstBook}&includeFuture=true`,
      accessToken,
    );
    expect(withFuture.status).toBe(HttpStatus.OK);
    expect(withFuture.body.appearances).toHaveLength(1);
    expect(withFuture.body.appearances[0].bookId).toBe(secondBook);
  });

  it("redacts spoiler display name, status and portrait and reports hiddenFields", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const characterId = await createInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      {
        displayName: "Muad'Dib",
        displayNameIsSpoiler: true,
        importance: "central",
        portraitIsSpoiler: true,
        status: "dead",
        statusIsSpoiler: true,
      },
    );

    const res = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    const entry = res.body.appearances[0];
    expect(entry.displayName).toBeNull();
    expect(entry.status).toBeNull();
    expect(entry.portrait).toBeNull();
    expect(entry.hiddenFields).toEqual(["displayName", "portrait", "status"]);
    expect(res.body.hiddenFields).toEqual(["displayName", "portrait", "status"]);
    expect(JSON.stringify(res.body)).not.toContain("Muad'Dib");
    expect(JSON.stringify(res.body)).not.toContain("dead");
  });

  it("returns 404 for a context book outside the series", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const characterId = await createInBook(accessToken, firstBook, { name: "Paul Atreides" });
    const outsideBook = await createBook(accessToken, { title: "Foundation" });

    const res = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${outsideBook}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("character_book_not_found");
  });

  it("returns 404 for a foreign series, a foreign character, or a character not in the series", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(
      owner.accessToken,
      "Dune Saga",
    );
    const memberId = await createInBook(owner.accessToken, firstBook, { name: "Paul Atreides" });

    const foreignSeries = await authed(
      "get",
      `/api/series/${seriesId}/characters/${memberId}`,
      intruder.accessToken,
    );
    expect(foreignSeries.status).toBe(HttpStatus.NOT_FOUND);

    const standaloneBook = await createBook(owner.accessToken, { title: "Foundation" });
    const outsiderId = await createInBook(owner.accessToken, standaloneBook, {
      name: "Hari Seldon",
    });
    const notInSeries = await authed(
      "get",
      `/api/series/${seriesId}/characters/${outsiderId}`,
      owner.accessToken,
    );
    expect(notInSeries.status).toBe(HttpStatus.NOT_FOUND);

    const missing = await authed(
      "get",
      `/api/series/${seriesId}/characters/${MISSING_ID}`,
      owner.accessToken,
    );
    expect(missing.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("filters aliases by spoiler flag and reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const characterId = await createInBook(accessToken, firstBook, {
      aliases: [
        { name: "Usul", type: "nickname" },
        { isSpoiler: true, name: "Kwisatz", type: "true_name" },
        { bookId: secondBook, name: "FutureName", type: "nickname" },
        { bookId: firstBook, name: "ContextName", type: "nickname" },
      ],
      name: "Paul Atreides",
    });

    const res = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${firstBook}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    const aliasNames = res.body.aliases.map((alias: { name: string }) => alias.name);
    expect(aliasNames).toContain("Usul");
    expect(aliasNames).toContain("ContextName");
    expect(aliasNames).not.toContain("Kwisatz");
    expect(aliasNames).not.toContain("FutureName");
    expect(JSON.stringify(res.body)).not.toContain("Kwisatz");
  });

  it("surfaces per-appearance attitude and non-spoiler roles and flags attitude changes across the arc", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const thirdBook = await addSeriesBook(accessToken, seriesId, 3, "Children of Dune");
    const characterId = await createInBook(
      accessToken,
      firstBook,
      { name: "Paul Atreides" },
      { attitude: "distrust", roles: [{ roleType: "antagonist" }] },
    );
    await linkExisting(accessToken, secondBook, characterId, {
      attitude: "distrust",
      roles: [{ roleType: "supporting" }],
    });
    await linkExisting(accessToken, thirdBook, characterId, {
      attitude: "favorite",
      roles: [
        { roleType: "protagonist" },
        { customRole: "Secret Messiah", isSpoiler: true, roleType: "custom" },
      ],
    });

    const res = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.appearances).toHaveLength(3);

    const [first, second, third] = res.body.appearances;
    expect(first).toMatchObject({ attitude: "distrust", attitudeChangedFromPrevious: false });
    expect(first.roles.map((role: { roleType: string }) => role.roleType)).toEqual(["antagonist"]);
    expect(second).toMatchObject({ attitude: "distrust", attitudeChangedFromPrevious: false });
    expect(third).toMatchObject({ attitude: "favorite", attitudeChangedFromPrevious: true });
    expect(third.roles.map((role: { roleType: string }) => role.roleType)).toEqual(["protagonist"]);
    expect(JSON.stringify(res.body)).not.toContain("Secret Messiah");
  });

  it("flags importance and status changes relative to the previous visible appearance", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const characterId = await createInBook(
      accessToken,
      firstBook,
      { name: "Paul Atreides" },
      { importance: "supporting", status: "active" },
    );
    await linkExisting(accessToken, secondBook, characterId, {
      importance: "central",
      status: "active",
    });

    const res = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    const [first, second] = res.body.appearances;
    expect(first).toMatchObject({
      attitudeChangedFromPrevious: false,
      importanceChangedFromPrevious: false,
      statusChangedFromPrevious: false,
    });
    expect(second).toMatchObject({
      importanceChangedFromPrevious: true,
      statusChangedFromPrevious: false,
    });
  });

  it("never reflects a change into a book beyond the reading context in a visible marker", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const thirdBook = await addSeriesBook(accessToken, seriesId, 3, "Children of Dune");
    const characterId = await createInBook(
      accessToken,
      firstBook,
      { name: "Paul Atreides" },
      { attitude: "neutral" },
    );
    await linkExisting(accessToken, secondBook, characterId, { attitude: "neutral" });
    await linkExisting(accessToken, thirdBook, characterId, { attitude: "hate" });

    const masked = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${secondBook}`,
      accessToken,
    );
    expect(masked.status).toBe(HttpStatus.OK);
    expect(masked.body.appearances).toHaveLength(2);
    expect(
      masked.body.appearances.every(
        (appearance: { attitudeChangedFromPrevious: boolean }) =>
          appearance.attitudeChangedFromPrevious === false,
      ),
    ).toBe(true);
    expect(JSON.stringify(masked.body)).not.toContain("hate");

    const withFuture = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${secondBook}&includeFuture=true`,
      accessToken,
    );
    expect(withFuture.body.appearances).toHaveLength(3);
    expect(withFuture.body.appearances[2]).toMatchObject({
      attitude: "hate",
      attitudeChangedFromPrevious: true,
    });
  });
});
