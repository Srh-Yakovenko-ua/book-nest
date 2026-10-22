import type { INestApplication } from "@nestjs/common";

import { CHARACTER_ERROR_CODES } from "@app/shared";
import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";
import { CHARACTER_PURGE_QUEUE_NAME } from "../domain/character-purge.js";

const RELATIONSHIPS = "/api/character-relationships";

type Cast = { alice: string; bob: string; carol: string };

type CreatedRelationship = { id: string; stateIdByBook: Map<string, string> };

type EdgeInput = {
  category?: string;
  directionality?: string;
  isCanonical?: boolean;
  source: string;
  sourceLabel?: string;
  states: (Record<string, unknown> & { bookId: string })[];
  target: string;
  targetLabel?: string;
  type?: string;
};

type SurfaceStatuses = Record<string, null | string>;

const queueStub = {
  add: (): Promise<void> => Promise.resolve(),
  remove: (): Promise<void> => Promise.resolve(),
};

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule, CharactersModule],
    [{ provide: getQueueToken(CHARACTER_PURGE_QUEUE_NAME), useValue: queueStub }],
  );
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
    authors: [{ name: "Ursula K. Le Guin" }],
    ownershipStatus: "owned",
    pagesCount: 500,
    title: "The Left Hand of Darkness",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCast(token: string): Promise<Cast> {
  return {
    alice: await createCharacter(token, "Alice"),
    bob: await createCharacter(token, "Bob"),
    carol: await createCharacter(token, "Carol"),
  };
}

async function createCharacter(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character: { name } });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createEdge(token: string, edge: EdgeInput): Promise<CreatedRelationship> {
  for (const state of edge.states) {
    await ensureLinkedToBook(token, state.bookId, edge.source);
    await ensureLinkedToBook(token, state.bookId, edge.target);
  }
  const res = await authed("post", RELATIONSHIPS, token).send({
    category: edge.category ?? "social",
    directionality: edge.directionality ?? "symmetric",
    initialBookStates: edge.states.map((state) => ({ status: "active", ...state })),
    isCanonical: edge.isCanonical,
    sourceCharacterId: edge.source,
    sourceLabel: edge.sourceLabel,
    targetCharacterId: edge.target,
    targetLabel: edge.targetLabel,
    type: edge.type ?? "friend_of",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  const states: { bookId: string; id: string }[] = res.body.bookStates;
  return {
    id: res.body.id,
    stateIdByBook: new Map(states.map((state) => [state.bookId, state.id])),
  };
}

async function createSeries(
  token: string,
): Promise<{ firstBookId: string; secondBookId: string; seriesId: string }> {
  const first = await authed("post", "/api/books", token).send({
    authors: [{ name: "Ursula K. Le Guin" }],
    bookType: "series_part",
    newSeries: { name: "Earthsea" },
    ownershipStatus: "owned",
    partNumber: 1,
    title: "A Wizard of Earthsea",
  });
  expect(first.status).toBe(HttpStatus.CREATED);
  const seriesId: string = first.body.series.id;
  const second = await authed("post", "/api/books", token).send({
    authors: [{ name: "Ursula K. Le Guin" }],
    bookType: "series_part",
    ownershipStatus: "owned",
    partNumber: 2,
    seriesId,
    title: "The Tombs of Atuan",
  });
  expect(second.status).toBe(HttpStatus.CREATED);
  return { firstBookId: first.body.id, secondBookId: second.body.id, seriesId };
}

function edgeIds(body: { edges: { id: string }[] }): string[] {
  return body.edges.map((edge) => edge.id).sort();
}

async function ensureLinkedToBook(
  token: string,
  bookId: string,
  characterId: string,
): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: {},
    characterId,
    mode: "existing",
  });
  if (res.status === HttpStatus.CONFLICT) {
    expect(res.body.code).toBe(CHARACTER_ERROR_CODES.alreadyLinkedToBook);
    return;
  }
  expect(res.status).toBe(HttpStatus.CREATED);
}

function listIds(body: { relationship: { id: string } }[]): string[] {
  return body.map((item) => item.relationship.id).sort();
}

