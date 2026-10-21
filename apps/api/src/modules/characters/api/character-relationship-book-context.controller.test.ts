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

const RELATIONSHIPS = "/api/character-relationships";
const BOOK_CONTEXT_INVALID = "relationship_book_context_invalid";

type Pair = { alice: string; bob: string };

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

async function createBook(token: string, title: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Ursula K. Le Guin" }],
    ownershipStatus: "owned",
    title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCharacter(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character: { name } });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createFriendship(token: string, pair: Pair): Promise<string> {
  const res = await postFriendship(token, { ...pair, bookIds: [] });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createPair(token: string): Promise<Pair> {
  return {
    alice: await createCharacter(token, "Alice"),
    bob: await createCharacter(token, "Bob"),
  };
}

async function linkToBook(token: string, bookId: string, characterIds: string[]): Promise<void> {
  for (const characterId of characterIds) {
    const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
      bookProfile: {},
      characterId,
      mode: "existing",
    });
    expect(res.status).toBe(HttpStatus.CREATED);
  }
}

function postFriendship(
  token: string,
  { alice, bob, bookIds }: Pair & { bookIds: string[] },
): request.Test {
  return authed("post", RELATIONSHIPS, token).send({
    category: "social",
    directionality: "symmetric",
    initialBookStates: bookIds.map((bookId) => ({ bookId, status: "active" })),
    sourceCharacterId: alice,
    targetCharacterId: bob,
    type: "friend_of",
  });
}

function putState(
  token: string,
  { bookId, relationshipId }: { bookId: string; relationshipId: string },
  state: Record<string, unknown>,
): request.Test {
  return authed("put", `${RELATIONSHIPS}/${relationshipId}/books/${bookId}`, token).send(state);
}

async function readBookStates(
  token: string,
  relationshipId: string,
): Promise<{ bookId: string; description: null | string; status: string }[]> {
  const res = await authed("get", `${RELATIONSHIPS}/${relationshipId}/edit`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body.bookStates;
}

async function unlinkFromBook(token: string, bookId: string, characterId: string): Promise<void> {
  const res = await authed("delete", `/api/books/${bookId}/characters/${characterId}`, token);
  expect(res.status).toBe(HttpStatus.NO_CONTENT);
}

describe("POST /api/character-relationships book membership", () => {
  it("R56 rejects a state whose book lacks one endpoint with relationship_book_context_invalid", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "A Wizard of Earthsea");
    const pair = await createPair(accessToken);
    await linkToBook(accessToken, bookId, [pair.alice]);

    const res = await postFriendship(accessToken, { ...pair, bookIds: [bookId] });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.code).toBe(BOOK_CONTEXT_INVALID);
  });

  it("R56 rejects when each endpoint is linked only to its own book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstBookId = await createBook(accessToken, "A Wizard of Earthsea");
    const secondBookId = await createBook(accessToken, "The Tombs of Atuan");
    const pair = await createPair(accessToken);
    await linkToBook(accessToken, firstBookId, [pair.alice]);
    await linkToBook(accessToken, secondBookId, [pair.bob]);

    const res = await postFriendship(accessToken, {
      ...pair,
      bookIds: [firstBookId, secondBookId],
    });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.code).toBe(BOOK_CONTEXT_INVALID);
  });

  it("R55 rejects a new state once a participant was unlinked from the book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "A Wizard of Earthsea");
    const pair = await createPair(accessToken);
    await linkToBook(accessToken, bookId, [pair.alice, pair.bob]);
    await unlinkFromBook(accessToken, bookId, pair.bob);

    const res = await postFriendship(accessToken, { ...pair, bookIds: [bookId] });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.code).toBe(BOOK_CONTEXT_INVALID);
  });

  it("R55 leaves no edge behind after a rejected POST, so the same edge can still be created", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "A Wizard of Earthsea");
    const pair = await createPair(accessToken);
    await linkToBook(accessToken, bookId, [pair.alice]);
    const rejected = await postFriendship(accessToken, { ...pair, bookIds: [bookId] });
    expect(rejected.status).toBe(HttpStatus.BAD_REQUEST);

    const retried = await postFriendship(accessToken, { ...pair, bookIds: [] });

    expect(retried.status).toBe(HttpStatus.CREATED);
    expect(retried.body.bookStates).toEqual([]);
  });

  it("R57 keeps an empty initialBookStates valid for characters in no book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const pair = await createPair(accessToken);

    const res = await postFriendship(accessToken, { ...pair, bookIds: [] });

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.bookStates).toEqual([]);
  });
});

