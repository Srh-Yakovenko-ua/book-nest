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
import { TagsModule } from "../../tags/tags.module.js";
import { CharactersModule } from "../characters.module.js";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, TagsModule, CharactersModule]);
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

async function attachTags(
  token: string,
  bookId: string,
  characterId: string,
  tagIds: string[],
): Promise<void> {
  const res = await authed("patch", `/api/books/${bookId}/characters/${characterId}`, token).send({
    tagIds,
  });
  expect(res.status).toBe(HttpStatus.OK);
}

function authed(
  method: "delete" | "get" | "patch" | "post" | "put",
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

async function createGlobal(token: string, character: Record<string, unknown>): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createGroup(token: string, body: Record<string, unknown>): Promise<string> {
  const res = await authed("post", "/api/character-groups", token).send({
    name: "The Fremen",
    type: "organization",
    ...body,
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
    bookProfile: { importance: "supporting", ...profile },
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

async function createTag(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/tags", token).send({ name });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function names(res: request.Response): string[] {
  return res.body.items.map((item: { name: string }) => item.name);
}

describe("global catalog: tag surfacing", () => {
  it("surfaces linked tags sorted by name and returns an empty array when untagged", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const tagged = await createInBook(accessToken, bookId, { name: "Paul Atreides" });
    await createInBook(accessToken, bookId, { name: "Chani" });

    const houseTag = await createTag(accessToken, "House");
    const heroTag = await createTag(accessToken, "Chosen One");
    await attachTags(accessToken, bookId, tagged, [houseTag, heroTag]);

    const res = await authed("get", "/api/characters", accessToken);
    expect(res.status).toBe(HttpStatus.OK);

    const paul = res.body.items.find((item: { name: string }) => item.name === "Paul Atreides");
    expect(paul.tags).toEqual([
      { id: heroTag, name: "Chosen One" },
      { id: houseTag, name: "House" },
    ]);

    const chani = res.body.items.find((item: { name: string }) => item.name === "Chani");
    expect(chani.tags).toEqual([]);
  });

  it("filters by tagId to characters linked to any of the given tags", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const paul = await createInBook(accessToken, bookId, { name: "Paul Atreides" });
    await createInBook(accessToken, bookId, { name: "Chani" });

    const houseTag = await createTag(accessToken, "House");
    await attachTags(accessToken, bookId, paul, [houseTag]);

    const filtered = await authed("get", `/api/characters?tagId=${houseTag}`, accessToken);
    expect(filtered.body.totalCount).toBe(1);
    expect(filtered.body.items[0].name).toBe("Paul Atreides");
  });
});

describe("global catalog: bookId and seriesId filters", () => {
  it("filters by bookId and excludes hidden-presence appearances", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, { title: "Dune" });
    const second = await createBook(accessToken, { title: "Foundation" });

    await createInBook(accessToken, first, { name: "Paul Atreides" });
    await createInBook(accessToken, second, { name: "Hari Seldon" });
    await createInBook(
      accessToken,
      first,
      { name: "The Traitor" },
      { hidePresenceAsSpoiler: true },
    );

    const res = await authed("get", `/api/characters?bookId=${first}`, accessToken);
    expect(names(res)).toEqual(["Paul Atreides"]);
  });

  it("filters by seriesId across the series books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const standalone = await createBook(accessToken, { title: "Foundation" });

    await createInBook(accessToken, bookId, { name: "Paul Atreides" });
    await createInBook(accessToken, standalone, { name: "Hari Seldon" });

    const res = await authed("get", `/api/characters?seriesId=${seriesId}`, accessToken);
    expect(names(res)).toEqual(["Paul Atreides"]);
  });
});

describe("global catalog: groupId filter", () => {
  it("filters by groupId and hides spoiler memberships unless opted in", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const visible = await createGlobal(accessToken, { name: "Stilgar" });
    const hidden = await createGlobal(accessToken, { name: "The Mole" });
    await createGlobal(accessToken, { name: "Outsider" });

    const groupId = await createGroup(accessToken, {
      members: [
        { characterId: visible, isSpoiler: false },
        { characterId: hidden, isSpoiler: true },
      ],
    });

    const safe = await authed("get", `/api/characters?groupId=${groupId}`, accessToken);
    expect(names(safe)).toEqual(["Stilgar"]);

    const revealed = await authed(
      "get",
      `/api/characters?groupId=${groupId}&includeSpoilerSearch=true`,
      accessToken,
    );
    expect(names(revealed).sort()).toEqual(["Stilgar", "The Mole"]);
  });
});

