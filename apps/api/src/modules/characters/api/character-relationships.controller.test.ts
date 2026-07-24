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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
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

async function createRelationship(
  token: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return authed("post", "/api/character-relationships", token).send(body);
}

describe("character relationship CRUD", () => {
  it("creates a directed relationship and reads it back", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const mentor = await createCharacter(accessToken, "Dumbledore");
    const student = await createCharacter(accessToken, "Harry");

    const created = await createRelationship(accessToken, {
      category: "mentorship",
      directionality: "directed",
      sourceCharacterId: mentor,
      sourceLabel: "mentor",
      targetCharacterId: student,
      targetLabel: "student",
      type: "mentor_of",
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body.id).toMatch(UUID);
    expect(created.body).toMatchObject({
      category: "mentorship",
      directionality: "directed",
      sourceCharacterId: mentor,
      targetCharacterId: student,
      type: "mentor_of",
      typeHidden: false,
    });
    expect(created.body.diagnostics).toEqual([]);

    const read = await authed(
      "get",
      `/api/character-relationships/${created.body.id}`,
      accessToken,
    );
    expect(read.status).toBe(HttpStatus.OK);
    expect(read.body.type).toBe("mentor_of");
  });

  it("stores a symmetric relationship in canonical endpoint order", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");

    const created = await createRelationship(accessToken, {
      category: "family",
      directionality: "symmetric",
      sourceCharacterId: bob,
      targetCharacterId: alice,
      type: "spouse_of",
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    expect([created.body.sourceCharacterId, created.body.targetCharacterId]).toEqual(
      expect.arrayContaining([alice, bob]),
    );
    expect(created.body.sourceCharacterId <= created.body.targetCharacterId).toBe(true);
  });

  it("rejects a symmetric duplicate created in either endpoint order", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const base = { category: "family", directionality: "symmetric", type: "spouse_of" };

    const first = await createRelationship(accessToken, {
      ...base,
      sourceCharacterId: alice,
      targetCharacterId: bob,
    });
    expect(first.status).toBe(HttpStatus.CREATED);

    const sameOrder = await createRelationship(accessToken, {
      ...base,
      sourceCharacterId: alice,
      targetCharacterId: bob,
    });
    expect(sameOrder.status).toBe(HttpStatus.CONFLICT);
    expect(sameOrder.body.code).toBe("relationship_duplicate");

    const reversedOrder = await createRelationship(accessToken, {
      ...base,
      sourceCharacterId: bob,
      targetCharacterId: alice,
    });
    expect(reversedOrder.status).toBe(HttpStatus.CONFLICT);
    expect(reversedOrder.body.code).toBe("relationship_duplicate");
  });

  it("allows several relationship types between the same pair", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");

    const spouse = await createRelationship(accessToken, {
      category: "family",
      directionality: "symmetric",
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "spouse_of",
    });
    expect(spouse.status).toBe(HttpStatus.CREATED);

    const enemy = await createRelationship(accessToken, {
      category: "conflict",
      directionality: "symmetric",
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "enemy_of",
    });
    expect(enemy.status).toBe(HttpStatus.CREATED);
  });

  it("rejects a self relationship", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const alice = await createCharacter(accessToken, "Alice");

    const res = await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      sourceCharacterId: alice,
      targetCharacterId: alice,
      type: "friend_of",
    });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.code).toBe("relationship_self_reference");
  });

  it("rejects a directionality that mismatches the catalog", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");

    const res = await createRelationship(accessToken, {
      category: "family",
      directionality: "directed",
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "spouse_of",
    });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.code).toBe("relationship_direction_mismatch");
  });

  it("updates the semantic edge without wiping book states", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");

    const created = await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, description: "close allies", status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body.bookStates).toHaveLength(1);

    const patched = await authed(
      "patch",
      `/api/character-relationships/${created.body.id}`,
      accessToken,
    ).send({ category: "conflict", type: "enemy_of" });
    expect(patched.status).toBe(HttpStatus.OK);
    expect(patched.body.type).toBe("enemy_of");
    expect(patched.body.category).toBe("conflict");
    expect(patched.body.bookStates).toHaveLength(1);
    expect(patched.body.bookStates[0].description).toBe("close allies");
  });

  it("rejects a patch to a type that already exists between the same pair", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const shared = {
      category: "social",
      directionality: "symmetric",
      sourceCharacterId: alice,
      targetCharacterId: bob,
    };

    const friend = await createRelationship(accessToken, { ...shared, type: "friend_of" });
    expect(friend.status).toBe(HttpStatus.CREATED);
    const ally = await createRelationship(accessToken, { ...shared, type: "ally_of" });
    expect(ally.status).toBe(HttpStatus.CREATED);

    const collided = await authed(
      "patch",
      `/api/character-relationships/${ally.body.id}`,
      accessToken,
    ).send({ type: "friend_of" });
    expect(collided.status).toBe(HttpStatus.CONFLICT);
    expect(collided.body.code).toBe("relationship_duplicate");
  });

  it("re-canonicalizes endpoints when a directed edge becomes symmetric", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const first = await createCharacter(accessToken, "First");
    const second = await createCharacter(accessToken, "Second");
    const greater = first > second ? first : second;
    const smaller = first > second ? second : first;

    const directed = await createRelationship(accessToken, {
      category: "mentorship",
      directionality: "directed",
      sourceCharacterId: greater,
      targetCharacterId: smaller,
      type: "mentor_of",
    });
    expect(directed.status).toBe(HttpStatus.CREATED);

    const patched = await authed(
      "patch",
      `/api/character-relationships/${directed.body.id}`,
      accessToken,
    ).send({ category: "social", type: "friend_of" });
    expect(patched.status).toBe(HttpStatus.OK);
    expect(patched.body.directionality).toBe("symmetric");
    expect(patched.body.sourceCharacterId <= patched.body.targetCharacterId).toBe(true);

    const mirror = await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      sourceCharacterId: smaller,
      targetCharacterId: greater,
      type: "friend_of",
    });
    expect(mirror.status).toBe(HttpStatus.CONFLICT);
    expect(mirror.body.code).toBe("relationship_duplicate");
  });

  it("deletes a relationship and reports the removed book state count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const created = await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });

    const removed = await authed(
      "delete",
      `/api/character-relationships/${created.body.id}`,
      accessToken,
    );
    expect(removed.status).toBe(HttpStatus.OK);
    expect(removed.body).toEqual({ bookStateCount: 1, id: created.body.id });

    const read = await authed(
      "get",
      `/api/character-relationships/${created.body.id}`,
      accessToken,
    );
    expect(read.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("character relationship per-book state", () => {
  it("upserts and deletes a per-book state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const created = await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });
    const relationshipId = created.body.id;

    const upsert = await authed(
      "put",
      `/api/character-relationships/${relationshipId}/books/${bookId}`,
      accessToken,
    ).send({ description: "on speaking terms", intensity: "medium", status: "active" });
    expect(upsert.status).toBe(HttpStatus.OK);
    expect(upsert.body.bookStates).toHaveLength(1);
    expect(upsert.body.bookStates[0]).toMatchObject({
      description: "on speaking terms",
      intensity: "medium",
      status: "active",
    });

    const replace = await authed(
      "put",
      `/api/character-relationships/${relationshipId}/books/${bookId}`,
      accessToken,
    ).send({ description: "estranged", status: "ended" });
    expect(replace.status).toBe(HttpStatus.OK);
    expect(replace.body.bookStates).toHaveLength(1);
    expect(replace.body.bookStates[0].status).toBe("ended");

    const removed = await authed(
      "delete",
      `/api/character-relationships/${relationshipId}/books/${bookId}`,
      accessToken,
    );
    expect(removed.status).toBe(HttpStatus.NO_CONTENT);

    const removeAgain = await authed(
      "delete",
      `/api/character-relationships/${relationshipId}/books/${bookId}`,
      accessToken,
    );
    expect(removeAgain.status).toBe(HttpStatus.NOT_FOUND);
    expect(removeAgain.body.code).toBe("relationship_book_state_not_found");
  });
});

describe("character relationship family diagnostics", () => {
  it("hard-blocks a direct parent contradiction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");

    const first = await createRelationship(accessToken, {
      category: "family",
      directionality: "directed",
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "biological_parent_of",
    });
    expect(first.status).toBe(HttpStatus.CREATED);

    const contradiction = await createRelationship(accessToken, {
      category: "family",
      directionality: "directed",
      sourceCharacterId: bob,
      targetCharacterId: alice,
      type: "biological_parent_of",
    });
    expect(contradiction.status).toBe(HttpStatus.CONFLICT);
    expect(contradiction.body.code).toBe("family_cycle_detected");
  });

  it("warns on a deeper cycle and allows an explicit override", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    const parent = (source: string, target: string): Record<string, unknown> => ({
      category: "family",
      directionality: "directed",
      sourceCharacterId: source,
      targetCharacterId: target,
      type: "biological_parent_of",
    });

    expect((await createRelationship(accessToken, parent(alice, bob))).status).toBe(
      HttpStatus.CREATED,
    );
    expect((await createRelationship(accessToken, parent(bob, carol))).status).toBe(
      HttpStatus.CREATED,
    );

    const blocked = await createRelationship(accessToken, parent(carol, alice));
    expect(blocked.status).toBe(HttpStatus.CONFLICT);
    expect(blocked.body.code).toBe("family_cycle_detected");

    const overridden = await createRelationship(accessToken, {
      ...parent(carol, alice),
      allowFamilyCycle: true,
    });
    expect(overridden.status).toBe(HttpStatus.CREATED);
    expect(overridden.body.diagnostics).toHaveLength(1);
    expect(overridden.body.diagnostics[0]).toMatchObject({
      code: "family_cycle_detected",
      severity: "warning",
    });
  });
});

