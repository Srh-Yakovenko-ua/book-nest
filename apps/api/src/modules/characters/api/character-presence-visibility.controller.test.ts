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

type ReadingSeries = {
  firstBook: string;
  futureCharacterId: string;
  lateCharacterId: string;
  secondBook: string;
  seriesId: string;
};

const READER_PAGE = 20;
const LATE_FIRST_APPEARANCE_PAGE = 300;
const LATE_CHARACTER_NAME = "Alia Atreides";
const FUTURE_CHARACTER_NAME = "Leto II";

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

async function addCharacter({
  bookId,
  bookProfile,
  name,
  token,
}: {
  bookId: string;
  bookProfile: Record<string, unknown>;
  name: string;
  token: string;
}): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile,
    character: { name },
    mode: "new",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function authed(method: "delete" | "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

function characterIdsOf(items: { characterId: string }[]): string[] {
  return items.map((item) => item.characterId);
}

async function getOk(token: string, path: string): Promise<request.Response> {
  const res = await authed("get", path, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res;
}

function idsOf(items: { id: string }[]): string[] {
  return items.map((item) => item.id);
}

async function seedReadingSeries(token: string): Promise<ReadingSeries> {
  const first = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    newSeries: { name: "Dune Saga" },
    ownershipStatus: "owned",
    pagesCount: 500,
    partNumber: 1,
    readingProgress: { currentPage: READER_PAGE },
    readingStatus: "reading",
    title: "Dune",
  });
  expect(first.status).toBe(HttpStatus.CREATED);
  expect(first.body.readingProgress.currentPage).toBe(READER_PAGE);
  const seriesId: string = first.body.series.id;

  const second = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    ownershipStatus: "owned",
    partNumber: 2,
    seriesId,
    title: "Dune Messiah",
  });
  expect(second.status).toBe(HttpStatus.CREATED);

  const lateCharacterId = await addCharacter({
    bookId: first.body.id,
    bookProfile: { firstAppearancePage: LATE_FIRST_APPEARANCE_PAGE, importance: "central" },
    name: LATE_CHARACTER_NAME,
    token,
  });
  const futureCharacterId = await addCharacter({
    bookId: second.body.id,
    bookProfile: { importance: "central" },
    name: FUTURE_CHARACTER_NAME,
    token,
  });

  return {
    firstBook: first.body.id,
    futureCharacterId,
    lateCharacterId,
    secondBook: second.body.id,
    seriesId,
  };
}

describe("a character first met past the reader's progress is never hidden", () => {
  it("appears in the book roster and its total", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await seedReadingSeries(accessToken);

    const roster = await getOk(
      accessToken,
      `/api/books/${series.firstBook}/characters?contextBookId=${series.firstBook}`,
    );

    expect(roster.body.totalCount).toBe(1);
    expect(characterIdsOf(roster.body.items)).toEqual([series.lateCharacterId]);
  });

  it("is counted in the book summary totals", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await seedReadingSeries(accessToken);

    const recap = await getOk(
      accessToken,
      `/api/books/${series.firstBook}/character-summary?contextBookId=${series.firstBook}`,
    );

    expect(recap.body.totalVisibleCharacters).toBe(1);
    expect(recap.body.byImportance.central).toBe(1);
    expect(characterIdsOf(recap.body.top)).toEqual([series.lateCharacterId]);
  });

  it("appears in the global list filtered by its book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await seedReadingSeries(accessToken);

    const listed = await getOk(accessToken, `/api/characters?bookId=${series.firstBook}`);

    expect(idsOf(listed.body.items)).toEqual([series.lateCharacterId]);
  });

  it("appears in the global list read from its book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await seedReadingSeries(accessToken);

    const listed = await getOk(accessToken, `/api/characters?contextBookId=${series.firstBook}`);

    expect(idsOf(listed.body.items)).toContain(series.lateCharacterId);
  });

  it("is found by search on the roster and the global list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await seedReadingSeries(accessToken);

    const onRoster = await getOk(
      accessToken,
      `/api/books/${series.firstBook}/characters?search=alia&contextBookId=${series.firstBook}`,
    );
    const inGlobalList = await getOk(
      accessToken,
      `/api/characters?q=alia&contextBookId=${series.firstBook}`,
    );

    expect(characterIdsOf(onRoster.body.items)).toEqual([series.lateCharacterId]);
    expect(idsOf(inGlobalList.body.items)).toEqual([series.lateCharacterId]);
  });

  it("is suggested for linking into the next part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await seedReadingSeries(accessToken);

    const suggested = await getOk(
      accessToken,
      `/api/books/${series.secondBook}/character-suggestions?contextBookId=${series.firstBook}`,
    );

    expect(idsOf(suggested.body.suggestions)).toEqual([series.lateCharacterId]);
  });

  it("appears in the series list and summary", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await seedReadingSeries(accessToken);

    const listed = await getOk(
      accessToken,
      `/api/series/${series.seriesId}/characters?contextBookId=${series.firstBook}`,
    );
    const recap = await getOk(
      accessToken,
      `/api/series/${series.seriesId}/character-summary?contextBookId=${series.firstBook}`,
    );

    expect(characterIdsOf(listed.body.items)).toEqual([series.lateCharacterId]);
    expect(recap.body.totalVisibleCharacters).toBe(1);
  });

  it("opens its series profile and its contextual details", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await seedReadingSeries(accessToken);

    const profile = await getOk(
      accessToken,
      `/api/series/${series.seriesId}/characters/${series.lateCharacterId}?contextBookId=${series.firstBook}`,
    );
    const details = await getOk(
      accessToken,
      `/api/characters/${series.lateCharacterId}?contextBookId=${series.firstBook}`,
    );

    expect(profile.body.name).toBe(LATE_CHARACTER_NAME);
    expect(details.body.name).toBe(LATE_CHARACTER_NAME);
    expect(details.body.appearances).toEqual([
      expect.objectContaining({
        bookId: series.firstBook,
        firstAppearancePage: LATE_FIRST_APPEARANCE_PAGE,
      }),
    ]);
  });
});