describe("PUT /api/character-relationships/:id/books/:bookId book membership", () => {
  it("R58 rejects a new state for a book that lacks one endpoint and stores nothing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "A Wizard of Earthsea");
    const pair = await createPair(accessToken);
    await linkToBook(accessToken, bookId, [pair.alice]);
    const relationshipId = await createFriendship(accessToken, pair);

    const res = await putState(accessToken, { bookId, relationshipId }, { status: "active" });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.code).toBe(BOOK_CONTEXT_INVALID);
    expect(await readBookStates(accessToken, relationshipId)).toEqual([]);
  });

  it("R58 creates a new state when both endpoints are in the book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "A Wizard of Earthsea");
    const pair = await createPair(accessToken);
    await linkToBook(accessToken, bookId, [pair.alice, pair.bob]);
    const relationshipId = await createFriendship(accessToken, pair);

    const res = await putState(
      accessToken,
      { bookId, relationshipId },
      { description: "allies", status: "active" },
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.bookStates).toEqual([
      expect.objectContaining({ bookId, description: "allies", status: "active" }),
    ]);
  });

  it("R57 R58 still updates an existing state after an endpoint left the book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "A Wizard of Earthsea");
    const pair = await createPair(accessToken);
    await linkToBook(accessToken, bookId, [pair.alice, pair.bob]);
    const created = await postFriendship(accessToken, { ...pair, bookIds: [bookId] });
    expect(created.status).toBe(HttpStatus.CREATED);
    const relationshipId: string = created.body.id;
    await unlinkFromBook(accessToken, bookId, pair.bob);

    const res = await putState(
      accessToken,
      { bookId, relationshipId },
      { description: "estranged", status: "ended" },
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.bookStates).toEqual([
      expect.objectContaining({ bookId, description: "estranged", status: "ended" }),
    ]);
  });

  it("R58 lets two concurrent PUTs insert exactly one new state and answers both without a 500", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "A Wizard of Earthsea");
    const pair = await createPair(accessToken);
    await linkToBook(accessToken, bookId, [pair.alice, pair.bob]);
    const relationshipId = await createFriendship(accessToken, pair);
    const target = { bookId, relationshipId };

    const [first, second] = await Promise.all([
      putState(accessToken, target, { description: "first", status: "active" }),
      putState(accessToken, target, { description: "second", status: "active" }),
    ]);

    expect([first.status, second.status]).toEqual([HttpStatus.OK, HttpStatus.OK]);
    expect(await readBookStates(accessToken, relationshipId)).toHaveLength(1);
  });

  it("R58 rejects both concurrent PUTs for a book that lacks one endpoint", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "A Wizard of Earthsea");
    const pair = await createPair(accessToken);
    await linkToBook(accessToken, bookId, [pair.alice]);
    const relationshipId = await createFriendship(accessToken, pair);
    const target = { bookId, relationshipId };

    const [first, second] = await Promise.all([
      putState(accessToken, target, { status: "active" }),
      putState(accessToken, target, { status: "active" }),
    ]);

    expect(first.status).toBe(HttpStatus.BAD_REQUEST);
    expect(second.status).toBe(HttpStatus.BAD_REQUEST);
    expect(await readBookStates(accessToken, relationshipId)).toEqual([]);
  });
});
