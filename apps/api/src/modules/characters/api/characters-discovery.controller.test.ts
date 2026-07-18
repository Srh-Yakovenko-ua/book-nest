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

const bookProfile = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  importance: "supporting",
  ...overrides,
});

async function createGlobal(token: string, character: Record<string, unknown>): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character });
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

describe("global character list", () => {
  it("returns spoiler-safe global summaries with appearance counts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createInBook(
      accessToken,
      bookId,
      {
        globalAttitude: "like",
        name: "Paul Atreides",
        neutralDescription: "House heir",
        species: "human",
      },
      { importance: "central" },
    );

    const res = await authed("get", "/api/characters", accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalCount).toBe(1);
    const item = res.body.items[0];
    expect(item).toMatchObject({
      appearanceCount: 1,
      globalAttitude: "like",
      name: "Paul Atreides",
      neutralDescription: "House heir",
      species: "human",
    });
  });

  it("matches q on name, alias and displayName", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createInBook(
      accessToken,
      bookId,
      { aliases: [{ name: "Usul", type: "nickname" }], name: "Paul Atreides" },
      { displayName: "Muad'Dib" },
    );

    const byName = await authed("get", "/api/characters?q=atreides", accessToken);
    expect(byName.body.totalCount).toBe(1);

    const byAlias = await authed("get", "/api/characters?q=usul", accessToken);
    expect(byAlias.body.totalCount).toBe(1);

    const byDisplayName = await authed("get", "/api/characters?q=muad", accessToken);
    expect(byDisplayName.body.totalCount).toBe(1);

    const noMatch = await authed("get", "/api/characters?q=leto", accessToken);
    expect(noMatch.body.totalCount).toBe(0);
  });

  it("hides spoiler aliases from search unless includeSpoilerSearch is set", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createGlobal(accessToken, {
      aliases: [{ isSpoiler: true, name: "Kwisatz", type: "true_name" }],
      name: "Paul Atreides",
    });

    const hidden = await authed("get", "/api/characters?q=kwisatz", accessToken);
    expect(hidden.body.totalCount).toBe(0);

    const revealed = await authed(
      "get",
      "/api/characters?q=kwisatz&includeSpoilerSearch=true",
      accessToken,
    );
    expect(revealed.body.totalCount).toBe(1);
  });

  it("applies importance, gender and favorite filters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createInBook(
      accessToken,
      bookId,
      { gender: "male", isFavorite: true, name: "Paul Atreides" },
      { importance: "central" },
    );
    await createInBook(
      accessToken,
      bookId,
      { gender: "female", name: "Chani" },
      { importance: "supporting" },
    );

    const byImportance = await authed("get", "/api/characters?importance=central", accessToken);
    expect(byImportance.body.totalCount).toBe(1);
    expect(byImportance.body.items[0].name).toBe("Paul Atreides");

    const byGender = await authed("get", "/api/characters?gender=female", accessToken);
    expect(byGender.body.totalCount).toBe(1);
    expect(byGender.body.items[0].name).toBe("Chani");

    const byFavorite = await authed("get", "/api/characters?favorite=true", accessToken);
    expect(byFavorite.body.totalCount).toBe(1);
    expect(byFavorite.body.items[0].name).toBe("Paul Atreides");
  });

  it("excludes archived characters by default and lists them when requested", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const activeId = await createGlobal(accessToken, { name: "Paul Atreides" });
    const archivedId = await createGlobal(accessToken, { name: "Duncan Idaho" });

    const prisma = app.get(PrismaService);
    await prisma.character.update({
      data: { archivedAt: new Date() },
      where: { id: archivedId },
    });

    const active = await authed("get", "/api/characters", accessToken);
    expect(active.body.totalCount).toBe(1);
    expect(active.body.items[0].id).toBe(activeId);

    const archived = await authed("get", "/api/characters?archived=true", accessToken);
    expect(archived.body.totalCount).toBe(1);
    expect(archived.body.items[0].id).toBe(archivedId);
  });

  it("excludes soft-deleted characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const keepId = await createGlobal(accessToken, { name: "Paul Atreides" });
    const dropId = await createGlobal(accessToken, { name: "Duncan Idaho" });

    await authed("delete", `/api/characters/${dropId}?confirm=true`, accessToken).expect(
      HttpStatus.OK,
    );

    const res = await authed("get", "/api/characters", accessToken);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0].id).toBe(keepId);
  });

  it("hides characters flagged hidePresence in the context book but keeps them globally", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createInBook(accessToken, bookId, { name: "Paul Atreides" });
    await createInBook(
      accessToken,
      bookId,
      { name: "The Traitor" },
      { hidePresenceAsSpoiler: true },
    );

    const global = await authed("get", "/api/characters", accessToken);
    expect(global.body.totalCount).toBe(2);

    const inContext = await authed("get", `/api/characters?contextBookId=${bookId}`, accessToken);
    expect(inContext.body.totalCount).toBe(1);
    expect(inContext.body.items[0].name).toBe("Paul Atreides");
  });

  it("paginates the list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createGlobal(accessToken, { name: "Alpha" });
    await createGlobal(accessToken, { name: "Bravo" });
    await createGlobal(accessToken, { name: "Charlie" });

    const res = await authed("get", "/api/characters?pageSize=2&pageNumber=1", accessToken);
    expect(res.body.totalCount).toBe(3);
    expect(res.body.pagesCount).toBe(2);
    expect(res.body.items).toHaveLength(2);
  });

  it("does not leak another user's characters", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    await createGlobal(owner.accessToken, { name: "Paul Atreides" });

    const res = await authed("get", "/api/characters", intruder.accessToken);
    expect(res.body.totalCount).toBe(0);
  });
});

