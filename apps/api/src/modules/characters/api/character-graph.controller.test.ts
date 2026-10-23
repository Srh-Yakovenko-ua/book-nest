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

async function createGroup({
  isSpoiler = false,
  members,
  name,
  token,
  type,
}: {
  isSpoiler?: boolean;
  members: { characterId: string }[];
  name: string;
  token: string;
  type: string;
}): Promise<string> {
  const res = await authed("post", "/api/character-groups", token).send({
    isSpoiler,
    members,
    name,
    type,
  });
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

async function linkToBook(token: string, bookId: string, characterIds: string[]): Promise<void> {
  for (const characterId of characterIds) {
    await linkCharacter({ bookId, bookProfile: {}, characterId, token });
  }
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

  it("keeps a node first met late in the book and every edge touching it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    await linkCharacter({
      bookId,
      bookProfile: { firstAppearancePage: 480, importance: "central" },
      characterId: bob,
      token: accessToken,
    });
    await linkToBook(accessToken, bookId, [alice, carol]);
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
      [alice, bob, carol].sort(),
    );
    expect(res.body.nodes.find((node: { id: string }) => node.id === alice).degree).toBe(2);
    expect(res.body.hiddenContent).toEqual({
      hasHiddenEdges: false,
      hasLockedEdges: false,
      truncated: false,
    });
    expect(res.body.edges).toHaveLength(2);
  });

  it("keeps an isTypeSpoiler edge but locks its type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await linkToBook(accessToken, bookId, [alice, bob]);
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
    expect(res.body.edges[0]).toMatchObject({
      category: null,
      directionality: null,
      type: null,
      typeHidden: true,
    });
    expect(res.body.hiddenContent.hasLockedEdges).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("biological_parent_of");
  });

  it("cannot traverse a hidden edge during a focus traversal and never advertises it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    await linkToBook(accessToken, bookId, [alice, bob, carol]);
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
    expect(res.body.hiddenContent.hasHiddenEdges).toBe(false);
  });

  it("un-masks only the named reveal edge", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    await linkToBook(accessToken, bookId, [alice, bob, carol]);
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

  it("clusters visible nodes by group and returns a legend", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await linkToBook(accessToken, bookId, [alice, bob]);
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });
    const groupId = await createGroup({
      members: [{ characterId: alice }, { characterId: bob }],
      name: "House Stark",
      token: accessToken,
      type: "house",
    });

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?clusterBy=group`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.clusterBy).toBe("group");
    expect(res.body.nodes.every((node: { clusterId: string }) => node.clusterId === groupId)).toBe(
      true,
    );
    expect(res.body.clusters).toEqual([
      { groupType: "house", id: groupId, kind: "group", name: "House Stark", size: 2 },
    ]);
  });

  it("forms no cluster from a spoiler group and never names it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    const dave = await createCharacter(accessToken, "Dave");
    await linkToBook(accessToken, bookId, [alice, bob, carol, dave]);
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
      sourceCharacterId: carol,
      targetCharacterId: dave,
      type: "friend_of",
    });
    const spoilerGroupId = await createGroup({
      isSpoiler: true,
      members: [{ characterId: alice }, { characterId: bob }],
      name: "The Faceless Men",
      token: accessToken,
      type: "cult",
    });
    const starkGroupId = await createGroup({
      members: [{ characterId: carol }, { characterId: dave }],
      name: "House Stark",
      token: accessToken,
      type: "house",
    });

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?clusterBy=group`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.clusters.map((cluster: { id: string }) => cluster.id)).toEqual([starkGroupId]);
    const spoilerClustered = res.body.nodes.filter(
      (node: { clusterId: null | string }) => node.clusterId === spoilerGroupId,
    );
    expect(spoilerClustered).toEqual([]);
    expect(res.body.nodes.find((node: { id: string }) => node.id === alice).clusterId).toBeNull();
    expect(res.body.nodes.find((node: { id: string }) => node.id === carol).clusterId).toBe(
      starkGroupId,
    );
    expect(JSON.stringify(res.body)).not.toContain("Faceless Men");
  });

  it("buckets clusterBy=importance by the effective importance", async () => {
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
      initialBookStates: [{ bookId, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?clusterBy=importance`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.clusterBy).toBe("importance");
    expect(res.body.nodes.find((node: { id: string }) => node.id === alice).clusterId).toBe(
      "central",
    );
    expect(res.body.nodes.find((node: { id: string }) => node.id === bob).clusterId).toBe("major");
    expect(res.body.clusters).toEqual([
      { id: "central", importance: "central", kind: "importance", size: 1 },
      { id: "major", importance: "major", kind: "importance", size: 1 },
    ]);
  });

  it("hides a not-yet-reached edge and its orphaned nodes from the graph without advertising it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await linkToBook(accessToken, bookId, [alice, bob]);
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, introducedPage: 200, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?contextPage=3`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.edges).toHaveLength(0);
    expect(res.body.nodes).toHaveLength(0);
    expect(res.body.hiddenContent.hasHiddenEdges).toBe(false);
  });

  it("reveals the edge and node degree once the reader page reaches it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await linkToBook(accessToken, bookId, [alice, bob]);
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, introducedPage: 200, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?contextPage=250`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.edges).toHaveLength(1);
    expect(res.body.nodes).toHaveLength(2);
    expect(res.body.nodes.every((node: { degree: number }) => node.degree === 1)).toBe(true);
  });

  it("hides an edge with an introduction marker when the reader position is unknown", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await linkToBook(accessToken, bookId, [alice, bob]);
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, introducedPage: 200, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });

    const withoutPosition = await authed(
      "get",
      `/api/books/${bookId}/character-graph`,
      accessToken,
    );
    expect(withoutPosition.status).toBe(HttpStatus.OK);
    expect(withoutPosition.body.edges).toEqual([]);
    expect(withoutPosition.body.hiddenContent.hasHiddenEdges).toBe(false);
  });

  it("returns 404 for a foreign book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const bookId = await createBook(owner.accessToken);

    const res = await authed("get", `/api/books/${bookId}/character-graph`, intruder.accessToken);
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("book character graph display fields", () => {
  it("returns every node with a display name and display media", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await linkCharacter({
      bookId,
      bookProfile: { displayName: "Lady Alice" },
      characterId: alice,
      token: accessToken,
    });
    await linkToBook(accessToken, bookId, [bob]);
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });

    const res = await authed("get", `/api/books/${bookId}/character-graph`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    const displayById = Object.fromEntries(
      res.body.nodes.map((node: { displayMedia: unknown; displayName: string; id: string }) => [
        node.id,
        { displayMedia: node.displayMedia, displayName: node.displayName },
      ]),
    );
    expect(displayById).toEqual({
      [alice]: { displayMedia: null, displayName: "Lady Alice" },
      [bob]: { displayMedia: null, displayName: "Bob" },
    });
  });

  it("falls back to the global name when the book display name is a spoiler", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const jon = await createCharacter(accessToken, "Jon");
    const sam = await createCharacter(accessToken, "Sam");
    await linkCharacter({
      bookId,
      bookProfile: { displayName: "Lord Snow", displayNameIsSpoiler: true },
      characterId: jon,
      token: accessToken,
    });
    await linkToBook(accessToken, bookId, [sam]);
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, status: "active" }],
      sourceCharacterId: jon,
      targetCharacterId: sam,
      type: "friend_of",
    });

    const res = await authed("get", `/api/books/${bookId}/character-graph`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.nodes.find((node: { id: string }) => node.id === jon).displayName).toBe("Jon");
    expect(JSON.stringify(res.body)).not.toContain("Lord Snow");
  });
});

describe("book character graph focus character", () => {
  const RELATIONSHIP_CHARACTER_NOT_FOUND = "relationship_character_not_found";

  async function seedBookWithLinkedPair(token: string): Promise<string> {
    const bookId = await createBook(token);
    const alice = await createCharacter(token, "Alice");
    const bob = await createCharacter(token, "Bob");
    await linkToBook(token, bookId, [alice, bob]);
    await createRelationship(token, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });
    return bookId;
  }

  it("returns 404 for an owned focus character that is not linked to the book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await seedBookWithLinkedPair(accessToken);
    const unlinked = await createCharacter(accessToken, "Dave");

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?focusCharacterId=${unlinked}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe(RELATIONSHIP_CHARACTER_NOT_FOUND);
  });

  it("returns the same 404 for a focus character owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const bookId = await seedBookWithLinkedPair(owner.accessToken);
    const intruderBookId = await createBook(intruder.accessToken);
    const foreign = await createCharacter(intruder.accessToken, "Eve");
    await linkToBook(intruder.accessToken, intruderBookId, [foreign]);

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?focusCharacterId=${foreign}`,
      owner.accessToken,
    );
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe(RELATIONSHIP_CHARACTER_NOT_FOUND);
  });

  it("returns only the focus node for a linked character without relationships", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await seedBookWithLinkedPair(accessToken);
    const loner = await createCharacter(accessToken, "Carol");
    await linkToBook(accessToken, bookId, [loner]);

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?focusCharacterId=${loner}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.nodes.map((node: { id: string }) => node.id)).toEqual([loner]);
    expect(res.body.nodes[0].degree).toBe(0);
    expect(res.body.edges).toEqual([]);
  });
});

