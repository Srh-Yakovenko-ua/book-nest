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

async function linkCharacter({
  bookId,
  bookProfile,
  characterId,
  token,
}: {
  bookId: string;
  bookProfile: Record<string, unknown>;
  characterId: string;
  token: string;
}): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile,
    characterId,
    mode: "existing",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
}

describe("book character graph", () => {
  it("assembles a spoiler-safe graph with node fields and edge degree", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await linkCharacter({
      bookId,
      bookProfile: { importance: "central" },
      characterId: alice,
      token: accessToken,
    });
    await linkCharacter({
      bookId,
      bookProfile: { importance: "major" },
      characterId: bob,
      token: accessToken,
    });
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, description: "close allies", status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });

    const res = await authed("get", `/api/books/${bookId}/character-graph`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.mode).toBe("all");
    expect(res.body.nodes).toHaveLength(2);
    expect(res.body.nodes.every((node: { degree: number }) => node.degree === 1)).toBe(true);
    const aliceNode = res.body.nodes.find((node: { id: string }) => node.id === alice);
    expect(aliceNode).toMatchObject({ importance: "central", name: "Alice" });
    expect(res.body.edges).toHaveLength(1);
    expect(res.body.edges[0].type).toBe("friend_of");
    expect([res.body.edges[0].source, res.body.edges[0].target].sort()).toEqual(
      [alice, bob].sort(),
    );
    expect(res.body.graphVersion).toHaveLength(16);
  });

  it("drops a presence-hidden node and every edge touching it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    await linkCharacter({
      bookId,
      bookProfile: { hidePresenceAsSpoiler: true, importance: "central" },
      characterId: bob,
      token: accessToken,
    });
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: carol,
      type: "ally_of",
    });

    const res = await authed("get", `/api/books/${bookId}/character-graph`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.nodes.map((node: { id: string }) => node.id).sort()).toEqual(
      [alice, carol].sort(),
    );
    expect(res.body.nodes.find((node: { id: string }) => node.id === alice).degree).toBe(1);
    expect(res.body.hiddenContent.hasHiddenNodes).toBe(true);
    expect(res.body.edges).toHaveLength(1);
  });

  it("keeps an isTypeSpoiler edge but locks its type", async () => {
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

    const res = await authed("get", `/api/books/${bookId}/character-graph`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.edges).toHaveLength(1);
    expect(res.body.edges[0]).toMatchObject({ category: null, type: null, typeHidden: true });
    expect(res.body.hiddenContent.hasLockedEdges).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("biological_parent_of");
  });

  it("cannot traverse a hidden edge during a focus traversal", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, hideRelationshipAsSpoiler: true, status: "active" }],
      sourceCharacterId: bob,
      targetCharacterId: carol,
      type: "ally_of",
    });

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?focusCharacterId=${alice}&depth=3`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.nodes.map((node: { id: string }) => node.id).sort()).toEqual(
      [alice, bob].sort(),
    );
    expect(res.body.hiddenContent.hasHiddenEdges).toBe(true);
  });

  it("un-masks only the named reveal edge", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    const revealedId = await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, isTypeSpoiler: true, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, isTypeSpoiler: true, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: carol,
      type: "ally_of",
    });

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?revealEdgeIds=${revealedId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    const revealed = res.body.edges.find((edge: { id: string }) => edge.id === revealedId);
    const stillHidden = res.body.edges.find((edge: { id: string }) => edge.id !== revealedId);
    expect(revealed).toMatchObject({ revealed: true, type: "friend_of", typeHidden: false });
    expect(stillHidden).toMatchObject({ typeHidden: true });
    expect(JSON.stringify(stillHidden)).not.toContain("ally_of");
  });

  it("returns 404 for a foreign book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const bookId = await createBook(owner.accessToken);

    const res = await authed("get", `/api/books/${bookId}/character-graph`, intruder.accessToken);
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("series character graph", () => {
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

  it("uses the effective state as of the context book, never a later one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBookId, secondBookId, seriesId } = await createSeriesWithTwoBooks(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [
        { bookId: firstBookId, description: "allies", status: "active" },
        { bookId: secondBookId, description: "enemies", status: "ended" },
      ],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });

    const asFirst = await authed(
      "get",
      `/api/series/${seriesId}/character-graph?contextBookId=${firstBookId}`,
      accessToken,
    );
    expect(asFirst.status).toBe(HttpStatus.OK);
    expect(asFirst.body.edges).toHaveLength(1);
    expect(asFirst.body.edges[0].status).toBe("active");
    expect(JSON.stringify(asFirst.body)).not.toContain("enemies");

    const asSecond = await authed(
      "get",
      `/api/series/${seriesId}/character-graph?contextBookId=${secondBookId}`,
      accessToken,
    );
    expect(asSecond.status).toBe(HttpStatus.OK);
    expect(asSecond.body.edges[0].status).toBe("ended");
  });

  it("returns 404 for a foreign series", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const { seriesId } = await createSeriesWithTwoBooks(owner.accessToken);

    const res = await authed(
      "get",
      `/api/series/${seriesId}/character-graph`,
      intruder.accessToken,
    );
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});