async function markFinished(token: string, bookId: string): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/reading-status`, token).send({
    date: "2026-01-01",
    status: "finished",
  });
  expect(res.status).toBe(HttpStatus.OK);
}

function stateIdOf(relationship: CreatedRelationship, bookId: string): string {
  const stateId = relationship.stateIdByBook.get(bookId);
  if (stateId === undefined) {
    throw new Error(`No book state was created for book ${bookId}`);
  }
  return stateId;
}

describe("owner isolation", () => {
  it("404s another owner's relationship details with or without a scope", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const { alice, bob } = await createCast(owner.accessToken);
    const bookId = await createBook(owner.accessToken);
    const intruderBookId = await createBook(intruder.accessToken);
    const relationship = await createEdge(owner.accessToken, {
      source: alice,
      states: [{ bookId }],
      target: bob,
    });

    const unscoped = await authed(
      "get",
      `${RELATIONSHIPS}/${relationship.id}`,
      intruder.accessToken,
    );
    const scoped = await authed(
      "get",
      `${RELATIONSHIPS}/${relationship.id}?scope=book&scopeId=${intruderBookId}`,
      intruder.accessToken,
    );

    expect(unscoped.status).toBe(HttpStatus.NOT_FOUND);
    expect(unscoped.body.code).toBe("relationship_not_found");
    expect(scoped.status).toBe(HttpStatus.NOT_FOUND);
    expect(scoped.body.code).toBe("relationship_not_found");
  });

  it("404s another owner's edit read", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const { alice, bob } = await createCast(owner.accessToken);
    const bookId = await createBook(owner.accessToken);
    const relationship = await createEdge(owner.accessToken, {
      source: alice,
      states: [{ bookId }],
      target: bob,
    });

    const res = await authed(
      "get",
      `${RELATIONSHIPS}/${relationship.id}/edit`,
      intruder.accessToken,
    );

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("relationship_not_found");
    expect(JSON.stringify(res.body)).not.toContain(alice);
  });

  it("404s a description reveal that targets another owner's book state", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const ownerCast = await createCast(owner.accessToken);
    const ownerBookId = await createBook(owner.accessToken);
    const ownerRelationship = await createEdge(owner.accessToken, {
      source: ownerCast.alice,
      states: [{ bookId: ownerBookId, description: "owner secret", isDescriptionSpoiler: true }],
      target: ownerCast.bob,
    });
    const intruderCast = await createCast(intruder.accessToken);
    const intruderBookId = await createBook(intruder.accessToken);
    const intruderRelationship = await createEdge(intruder.accessToken, {
      source: intruderCast.alice,
      states: [{ bookId: intruderBookId }],
      target: intruderCast.bob,
    });

    const res = await authed(
      "get",
      `${RELATIONSHIPS}/${intruderRelationship.id}?scope=book&scopeId=${intruderBookId}&revealDescriptionBookStateId=${stateIdOf(ownerRelationship, ownerBookId)}`,
      intruder.accessToken,
    );

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("relationship_book_state_not_found");
    expect(JSON.stringify(res.body)).not.toContain("owner secret");
  });

  it.each([
    {
      code: "relationship_book_not_found",
      name: "a book scope",
      query: (foreign: { bookId: string; characterId: string; seriesId: string }) =>
        `scope=book&scopeId=${foreign.bookId}`,
    },
    {
      code: "relationship_book_context_invalid",
      name: "a series scope",
      query: (foreign: { bookId: string; characterId: string; seriesId: string }) =>
        `scope=series&scopeId=${foreign.seriesId}`,
    },
    {
      code: "relationship_not_found",
      name: "a character scope",
      query: (foreign: { bookId: string; characterId: string; seriesId: string }) =>
        `scope=character&scopeId=${foreign.characterId}`,
    },
    {
      code: "relationship_book_not_found",
      name: "a context book",
      query: (foreign: { bookId: string; characterId: string; seriesId: string }) =>
        `contextBookId=${foreign.bookId}`,
    },
  ])("404s $name owned by another user", async ({ code, query }) => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const { alice, bob } = await createCast(owner.accessToken);
    const bookId = await createBook(owner.accessToken);
    const relationship = await createEdge(owner.accessToken, {
      source: alice,
      states: [{ bookId }],
      target: bob,
    });
    const foreignSeries = await createSeries(intruder.accessToken);
    const foreign = {
      bookId: await createBook(intruder.accessToken),
      characterId: await createCharacter(intruder.accessToken, "Mallory"),
      seriesId: foreignSeries.seriesId,
    };

    const res = await authed(
      "get",
      `${RELATIONSHIPS}/${relationship.id}?${query(foreign)}`,
      owner.accessToken,
    );

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe(code);
  });
});

describe("query validation", () => {
  type ValidationIds = { alice: string; bookId: string; seriesId: string; stateId: string };

  it.each([
    { name: "a scope without a scopeId", query: () => "scope=book" },
    {
      name: "a scopeId without a scope",
      query: (ids: ValidationIds) => `scopeId=${ids.bookId}`,
    },
    {
      name: "a book scope combined with a contextBookId",
      query: (ids: ValidationIds) => `scope=book&scopeId=${ids.bookId}&contextBookId=${ids.bookId}`,
    },
    { name: "a reading position without any book context", query: () => "contextPage=10" },
    {
      name: "a reading position in character scope without a contextBookId",
      query: (ids: ValidationIds) => `scope=character&scopeId=${ids.alice}&contextChapter=2`,
    },
    {
      name: "a reading position in series scope without a contextBookId",
      query: (ids: ValidationIds) => `scope=series&scopeId=${ids.seriesId}&contextAudioSeconds=60`,
    },
    {
      name: "a description reveal in the global scope",
      query: (ids: ValidationIds) => `revealDescriptionBookStateId=${ids.stateId}`,
    },
    {
      name: "a description reveal in character scope without a contextBookId",
      query: (ids: ValidationIds) =>
        `scope=character&scopeId=${ids.alice}&revealDescriptionBookStateId=${ids.stateId}`,
    },
    {
      name: "an unknown scope",
      query: (ids: ValidationIds) => `scope=world&scopeId=${ids.bookId}`,
    },
    { name: "a malformed scopeId", query: () => "scope=book&scopeId=not-a-uuid" },
    {
      name: "a malformed revealDescriptionBookStateId",
      query: (ids: ValidationIds) =>
        `scope=book&scopeId=${ids.bookId}&revealDescriptionBookStateId=not-a-uuid`,
    },
  ])("400s $name", async ({ query }) => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { alice, bob } = await createCast(accessToken);
    const { firstBookId: bookId, seriesId } = await createSeries(accessToken);
    const relationship = await createEdge(accessToken, {
      source: alice,
      states: [{ bookId, description: "visible text" }],
      target: bob,
    });
    const ids = { alice, bookId, seriesId, stateId: stateIdOf(relationship, bookId) };

    const res = await authed(
      "get",
      `${RELATIONSHIPS}/${relationship.id}?${query(ids)}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(expect.any(Array));
  });

  it("400s a malformed relationship id on the details and edit reads", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const detailsRes = await authed("get", `${RELATIONSHIPS}/not-a-uuid`, accessToken);
    const editRes = await authed("get", `${RELATIONSHIPS}/not-a-uuid/edit`, accessToken);

    expect(detailsRes.status).toBe(HttpStatus.BAD_REQUEST);
    expect(editRes.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("400s a path request without a contextBookId", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { alice, bob } = await createCast(accessToken);
    const bookId = await createBook(accessToken);
    await createEdge(accessToken, { source: alice, states: [{ bookId }], target: bob });

    const res = await authed(
      "get",
      `${RELATIONSHIPS}/path?fromId=${alice}&toId=${bob}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });
});

describe("fully hidden and not-yet-introduced edges", () => {
  const READER_PAGE = "contextPage=50";

  async function seedHiddenMix(token: string): Promise<{
    bookId: string;
    cast: Cast;
    hiddenIds: string[];
    seriesId: string;
    visibleId: string;
  }> {
    const cast = await createCast(token);
    const { firstBookId: bookId, seriesId } = await createSeries(token);
    const visible = await createEdge(token, {
      source: cast.alice,
      states: [{ bookId }],
      target: cast.bob,
    });
    const wholeHidden = await createEdge(token, {
      category: "family",
      source: cast.alice,
      states: [{ bookId, description: "hidden sibling", hideRelationshipAsSpoiler: true }],
      target: cast.carol,
      type: "sibling_of",
    });
    const notIntroduced = await createEdge(token, {
      category: "family",
      source: cast.bob,
      states: [{ bookId, description: "future marriage", introducedPage: 200 }],
      target: cast.carol,
      type: "spouse_of",
    });
    return {
      bookId,
      cast,
      hiddenIds: [wholeHidden.id, notIntroduced.id],
      seriesId,
      visibleId: visible.id,
    };
  }

  it("are absent from the legacy book list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedHiddenMix(accessToken);

    const res = await authed(
      "get",
      `/api/books/${seed.bookId}/character-relationships?includeHistory=true&${READER_PAGE}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(listIds(res.body)).toEqual([seed.visibleId]);
    expect(JSON.stringify(res.body)).not.toMatch(/hidden sibling|future marriage/);
  });

  it("are absent from the legacy series list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedHiddenMix(accessToken);

    const res = await authed(
      "get",
      `/api/series/${seed.seriesId}/character-relationships?includeHistory=true&contextBookId=${seed.bookId}&${READER_PAGE}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(listIds(res.body)).toEqual([seed.visibleId]);
    expect(JSON.stringify(res.body)).not.toMatch(/hidden sibling|future marriage/);
  });

  it.each([
    {
      name: "book",
      query: (seed: { bookId: string; seriesId: string }) =>
        `scope=book&scopeId=${seed.bookId}&${READER_PAGE}`,
    },
    {
      name: "series",
      query: (seed: { bookId: string; seriesId: string }) =>
        `scope=series&scopeId=${seed.seriesId}&contextBookId=${seed.bookId}&${READER_PAGE}`,
    },
  ])("404 on safe details in $name scope while the visible edge is served", async ({ query }) => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedHiddenMix(accessToken);

    const [wholeHiddenId, notIntroducedId] = seed.hiddenIds;
    const visible = await authed(
      "get",
      `${RELATIONSHIPS}/${seed.visibleId}?${query(seed)}`,
      accessToken,
    );
    const wholeHidden = await authed(
      "get",
      `${RELATIONSHIPS}/${wholeHiddenId}?${query(seed)}`,
      accessToken,
    );
    const notIntroduced = await authed(
      "get",
      `${RELATIONSHIPS}/${notIntroducedId}?${query(seed)}`,
      accessToken,
    );

    expect(visible.status).toBe(HttpStatus.OK);
    expect(wholeHidden.status).toBe(HttpStatus.NOT_FOUND);
    expect(wholeHidden.body.code).toBe("relationship_not_found");
    expect(notIntroduced.status).toBe(HttpStatus.NOT_FOUND);
    expect(notIntroduced.body.code).toBe("relationship_not_found");
  });

  it("are excluded from the book and series graph without a hidden-edge hint", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedHiddenMix(accessToken);

    const bookGraph = await authed(
      "get",
      `/api/books/${seed.bookId}/character-graph?${READER_PAGE}`,
      accessToken,
    );
    const seriesGraph = await authed(
      "get",
      `/api/series/${seed.seriesId}/character-graph?contextBookId=${seed.bookId}&${READER_PAGE}`,
      accessToken,
    );

    for (const graph of [bookGraph, seriesGraph]) {
      expect(graph.status).toBe(HttpStatus.OK);
      expect(edgeIds(graph.body)).toEqual([seed.visibleId]);
      expect(graph.body.hiddenContent.hasHiddenEdges).toBe(false);
      expect(JSON.stringify(graph.body)).not.toMatch(/hidden sibling|future marriage/);
    }
  });

  it("never satisfy a graph category filter or raise a hint flag", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedHiddenMix(accessToken);

    const res = await authed(
      "get",
      `/api/books/${seed.bookId}/character-graph?categories=family&${READER_PAGE}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.edges).toEqual([]);
    expect(res.body.hiddenContent).toEqual({
      hasHiddenEdges: false,
      hasLockedEdges: false,
      truncated: false,
    });
  });

  it("never carry a relationship path", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedHiddenMix(accessToken);
    const pathQuery = `contextBookId=${seed.bookId}&${READER_PAGE}`;

    const blocked = await authed(
      "get",
      `${RELATIONSHIPS}/path?fromId=${seed.cast.alice}&toId=${seed.cast.carol}&${pathQuery}`,
      accessToken,
    );
    const open = await authed(
      "get",
      `${RELATIONSHIPS}/path?fromId=${seed.cast.alice}&toId=${seed.cast.bob}&${pathQuery}`,
      accessToken,
    );

    expect(blocked.status).toBe(HttpStatus.OK);
    expect(blocked.body).toEqual({
      edges: [],
      found: false,
      fromId: seed.cast.alice,
      nodes: [],
      toId: seed.cast.carol,
    });
    expect(open.body.edges.map((edge: { id: string }) => edge.id)).toEqual([seed.visibleId]);
  });
});