describe("character relationship ownership (IDOR)", () => {
  it("returns 404 for foreign relationships, characters and books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const alice = await createCharacter(owner.accessToken, "Alice");
    const bob = await createCharacter(owner.accessToken, "Bob");
    const created = await createRelationship(owner.accessToken, {
      category: "social",
      directionality: "symmetric",
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });
    const relationshipId = created.body.id;

    const foreignGet = await authed(
      "get",
      `/api/character-relationships/${relationshipId}`,
      intruder.accessToken,
    );
    expect(foreignGet.status).toBe(HttpStatus.NOT_FOUND);

    const foreignPatch = await authed(
      "patch",
      `/api/character-relationships/${relationshipId}`,
      intruder.accessToken,
    ).send({ isCanonical: true });
    expect(foreignPatch.status).toBe(HttpStatus.NOT_FOUND);

    const foreignDelete = await authed(
      "delete",
      `/api/character-relationships/${relationshipId}`,
      intruder.accessToken,
    );
    expect(foreignDelete.status).toBe(HttpStatus.NOT_FOUND);

    const foreignCharacter = await createCharacter(intruder.accessToken, "Mallory");
    const foreignEndpoint = await createRelationship(owner.accessToken, {
      category: "social",
      directionality: "symmetric",
      sourceCharacterId: alice,
      targetCharacterId: foreignCharacter,
      type: "friend_of",
    });
    expect(foreignEndpoint.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreignEndpoint.body.code).toBe("relationship_character_not_found");

    const foreignBookState = await createRelationship(owner.accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId: MISSING_ID, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "ally_of",
    });
    expect(foreignBookState.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreignBookState.body.code).toBe("relationship_book_not_found");
  });
});