describe("book roster search", () => {
  it("does not match q against a spoiler displayName", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      { displayName: "Muad'Dib", displayNameIsSpoiler: true },
    );

    const bySpoiler = await authed(
      "get",
      `/api/books/${bookId}/characters?search=muad`,
      accessToken,
    );
    expect(bySpoiler.body.totalCount).toBe(0);

    const byName = await authed(
      "get",
      `/api/books/${bookId}/characters?search=atreides`,
      accessToken,
    );
    expect(byName.body.totalCount).toBe(1);
  });
});

describe("duplicate candidates", () => {
  it("matches on normalized name and alias overlap and never merges", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const existingId = await createGlobal(accessToken, {
      aliases: [{ name: "Usul", type: "nickname" }],
      name: "Paul Atreides",
    });

    const byName = await authed(
      "get",
      "/api/characters/duplicate-candidates?name=Paul%20Atreides",
      accessToken,
    );
    expect(byName.status).toBe(HttpStatus.OK);
    expect(byName.body.candidates).toHaveLength(1);
    expect(byName.body.candidates[0].id).toBe(existingId);

    const byAlias = await authed(
      "get",
      "/api/characters/duplicate-candidates?name=Someone&aliases=Usul",
      accessToken,
    );
    expect(byAlias.body.candidates).toHaveLength(1);
    expect(byAlias.body.candidates[0].id).toBe(existingId);

    const prisma = app.get(PrismaService);
    expect(await prisma.character.count({ where: { userId } })).toBe(1);
  });

  it("excludes the given characterId and soft-deleted candidates", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const selfId = await createGlobal(accessToken, { name: "Paul Atreides" });
    const twinId = await createGlobal(accessToken, { name: "Paul Atreides" });

    const excludingSelf = await authed(
      "get",
      `/api/characters/duplicate-candidates?name=Paul%20Atreides&characterId=${selfId}`,
      accessToken,
    );
    expect(excludingSelf.body.candidates.map((row: { id: string }) => row.id)).toEqual([twinId]);

    await authed("delete", `/api/characters/${twinId}?confirm=true`, accessToken).expect(
      HttpStatus.OK,
    );
    const afterDelete = await authed(
      "get",
      `/api/characters/duplicate-candidates?name=Paul%20Atreides&characterId=${selfId}`,
      accessToken,
    );
    expect(afterDelete.body.candidates).toHaveLength(0);
  });

  it("finds candidates similar to an existing character via characterId", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const sourceId = await createGlobal(accessToken, {
      aliases: [{ name: "Usul", type: "nickname" }],
      name: "Paul Atreides",
    });
    const twinId = await createGlobal(accessToken, { name: "Paul Atreides" });

    const res = await authed(
      "get",
      `/api/characters/duplicate-candidates?characterId=${sourceId}`,
      accessToken,
    );
    expect(res.body.candidates.map((row: { id: string }) => row.id)).toEqual([twinId]);
  });
});