describe("type-hidden edges", () => {
  const MASKED_EDGE = {
    category: null,
    customType: null,
    directionality: null,
    isCanonical: null,
    sourceLabel: null,
    targetLabel: null,
    type: null,
    typeHidden: true,
  };

  async function seedTypeHidden(
    token: string,
  ): Promise<{ bookId: string; relationshipId: string }> {
    const cast = await createCast(token);
    const bookId = await createBook(token);
    const relationship = await createEdge(token, {
      category: "family",
      directionality: "directed",
      isCanonical: true,
      source: cast.alice,
      sourceLabel: "hidden father",
      states: [{ bookId, intensity: "high", isTypeSpoiler: true }],
      target: cast.bob,
      targetLabel: "hidden son",
      type: "biological_parent_of",
    });
    return { bookId, relationshipId: relationship.id };
  }

  it("appears unlabeled in the legacy book list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedTypeHidden(accessToken);

    const res = await authed(
      "get",
      `/api/books/${seed.bookId}/character-relationships`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(listIds(res.body)).toEqual([seed.relationshipId]);
    expect(res.body[0].relationship).toMatchObject(MASKED_EDGE);
    expect(res.body[0].effectiveState.intensity).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/biological_parent_of|hidden father|hidden son/);
  });

  it("appears unlabeled in safe details", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedTypeHidden(accessToken);

    const res = await authed(
      "get",
      `${RELATIONSHIPS}/${seed.relationshipId}?scope=book&scopeId=${seed.bookId}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.relationship).toMatchObject(MASKED_EDGE);
    expect(res.body.effectiveState.intensity).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/biological_parent_of|hidden father|hidden son/);
  });

  it("appears unlabeled in the graph as a locked edge", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedTypeHidden(accessToken);

    const res = await authed("get", `/api/books/${seed.bookId}/character-graph`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.edges).toEqual([
      expect.objectContaining({
        category: null,
        directionality: null,
        id: seed.relationshipId,
        intensity: null,
        sourceLabel: null,
        targetLabel: null,
        type: null,
        typeHidden: true,
      }),
    ]);
    expect(res.body.hiddenContent.hasLockedEdges).toBe(true);
  });

  it.each([
    { filter: "categories=family", name: "category" },
    { filter: "relationshipTypes=biological_parent_of", name: "type" },
  ])("is not matched by a graph $name filter on its hidden value", async ({ filter }) => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedTypeHidden(accessToken);

    const res = await authed(
      "get",
      `/api/books/${seed.bookId}/character-graph?${filter}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.edges).toEqual([]);
  });
});