describe("global catalog: hasSpoilers filter", () => {
  it("narrows to characters that have spoiler-flagged content without leaking it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createGlobal(accessToken, {
      aliases: [{ isSpoiler: true, name: "Kwisatz Haderach", type: "true_name" }],
      name: "Paul Atreides",
    });
    await createGlobal(accessToken, { name: "Chani" });

    const withSpoilers = await authed("get", "/api/characters?hasSpoilers=true", accessToken);
    expect(names(withSpoilers)).toEqual(["Paul Atreides"]);
    expect(JSON.stringify(withSpoilers.body)).not.toContain("Kwisatz");

    const withoutSpoilers = await authed("get", "/api/characters?hasSpoilers=false", accessToken);
    expect(names(withoutSpoilers)).toEqual(["Chani"]);
  });

  it("treats a spoiler book-appearance field as spoiler content", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      { displayName: "Muad'Dib", displayNameIsSpoiler: true },
    );
    await createInBook(accessToken, bookId, { name: "Chani" });

    const withSpoilers = await authed("get", "/api/characters?hasSpoilers=true", accessToken);
    expect(names(withSpoilers)).toEqual(["Paul Atreides"]);
  });
});

describe("global catalog: possibleDuplicates filter", () => {
  it("narrows to characters that share a name with another owned character", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createGlobal(accessToken, { name: "Paul Atreides" });
    await createGlobal(accessToken, { name: "Paul Atreides" });
    await createGlobal(accessToken, { name: "Chani" });

    const res = await authed("get", "/api/characters?possibleDuplicates=true", accessToken);
    expect(res.body.totalCount).toBe(2);
    expect(names(res)).toEqual(["Paul Atreides", "Paul Atreides"]);
  });

  it("returns nothing when there are no duplicates", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createGlobal(accessToken, { name: "Paul Atreides" });
    await createGlobal(accessToken, { name: "Chani" });

    const res = await authed("get", "/api/characters?possibleDuplicates=true", accessToken);
    expect(res.body.totalCount).toBe(0);
  });

  it("does not flag an active character whose only twin is archived", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createGlobal(accessToken, { name: "Paul Atreides" });
    const archivedTwin = await createGlobal(accessToken, { name: "Paul Atreides" });

    const prisma = app.get(PrismaService);
    await prisma.character.update({
      data: { archivedAt: new Date() },
      where: { id: archivedTwin },
    });

    const active = await authed("get", "/api/characters?possibleDuplicates=true", accessToken);
    expect(active.body.totalCount).toBe(0);

    const withinArchived = await authed(
      "get",
      "/api/characters?possibleDuplicates=true&archived=true",
      accessToken,
    );
    expect(withinArchived.body.totalCount).toBe(0);
  });
});

describe("global catalog: hasSpoilers honors contextBookId", () => {
  it("excludes spoiler content that lives outside the reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contextBook = await createBook(accessToken, { title: "Dune" });
    const futureBook = await createBook(accessToken, { title: "Dune Messiah" });

    await createInBook(
      accessToken,
      contextBook,
      { name: "Paul Atreides" },
      { displayName: "Muad'Dib", displayNameIsSpoiler: true },
    );
    await createInBook(
      accessToken,
      futureBook,
      { name: "The Ghola" },
      { hidePresenceAsSpoiler: true },
    );

    const plainContext = await authed(
      "get",
      `/api/characters?contextBookId=${contextBook}`,
      accessToken,
    );
    expect(names(plainContext).sort()).toEqual(["Paul Atreides", "The Ghola"]);

    const scoped = await authed(
      "get",
      `/api/characters?hasSpoilers=true&contextBookId=${contextBook}`,
      accessToken,
    );
    expect(names(scoped)).toEqual(["Paul Atreides"]);

    const ownerWide = await authed("get", "/api/characters?hasSpoilers=true", accessToken);
    expect(names(ownerWide).sort()).toEqual(["Paul Atreides", "The Ghola"]);
  });
});

describe("global catalog: groupId honors contextBookId book scope", () => {
  it("counts only global and in-context memberships under a contextBookId", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contextBook = await createBook(accessToken, { title: "Dune" });
    const otherBook = await createBook(accessToken, { title: "Foundation" });
    const inContext = await createGlobal(accessToken, { name: "Stilgar" });
    const outOfContext = await createGlobal(accessToken, { name: "Hayt" });
    const global = await createGlobal(accessToken, { name: "Chani" });

    const groupId = await createGroup(accessToken, {
      members: [
        { bookId: contextBook, characterId: inContext },
        { bookId: otherBook, characterId: outOfContext },
        { characterId: global },
      ],
    });

    const scoped = await authed(
      "get",
      `/api/characters?groupId=${groupId}&contextBookId=${contextBook}`,
      accessToken,
    );
    expect(names(scoped).sort()).toEqual(["Chani", "Stilgar"]);

    const ownerWide = await authed("get", `/api/characters?groupId=${groupId}`, accessToken);
    expect(names(ownerWide).sort()).toEqual(["Chani", "Hayt", "Stilgar"]);
  });
});