describe("access rules still hold for characters that are never hidden", () => {
  it("returns 404 for another user's character on every details surface", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const series = await seedReadingSeries(owner.accessToken);

    for (const path of [
      `/api/characters/${series.lateCharacterId}`,
      `/api/books/${series.firstBook}/characters/${series.lateCharacterId}`,
      `/api/series/${series.seriesId}/characters/${series.lateCharacterId}`,
    ]) {
      const res = await authed("get", path, intruder.accessToken);
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(JSON.stringify(res.body)).not.toContain(LATE_CHARACTER_NAME);
    }
  });

  it("returns 404 for a context book outside the reader's library", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const series = await seedReadingSeries(owner.accessToken);
    const intruderSeries = await seedReadingSeries(intruder.accessToken);

    const res = await authed(
      "get",
      `/api/characters/${series.lateCharacterId}?contextBookId=${intruderSeries.firstBook}`,
      owner.accessToken,
    );

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("character_book_not_found");
  });

  it("drops a soft-deleted character from every surface", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await seedReadingSeries(accessToken);
    const rosterPath = `/api/books/${series.firstBook}/characters?contextBookId=${series.firstBook}`;
    const before = await getOk(accessToken, rosterPath);
    expect(before.body.totalCount).toBe(1);

    const deleted = await authed(
      "delete",
      `/api/characters/${series.lateCharacterId}?confirm=true`,
      accessToken,
    );
    expect(deleted.status).toBe(HttpStatus.OK);

    const roster = await getOk(accessToken, rosterPath);
    const globalList = await getOk(accessToken, `/api/characters?bookId=${series.firstBook}`);
    const seriesList = await getOk(
      accessToken,
      `/api/series/${series.seriesId}/characters?contextBookId=${series.firstBook}`,
    );
    const details = await authed(
      "get",
      `/api/characters/${series.lateCharacterId}?contextBookId=${series.firstBook}`,
      accessToken,
    );

    expect(roster.body.totalCount).toBe(0);
    expect(globalList.body.items).toEqual([]);
    expect(seriesList.body.items).toEqual([]);
    expect(details.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("drops a character whose only book was trashed from the series surfaces", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await seedReadingSeries(accessToken);
    const seriesListPath = `/api/series/${series.seriesId}/characters?contextBookId=${series.secondBook}`;
    const before = await getOk(accessToken, seriesListPath);
    expect(characterIdsOf(before.body.items)).toContain(series.lateCharacterId);

    const trashed = await authed("delete", `/api/books/${series.firstBook}`, accessToken);
    expect(trashed.status).toBe(HttpStatus.OK);

    const seriesList = await getOk(accessToken, seriesListPath);
    const recap = await getOk(
      accessToken,
      `/api/series/${series.seriesId}/character-summary?contextBookId=${series.secondBook}`,
    );
    const profile = await authed(
      "get",
      `/api/series/${series.seriesId}/characters/${series.lateCharacterId}?contextBookId=${series.secondBook}`,
      accessToken,
    );

    expect(characterIdsOf(seriesList.body.items)).toEqual([series.futureCharacterId]);
    expect(recap.body.totalVisibleCharacters).toBe(1);
    expect(profile.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("keeps a later part's appearance off the series profile unless includeFuture is set", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await seedReadingSeries(accessToken);
    const linked = await authed(
      "post",
      `/api/books/${series.secondBook}/characters`,
      accessToken,
    ).send({
      bookProfile: { importance: "central", status: "dead" },
      characterId: series.lateCharacterId,
      mode: "existing",
    });
    expect(linked.status).toBe(HttpStatus.CREATED);
    const profilePath = `/api/series/${series.seriesId}/characters/${series.lateCharacterId}?contextBookId=${series.firstBook}`;

    const current = await getOk(accessToken, `${profilePath}&includeFuture=false`);
    const withFuture = await getOk(accessToken, `${profilePath}&includeFuture=true`);

    expect(current.body.appearances.map((entry: { bookId: string }) => entry.bookId)).toEqual([
      series.firstBook,
    ]);
    expect(JSON.stringify(current.body)).not.toContain("dead");
    expect(withFuture.body.appearances.map((entry: { bookId: string }) => entry.bookId)).toEqual([
      series.firstBook,
      series.secondBook,
    ]);
  });

  it("keeps a later part's cast off the series list unless includeFuture is set", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const series = await seedReadingSeries(accessToken);
    const listPath = `/api/series/${series.seriesId}/characters?contextBookId=${series.firstBook}`;

    const current = await getOk(accessToken, `${listPath}&includeFuture=false`);
    const withFuture = await getOk(accessToken, `${listPath}&includeFuture=true`);

    expect(characterIdsOf(current.body.items)).toEqual([series.lateCharacterId]);
    expect(characterIdsOf(withFuture.body.items).sort()).toEqual(
      [series.futureCharacterId, series.lateCharacterId].sort(),
    );
  });
});