describe("independent reveal", () => {
  it("revealType un-masks the type and intensity but never the description", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const cast = await createCast(accessToken);
    const bookId = await createBook(accessToken);
    const relationship = await createEdge(accessToken, {
      category: "family",
      directionality: "directed",
      isCanonical: true,
      source: cast.alice,
      sourceLabel: "father",
      states: [
        {
          bookId,
          description: "the twist",
          intensity: "high",
          isDescriptionSpoiler: true,
          isTypeSpoiler: true,
        },
      ],
      target: cast.bob,
      targetLabel: "son",
      type: "biological_parent_of",
    });

    const res = await authed(
      "get",
      `${RELATIONSHIPS}/${relationship.id}?scope=book&scopeId=${bookId}&revealType=true`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.relationship).toMatchObject({
      category: "family",
      directionality: "directed",
      isCanonical: true,
      sourceLabel: "father",
      targetLabel: "son",
      type: "biological_parent_of",
      typeHidden: false,
    });
    expect(res.body.effectiveState).toMatchObject({
      description: null,
      descriptionHidden: true,
      intensity: "high",
    });
    expect(JSON.stringify(res.body)).not.toContain("the twist");
  });

  it("a description reveal un-masks only that book state and leaves the type masked", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const cast = await createCast(accessToken);
    const { firstBookId, secondBookId, seriesId } = await createSeries(accessToken);
    const relationship = await createEdge(accessToken, {
      source: cast.alice,
      states: [
        { bookId: firstBookId, description: "first twist", isDescriptionSpoiler: true },
        {
          bookId: secondBookId,
          description: "second twist",
          isDescriptionSpoiler: true,
          isTypeSpoiler: true,
        },
      ],
      target: cast.bob,
    });

    const res = await authed(
      "get",
      `${RELATIONSHIPS}/${relationship.id}?scope=series&scopeId=${seriesId}&contextBookId=${secondBookId}&revealDescriptionBookStateId=${stateIdOf(relationship, firstBookId)}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.history).toEqual([
      expect.objectContaining({
        bookId: firstBookId,
        description: "first twist",
        descriptionHidden: false,
      }),
      expect.objectContaining({ bookId: secondBookId, description: null, descriptionHidden: true }),
    ]);
    expect(res.body.relationship).toMatchObject({ type: null, typeHidden: true });
    expect(JSON.stringify(res.body)).not.toContain("second twist");
  });

  it("cannot surface a whole-hidden edge", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const cast = await createCast(accessToken);
    const bookId = await createBook(accessToken);
    const relationship = await createEdge(accessToken, {
      source: cast.alice,
      states: [
        {
          bookId,
          description: "buried truth",
          hideRelationshipAsSpoiler: true,
          isDescriptionSpoiler: true,
          isTypeSpoiler: true,
        },
      ],
      target: cast.bob,
    });

    const res = await authed(
      "get",
      `${RELATIONSHIPS}/${relationship.id}?scope=book&scopeId=${bookId}&revealType=true&revealDescriptionBookStateId=${stateIdOf(relationship, bookId)}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("relationship_not_found");
    expect(JSON.stringify(res.body)).not.toContain("buried truth");
  });

  it("cannot surface an edge whose introduction is still ahead of the reader", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const cast = await createCast(accessToken);
    const bookId = await createBook(accessToken);
    const relationship = await createEdge(accessToken, {
      source: cast.alice,
      states: [
        {
          bookId,
          description: "early reveal",
          introducedPage: 200,
          isDescriptionSpoiler: true,
          isTypeSpoiler: true,
        },
      ],
      target: cast.bob,
    });

    const res = await authed(
      "get",
      `${RELATIONSHIPS}/${relationship.id}?scope=book&scopeId=${bookId}&contextPage=50&revealType=true&revealDescriptionBookStateId=${stateIdOf(relationship, bookId)}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("relationship_not_found");
  });

  it("cannot reveal the description of a future book's state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const cast = await createCast(accessToken);
    const { firstBookId, secondBookId, seriesId } = await createSeries(accessToken);
    const relationship = await createEdge(accessToken, {
      source: cast.alice,
      states: [
        { bookId: firstBookId },
        { bookId: secondBookId, description: "future twist", isDescriptionSpoiler: true },
      ],
      target: cast.bob,
    });

    const res = await authed(
      "get",
      `${RELATIONSHIPS}/${relationship.id}?scope=series&scopeId=${seriesId}&contextBookId=${firstBookId}&revealDescriptionBookStateId=${stateIdOf(relationship, secondBookId)}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("relationship_book_state_not_found");
    expect(JSON.stringify(res.body)).not.toContain("future twist");
  });
});