describe("book character suggestions", () => {
  it("returns unlinked characters same-series first and excludes linked, archived and deleted", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const standaloneBook = await createBook(accessToken, { title: "Foundation" });

    const sameSeriesId = await createInBook(accessToken, firstBook, { name: "Chani" });
    const linkedToTargetId = await createInBook(accessToken, secondBook, { name: "Alia" });
    const otherId = await createInBook(accessToken, standaloneBook, { name: "Hari Seldon" });
    const archivedId = await createInBook(accessToken, standaloneBook, { name: "Gaius" });
    const deletedId = await createGlobal(accessToken, { name: "Piter" });

    const prisma = app.get(PrismaService);
    await prisma.character.update({ data: { archivedAt: new Date() }, where: { id: archivedId } });
    await authed("delete", `/api/characters/${deletedId}?confirm=true`, accessToken).expect(
      HttpStatus.OK,
    );

    const res = await authed("get", `/api/books/${secondBook}/character-suggestions`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    const ids = res.body.suggestions.map((row: { id: string }) => row.id);
    expect(ids).not.toContain(linkedToTargetId);
    expect(ids).not.toContain(archivedId);
    expect(ids).not.toContain(deletedId);
    expect(ids).toContain(sameSeriesId);
    expect(ids).toContain(otherId);
    expect(ids.indexOf(sameSeriesId)).toBeLessThan(ids.indexOf(otherId));
  });

  it("returns 404 for a foreign or missing book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const ownerBook = await createBook(owner.accessToken);

    const foreign = await authed(
      "get",
      `/api/books/${ownerBook}/character-suggestions`,
      intruder.accessToken,
    );
    expect(foreign.status).toBe(HttpStatus.NOT_FOUND);

    const missing = await authed(
      "get",
      `/api/books/${MISSING_ID}/character-suggestions`,
      owner.accessToken,
    );
    expect(missing.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("series character aggregate", () => {
  it("aggregates distinct characters across the series and masks future appearances by context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");

    await createInBook(
      accessToken,
      firstBook,
      { name: "Paul Atreides" },
      { displayName: "Muad'Dib", displayNameIsSpoiler: true, importance: "central" },
    );
    await createInBook(accessToken, secondBook, { name: "Alia" }, { importance: "major" });

    const full = await authed("get", `/api/series/${seriesId}/characters`, accessToken);
    expect(full.status).toBe(HttpStatus.OK);
    expect(full.body.totalCount).toBe(2);

    const paul = full.body.items.find((item: { name: string }) => item.name === "Paul Atreides");
    expect(paul.displayName).toBeNull();
    expect(paul.hiddenFields).toContain("displayName");
    expect(JSON.stringify(full.body)).not.toContain("Muad'Dib");

    const asOfFirst = await authed(
      "get",
      `/api/series/${seriesId}/characters?contextBookId=${firstBook}`,
      accessToken,
    );
    expect(asOfFirst.body.totalCount).toBe(1);
    expect(asOfFirst.body.items[0].name).toBe("Paul Atreides");

    const withFuture = await authed(
      "get",
      `/api/series/${seriesId}/characters?contextBookId=${firstBook}&includeFuture=true`,
      accessToken,
    );
    expect(withFuture.body.totalCount).toBe(2);
  });

  it("excludes characters whose appearance hides its presence", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    await createInBook(accessToken, bookId, { name: "Paul Atreides" });
    await createInBook(
      accessToken,
      bookId,
      { name: "The Traitor" },
      { hidePresenceAsSpoiler: true },
    );

    const res = await authed("get", `/api/series/${seriesId}/characters`, accessToken);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0].name).toBe("Paul Atreides");
  });

  it("does not match q against a spoiler displayName", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    await createInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      { displayName: "Muad'Dib", displayNameIsSpoiler: true, hidePresenceAsSpoiler: false },
    );

    const bySpoiler = await authed("get", `/api/series/${seriesId}/characters?q=muad`, accessToken);
    expect(bySpoiler.body.totalCount).toBe(0);

    const byName = await authed(
      "get",
      `/api/series/${seriesId}/characters?q=atreides`,
      accessToken,
    );
    expect(byName.body.totalCount).toBe(1);
  });

  it("returns 404 for a foreign series or a context book outside the series", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const { seriesId } = await createSeriesFirstBook(owner.accessToken, "Dune Saga");
    const outsideBook = await createBook(owner.accessToken, { title: "Foundation" });

    const foreignSeries = await authed(
      "get",
      `/api/series/${seriesId}/characters`,
      intruder.accessToken,
    );
    expect(foreignSeries.status).toBe(HttpStatus.NOT_FOUND);

    const foreignContext = await authed(
      "get",
      `/api/series/${seriesId}/characters?contextBookId=${outsideBook}`,
      owner.accessToken,
    );
    expect(foreignContext.status).toBe(HttpStatus.NOT_FOUND);
  });
});