describe("book family tree projection", () => {
  async function seedStarkFamily(token: string): Promise<{
    bookId: string;
    catelyn: string;
    ned: string;
    parentRelationshipId: string;
    rickard: string;
    spouseRelationshipId: string;
  }> {
    const bookId = await createBook(token);
    const rickard = await createCharacter(token, "Rickard");
    const ned = await createCharacter(token, "Ned");
    const catelyn = await createCharacter(token, "Catelyn");
    await linkToBook(token, bookId, [rickard, ned, catelyn]);
    const parentRelationshipId = await createRelationship(token, {
      category: "family",
      directionality: "directed",
      initialBookStates: [{ bookId, status: "active" }],
      sourceCharacterId: rickard,
      targetCharacterId: ned,
      type: "biological_parent_of",
    });
    const spouseRelationshipId = await createRelationship(token, {
      category: "family",
      directionality: "symmetric",
      initialBookStates: [{ bookId, status: "active" }],
      sourceCharacterId: ned,
      targetCharacterId: catelyn,
      type: "spouse_of",
    });
    return { bookId, catelyn, ned, parentRelationshipId, rickard, spouseRelationshipId };
  }

  it("returns the family_tree projection with two generations each way by default", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, ned } = await seedStarkFamily(accessToken);

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?projection=family_tree&focusCharacterId=${ned}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({
      ancestors: 2,
      descendants: 2,
      focusCharacterId: ned,
      projection: "family_tree",
    });
  });

  it("echoes the requested ancestor and descendant generations", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, ned } = await seedStarkFamily(accessToken);

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?projection=family_tree&focusCharacterId=${ned}&ancestors=1&descendants=3`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({ ancestors: 1, descendants: 3, projection: "family_tree" });
  });

  it("records a biological_parent_of relationship as lineage from parent to child", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, ned, parentRelationshipId, rickard } = await seedStarkFamily(accessToken);

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?projection=family_tree&focusCharacterId=${ned}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.lineage).toEqual([
      {
        childId: ned,
        kind: "biological",
        parentId: rickard,
        relationshipId: parentRelationshipId,
      },
    ]);
  });

  it("keeps a spouse_of relationship among the edges but out of the lineage", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, catelyn, ned, parentRelationshipId, spouseRelationshipId } =
      await seedStarkFamily(accessToken);

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?projection=family_tree&focusCharacterId=${ned}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.edges.map((edge: { id: string }) => edge.id).sort()).toEqual(
      [parentRelationshipId, spouseRelationshipId].sort(),
    );
    expect(
      res.body.lineage.map((link: { relationshipId: string }) => link.relationshipId),
    ).not.toContain(spouseRelationshipId);
    expect(res.body.nodes.map((node: { id: string }) => node.id)).toContain(catelyn);
  });

  it("rejects projection=family_tree without a focus character", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await seedStarkFamily(accessToken);

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?projection=family_tree`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "focusCharacterId" })]),
    );
  });

  it.each([
    ["mode=family", "projection"],
    ["categories=family", "projection"],
    ["clusterBy=group", "projection"],
    ["ancestors=0", "ancestors"],
    ["ancestors=4", "ancestors"],
  ])("rejects a family tree request combined with %s", async (extraQuery, field) => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, ned } = await seedStarkFamily(accessToken);

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?projection=family_tree&focusCharacterId=${ned}&${extraQuery}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
  });

  it("rejects ancestors without projection=family_tree", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, ned } = await seedStarkFamily(accessToken);

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?focusCharacterId=${ned}&ancestors=2`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "projection" })]),
    );
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
    await linkToBook(accessToken, firstBookId, [alice, bob]);
    await linkToBook(accessToken, secondBookId, [alice, bob]);
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

  it("returns every series node with a display name and display media", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBookId, seriesId } = await createSeriesWithTwoBooks(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await linkCharacter({
      bookId: firstBookId,
      bookProfile: { displayName: "Lady Alice" },
      characterId: alice,
      token: accessToken,
    });
    await linkToBook(accessToken, firstBookId, [bob]);
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId: firstBookId, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });

    const res = await authed(
      "get",
      `/api/series/${seriesId}/character-graph?contextBookId=${firstBookId}`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    const displayById = Object.fromEntries(
      res.body.nodes.map((node: { displayMedia: unknown; displayName: string; id: string }) => [
        node.id,
        { displayMedia: node.displayMedia, displayName: node.displayName },
      ]),
    );
    expect(displayById).toEqual({
      [alice]: { displayMedia: null, displayName: "Lady Alice" },
      [bob]: { displayMedia: null, displayName: "Bob" },
    });
  });

  it("keeps serving a series graph with the supported graph filters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBookId, seriesId } = await createSeriesWithTwoBooks(accessToken);
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await linkToBook(accessToken, firstBookId, [alice, bob]);
    const relationshipId = await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      initialBookStates: [{ bookId: firstBookId, status: "active" }],
      sourceCharacterId: alice,
      targetCharacterId: bob,
      type: "friend_of",
    });

    const res = await authed(
      "get",
      `/api/series/${seriesId}/character-graph?contextBookId=${firstBookId}&mode=all&depth=2&focusCharacterId=${alice}&categories=social&clusterBy=importance`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.clusterBy).toBe("importance");
    expect(res.body.edges.map((edge: { id: string }) => edge.id)).toEqual([relationshipId]);
  });

  it("rejects projection=family_tree on a series graph as an unknown query key", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { seriesId } = await createSeriesWithTwoBooks(accessToken);

    const res = await authed(
      "get",
      `/api/series/${seriesId}/character-graph?projection=family_tree`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(expect.any(Array));
    expect(res.body.errorsMessages.length).toBeGreaterThan(0);
  });
});