describe("reading position agreement across reader surfaces", () => {
  async function seedPositionEdges(
    token: string,
    bookOverrides: Record<string, unknown> = {},
  ): Promise<{ bookId: string; endingId: string; introducedId: string }> {
    const cast = await createCast(token);
    const bookId = await createBook(token, bookOverrides);
    const introduced = await createEdge(token, {
      source: cast.alice,
      states: [{ bookId, endedPage: 300, introducedPage: 100, status: "ended" }],
      target: cast.bob,
    });
    const ending = await createEdge(token, {
      source: cast.alice,
      states: [{ bookId, endedPage: 300, status: "ended" }],
      target: cast.carol,
      type: "ally_of",
    });
    return { bookId, endingId: ending.id, introducedId: introduced.id };
  }

  function withParams(path: string, params: string[]): string {
    return params.length === 0 ? path : `${path}?${params.join("&")}`;
  }

  async function readSurfaces({
    position,
    seed,
    token,
  }: {
    position: string[];
    seed: { bookId: string; endingId: string; introducedId: string };
    token: string;
  }): Promise<{ details: SurfaceStatuses; graph: SurfaceStatuses; list: SurfaceStatuses }> {
    const list = await authed(
      "get",
      withParams(`/api/books/${seed.bookId}/character-relationships`, position),
      token,
    );
    const graph = await authed(
      "get",
      withParams(`/api/books/${seed.bookId}/character-graph`, position),
      token,
    );
    expect(list.status).toBe(HttpStatus.OK);
    expect(graph.status).toBe(HttpStatus.OK);
    const details: SurfaceStatuses = {};
    for (const id of [seed.introducedId, seed.endingId]) {
      const res = await authed(
        "get",
        withParams(`${RELATIONSHIPS}/${id}`, [`scope=book`, `scopeId=${seed.bookId}`, ...position]),
        token,
      );
      if (res.status === HttpStatus.OK) {
        details[id] = res.body.effectiveState.status;
      }
    }
    const listItems: { effectiveState: { status: null | string }; relationship: { id: string } }[] =
      list.body;
    const graphEdges: { id: string; status: null | string }[] = graph.body.edges;
    return {
      details,
      graph: Object.fromEntries(graphEdges.map((edge) => [edge.id, edge.status])),
      list: Object.fromEntries(
        listItems.map((item) => [item.relationship.id, item.effectiveState.status]),
      ),
    };
  }

  function onEverySurface(statuses: SurfaceStatuses): {
    details: SurfaceStatuses;
    graph: SurfaceStatuses;
    list: SurfaceStatuses;
  } {
    return { details: statuses, graph: statuses, list: statuses };
  }

  it("unknown progress hides a marked introduction and defers the end state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedPositionEdges(accessToken);

    const surfaces = await readSurfaces({ position: [], seed, token: accessToken });

    expect(surfaces).toEqual(onEverySurface({ [seed.endingId]: null }));
  });

  it("unknown progress nulls the end markers of a visible state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedPositionEdges(accessToken);

    const details = await authed(
      "get",
      `${RELATIONSHIPS}/${seed.endingId}?scope=book&scopeId=${seed.bookId}`,
      accessToken,
    );
    const list = await authed(
      "get",
      `/api/books/${seed.bookId}/character-relationships`,
      accessToken,
    );

    expect(details.body.effectiveState).toMatchObject({ endedPage: null, status: null });
    expect(list.body[0].effectiveState).toMatchObject({ endedPage: null, status: null });
  });

  it("an explicit mid-book position shows the introduction and still defers the end state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedPositionEdges(accessToken);

    const surfaces = await readSurfaces({
      position: ["contextPage=150"],
      seed,
      token: accessToken,
    });

    expect(surfaces).toEqual(onEverySurface({ [seed.endingId]: null, [seed.introducedId]: null }));
  });

  it("a persisted current page behaves exactly like the same explicit position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedPositionEdges(accessToken, {
      readingProgress: { currentPage: 150 },
      readingStatus: "reading",
    });

    const surfaces = await readSurfaces({ position: [], seed, token: accessToken });

    expect(surfaces).toEqual(onEverySurface({ [seed.endingId]: null, [seed.introducedId]: null }));
  });

  it("an explicit position at the end shows the ended state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedPositionEdges(accessToken);

    const surfaces = await readSurfaces({
      position: ["contextPage=300"],
      seed,
      token: accessToken,
    });

    expect(surfaces).toEqual(
      onEverySurface({ [seed.endingId]: "ended", [seed.introducedId]: "ended" }),
    );
  });

  it("a persisted finished book behaves like a reader who reached the end", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedPositionEdges(accessToken);
    await markFinished(accessToken, seed.bookId);

    const surfaces = await readSurfaces({ position: [], seed, token: accessToken });

    expect(surfaces).toEqual(
      onEverySurface({ [seed.endingId]: "ended", [seed.introducedId]: "ended" }),
    );
  });

  it("an explicit position overrides persisted progress", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedPositionEdges(accessToken);
    await markFinished(accessToken, seed.bookId);

    const surfaces = await readSurfaces({ position: ["contextPage=50"], seed, token: accessToken });

    expect(surfaces).toEqual(onEverySurface({ [seed.endingId]: null }));
  });
});

