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
  method: "delete" | "get" | "patch" | "post" | "put",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "George R. R. Martin" }],
    ownershipStatus: "owned",
    title: "A Game of Thrones",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCharacter(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character: { name } });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createRelationship(token: string, body: Record<string, unknown>): Promise<string> {
  const res = await authed("post", "/api/character-relationships", token).send(body);
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createSeriesWithTwoBooks(
  token: string,
): Promise<{ firstBookId: string; secondBookId: string; seriesId: string }> {
  const first = await authed("post", "/api/books", token).send({
    authors: [{ name: "George R. R. Martin" }],
    bookType: "series_part",
    newSeries: { name: "A Song of Ice and Fire" },
    ownershipStatus: "owned",
    partNumber: 1,
    title: "A Game of Thrones",
  });
  expect(first.status).toBe(HttpStatus.CREATED);
  const seriesId = first.body.series.id;
  const second = await authed("post", "/api/books", token).send({
    authors: [{ name: "George R. R. Martin" }],
    bookType: "series_part",
    ownershipStatus: "owned",
    partNumber: 2,
    seriesId,
    title: "A Clash of Kings",
  });
  expect(second.status).toBe(HttpStatus.CREATED);
  return { firstBookId: first.body.id, secondBookId: second.body.id, seriesId };
}

function socialEdge({
  bookId,
  extraState = {},
  sourceCharacterId,
  targetCharacterId,
  type = "friend_of",
}: {
  bookId: string;
  extraState?: Record<string, unknown>;
  sourceCharacterId: string;
  targetCharacterId: string;
  type?: string;
}): Record<string, unknown> {
  return {
    category: "social",
    directionality: "symmetric",
    initialBookStates: [{ bookId, status: "active", ...extraState }],
    sourceCharacterId,
    targetCharacterId,
    type,
  };
}

describe("character relationship path finder", () => {
  it("returns the shortest visible chain in order", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    await createRelationship(
      accessToken,
      socialEdge({ bookId, sourceCharacterId: alice, targetCharacterId: bob }),
    );
    await createRelationship(
      accessToken,
      socialEdge({ bookId, sourceCharacterId: bob, targetCharacterId: carol, type: "ally_of" }),
    );

    const res = await authed(
      "get",
      `/api/character-relationships/path?fromId=${alice}&toId=${carol}&contextBookId=${bookId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.found).toBe(true);
    expect(res.body.nodes.map((node: { id: string }) => node.id)).toEqual([alice, bob, carol]);
    expect(res.body.edges).toHaveLength(2);
    expect([res.body.edges[0].source, res.body.edges[0].target].sort()).toEqual(
      [alice, bob].sort(),
    );
  });

  it("hides a path that only exists through a hidden edge, identical to unconnected", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    await createRelationship(
      accessToken,
      socialEdge({ bookId, sourceCharacterId: alice, targetCharacterId: bob }),
    );
    const hiddenRelationshipId = await createRelationship(
      accessToken,
      socialEdge({
        bookId,
        extraState: { hideRelationshipAsSpoiler: true },
        sourceCharacterId: bob,
        targetCharacterId: carol,
        type: "ally_of",
      }),
    );

    const viaHidden = await authed(
      "get",
      `/api/character-relationships/path?fromId=${alice}&toId=${carol}&contextBookId=${bookId}`,
      accessToken,
    );
    expect(viaHidden.status).toBe(HttpStatus.OK);
    expect(viaHidden.body).toEqual({
      edges: [],
      found: false,
      fromId: alice,
      nodes: [],
      toId: carol,
    });
    expect(JSON.stringify(viaHidden.body)).not.toContain(hiddenRelationshipId);

    const dave = await createCharacter(accessToken, "Dave");
    const unconnected = await authed(
      "get",
      `/api/character-relationships/path?fromId=${alice}&toId=${dave}&contextBookId=${bookId}`,
      accessToken,
    );
    expect(unconnected.body.found).toBe(false);
    expect(unconnected.body.nodes).toHaveLength(0);
    expect(unconnected.body.edges).toHaveLength(0);
  });

  it("keeps an isTypeSpoiler hop but locks its type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await createRelationship(accessToken, {
      category: "family",
      directionality: "directed",
      initialBookStates: [{ bookId, isTypeSpoiler: true, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "biological_parent_of",
    });

    const res = await authed(
      "get",
      `/api/character-relationships/path?fromId=${alice}&toId=${bob}&contextBookId=${bookId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.found).toBe(true);
    expect(res.body.edges).toHaveLength(1);
    expect(res.body.edges[0]).toMatchObject({ category: null, type: null, typeHidden: true });
    expect(JSON.stringify(res.body)).not.toContain("biological_parent_of");
  });

  it("never traverses a future book's edge as of the context book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBookId, secondBookId } = await createSeriesWithTwoBooks(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    await createRelationship(
      accessToken,
      socialEdge({ bookId: firstBookId, sourceCharacterId: alice, targetCharacterId: bob }),
    );
    await createRelationship(
      accessToken,
      socialEdge({
        bookId: firstBookId,
        sourceCharacterId: bob,
        targetCharacterId: carol,
        type: "ally_of",
      }),
    );
    const directRelationshipId = await createRelationship(
      accessToken,
      socialEdge({
        bookId: secondBookId,
        sourceCharacterId: alice,
        targetCharacterId: carol,
        type: "acquaintance_of",
      }),
    );

    const asFirst = await authed(
      "get",
      `/api/character-relationships/path?fromId=${alice}&toId=${carol}&contextBookId=${firstBookId}`,
      accessToken,
    );
    expect(asFirst.status).toBe(HttpStatus.OK);
    expect(asFirst.body.found).toBe(true);
    expect(asFirst.body.nodes.map((node: { id: string }) => node.id)).toEqual([alice, bob, carol]);
    expect(JSON.stringify(asFirst.body)).not.toContain(directRelationshipId);

    const asSecond = await authed(
      "get",
      `/api/character-relationships/path?fromId=${alice}&toId=${carol}&contextBookId=${secondBookId}`,
      accessToken,
    );
    expect(asSecond.status).toBe(HttpStatus.OK);
    expect(asSecond.body.nodes.map((node: { id: string }) => node.id)).toEqual([alice, carol]);
    expect(asSecond.body.edges.map((edge: { id: string }) => edge.id)).toEqual([
      directRelationshipId,
    ]);
  });

  it("treats a character as trivially connected to itself", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");

    const res = await authed(
      "get",
      `/api/character-relationships/path?fromId=${alice}&toId=${alice}&contextBookId=${bookId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.found).toBe(true);
    expect(res.body.nodes.map((node: { id: string }) => node.id)).toEqual([alice]);
    expect(res.body.edges).toHaveLength(0);
  });

  it("404s a foreign endpoint identically to a missing one, with no oracle", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const alice = await createCharacter(owner.accessToken, "Alice");
    const bob = await createCharacter(owner.accessToken, "Bob");

    const foreign = await authed(
      "get",
      `/api/character-relationships/path?fromId=${alice}&toId=${bob}`,
      intruder.accessToken,
    );
    expect(foreign.status).toBe(HttpStatus.NOT_FOUND);

    const missing = await authed(
      "get",
      `/api/character-relationships/path?fromId=${MISSING_ID}&toId=${bob}`,
      owner.accessToken,
    );
    expect(missing.status).toBe(HttpStatus.NOT_FOUND);
  });
});