describe("character relationship spoiler masking", () => {
  it("omits a relationship whose book state hides it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await createRelationship(accessToken, {
      category: "family",
      directionality: "directed",
      initialBookStates: [{ bookId, hideRelationshipAsSpoiler: true, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "biological_parent_of",
    });

    const list = await authed("get", `/api/books/${bookId}/character-relationships`, accessToken);
    expect(list.status).toBe(HttpStatus.OK);
    expect(list.body).toEqual([]);
  });

  it("omits a relationship introduced after the reader position, then reveals it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, introducedPage: 200, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });

    const before = await authed(
      "get",
      `/api/books/${bookId}/character-relationships?contextPage=3`,
      accessToken,
    );
    expect(before.status).toBe(HttpStatus.OK);
    expect(before.body).toEqual([]);

    const after = await authed(
      "get",
      `/api/books/${bookId}/character-relationships?contextPage=250`,
      accessToken,
    );
    expect(after.status).toBe(HttpStatus.OK);
    expect(after.body).toHaveLength(1);

    const bookLevel = await authed(
      "get",
      `/api/books/${bookId}/character-relationships`,
      accessToken,
    );
    expect(bookLevel.body).toHaveLength(1);
  });

  it("locks the type when the book state marks the type a spoiler", async () => {
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

    const list = await authed("get", `/api/books/${bookId}/character-relationships`, accessToken);
    expect(list.status).toBe(HttpStatus.OK);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].relationship).toMatchObject({
      category: null,
      type: null,
      typeHidden: true,
    });
    expect(JSON.stringify(list.body)).not.toContain("biological_parent_of");
  });

  it("replaces a spoiler description with a generic placeholder", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [
        {
          bookId,
          description: "they are secretly the same person",
          isDescriptionSpoiler: true,
          status: "active",
        },
      ],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });

    const list = await authed(
      "get",
      `/api/books/${bookId}/character-relationships?includeHistory=true`,
      accessToken,
    );
    expect(list.status).toBe(HttpStatus.OK);
    expect(list.body[0].effectiveState).toMatchObject({
      description: null,
      descriptionHidden: true,
    });
    expect(JSON.stringify(list.body)).not.toContain("secretly the same person");
  });

  it("returns the effective series state as of the context book, never a later one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstBook = await authed("post", "/api/books", accessToken).send({
      authors: [{ name: "George R. R. Martin" }],
      bookType: "series_part",
      newSeries: { name: "A Song of Ice and Fire" },
      ownershipStatus: "owned",
      partNumber: 1,
      title: "A Game of Thrones",
    });
    expect(firstBook.status).toBe(HttpStatus.CREATED);
    const seriesId = firstBook.body.series.id;
    const firstBookId = firstBook.body.id;

    const secondBook = await authed("post", "/api/books", accessToken).send({
      authors: [{ name: "George R. R. Martin" }],
      bookType: "series_part",
      ownershipStatus: "owned",
      partNumber: 2,
      seriesId,
      title: "A Clash of Kings",
    });
    expect(secondBook.status).toBe(HttpStatus.CREATED);
    const secondBookId = secondBook.body.id;

    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const created = await createRelationship(accessToken, {
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
    expect(created.status).toBe(HttpStatus.CREATED);

    const asFirst = await authed(
      "get",
      `/api/series/${seriesId}/character-relationships?contextBookId=${firstBookId}`,
      accessToken,
    );
    expect(asFirst.status).toBe(HttpStatus.OK);
    expect(asFirst.body).toHaveLength(1);
    expect(asFirst.body[0].effectiveState).toMatchObject({
      description: "allies",
      status: "active",
    });
    expect(JSON.stringify(asFirst.body)).not.toContain("enemies");

    const asSecond = await authed(
      "get",
      `/api/series/${seriesId}/character-relationships?contextBookId=${secondBookId}`,
      accessToken,
    );
    expect(asSecond.body[0].effectiveState).toMatchObject({
      description: "enemies",
      status: "ended",
    });
  });
});