describe("series default reading context", () => {
  async function seedSeriesTimeline(token: string): Promise<{
    continuingId: string;
    firstBookId: string;
    laterId: string;
    secondBookId: string;
    seriesId: string;
  }> {
    const cast = await createCast(token);
    const { firstBookId, secondBookId, seriesId } = await createSeries(token);
    const continuing = await createEdge(token, {
      source: cast.alice,
      states: [
        { bookId: firstBookId, description: "allies" },
        { bookId: secondBookId, description: "enemies", status: "ended" },
      ],
      target: cast.bob,
    });
    const later = await createEdge(token, {
      source: cast.alice,
      states: [{ bookId: secondBookId, description: "rivals" }],
      target: cast.carol,
      type: "ally_of",
    });
    return { continuingId: continuing.id, firstBookId, laterId: later.id, secondBookId, seriesId };
  }

  it("keeps the legacy series list to the first part when nothing is finished", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedSeriesTimeline(accessToken);

    const res = await authed(
      "get",
      `/api/series/${seed.seriesId}/character-relationships?includeHistory=true`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(listIds(res.body)).toEqual([seed.continuingId]);
    expect(res.body[0].effectiveState).toMatchObject({
      bookId: seed.firstBookId,
      description: "allies",
    });
    expect(JSON.stringify(res.body)).not.toMatch(/enemies|rivals/);
  });

  it("keeps the series graph to the first part when nothing is finished", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedSeriesTimeline(accessToken);

    const res = await authed("get", `/api/series/${seed.seriesId}/character-graph`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(edgeIds(res.body)).toEqual([seed.continuingId]);
    expect(res.body.edges[0].status).toBe("active");
    expect(JSON.stringify(res.body)).not.toMatch(/enemies|rivals/);
  });

  it("keeps series-scoped details to the first part when nothing is finished", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedSeriesTimeline(accessToken);

    const continuing = await authed(
      "get",
      `${RELATIONSHIPS}/${seed.continuingId}?scope=series&scopeId=${seed.seriesId}`,
      accessToken,
    );
    const later = await authed(
      "get",
      `${RELATIONSHIPS}/${seed.laterId}?scope=series&scopeId=${seed.seriesId}`,
      accessToken,
    );

    expect(continuing.status).toBe(HttpStatus.OK);
    expect(continuing.body.effectiveState.bookId).toBe(seed.firstBookId);
    expect(continuing.body.history.map((state: { bookId: string }) => state.bookId)).toEqual([
      seed.firstBookId,
    ]);
    expect(later.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("follows the reading-context default forward once a later part is finished", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedSeriesTimeline(accessToken);
    await markFinished(accessToken, seed.secondBookId);

    const defaultContext = await authed(
      "get",
      `/api/series/${seed.seriesId}/reading-context/default`,
      accessToken,
    );
    const res = await authed(
      "get",
      `/api/series/${seed.seriesId}/character-relationships`,
      accessToken,
    );

    expect(defaultContext.body.contextBookId).toBe(seed.secondBookId);
    expect(listIds(res.body)).toEqual([seed.continuingId, seed.laterId].sort());
    const continuing = res.body.find(
      (item: { relationship: { id: string } }) => item.relationship.id === seed.continuingId,
    );
    expect(continuing.effectiveState).toMatchObject({
      bookId: seed.secondBookId,
      description: "enemies",
      status: "ended",
    });
  });
});

describe("trashed participants", () => {
  it("drop the edge from safe details, the legacy list and the graph", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const cast = await createCast(accessToken);
    const bookId = await createBook(accessToken);
    const kept = await createEdge(accessToken, {
      source: cast.alice,
      states: [{ bookId }],
      target: cast.bob,
    });
    const orphaned = await createEdge(accessToken, {
      source: cast.alice,
      states: [{ bookId }],
      target: cast.carol,
      type: "ally_of",
    });
    const trashed = await authed(
      "delete",
      `/api/characters/${cast.carol}?confirm=true`,
      accessToken,
    );
    expect(trashed.status).toBe(HttpStatus.OK);

    const details = await authed(
      "get",
      `${RELATIONSHIPS}/${orphaned.id}?scope=book&scopeId=${bookId}`,
      accessToken,
    );
    const list = await authed("get", `/api/books/${bookId}/character-relationships`, accessToken);
    const graph = await authed("get", `/api/books/${bookId}/character-graph`, accessToken);

    expect(details.status).toBe(HttpStatus.NOT_FOUND);
    expect(listIds(list.body)).toEqual([kept.id]);
    expect(edgeIds(graph.body)).toEqual([kept.id]);
  });
});
