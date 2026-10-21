import type {
  CharacterRelationshipListItemView,
  CharacterRelationshipSafeDetailsView,
  PaginatedCharacterRelationshipListView,
  RelationshipCategory,
  RelationshipDirectionality,
  UpsertRelationshipBookState,
} from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import {
  CHARACTER_ERROR_CODES,
  CharacterRelationshipSafeDetailsViewSchema,
  PaginatedCharacterRelationshipListViewSchema,
  SeriesReadingContextDefaultViewSchema,
} from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { SeriesModule } from "../../series/series.module.js";
import { CharactersModule } from "../characters.module.js";

const LIST_PATH = "/api/character-relationships";
const MISSING_ID = "99999999-9999-4999-8999-999999999999";
const FINISHED_AT = "2026-02-05";

const CATALOG = {
  acquaintance_of: { category: "social", directionality: "symmetric" },
  ally_of: { category: "social", directionality: "symmetric" },
  companion_of: { category: "social", directionality: "symmetric" },
  enemy_of: { category: "conflict", directionality: "symmetric" },
  engaged_to: { category: "romantic", directionality: "symmetric" },
  friend_of: { category: "social", directionality: "symmetric" },
  mentor_of: { category: "mentorship", directionality: "directed" },
  partner_of: { category: "romantic", directionality: "symmetric" },
  rival_of: { category: "conflict", directionality: "symmetric" },
} as const satisfies Record<
  string,
  { category: RelationshipCategory; directionality: RelationshipDirectionality }
>;

type BookSeed = {
  partNumber?: number;
  progress?: ReaderProgress;
  series?: { id: string } | { name: string };
  title: string;
};

type CatalogType = keyof typeof CATALOG;

type CreatedBook = { id: string; seriesId: string };

type EdgeSeed = {
  custom?: { customType: string; directionality: RelationshipDirectionality };
  isCanonical?: boolean;
  source: string;
  sourceLabel?: string;
  states?: StateSeed[];
  target: string;
  targetLabel?: string;
  type?: CatalogType;
};

type ListQuery = Record<string, boolean | number | string>;

type ReaderProgress = { finished: true } | { page: number };

type StateSeed = StateSeedBody & { bookId: string };

type StateSeedBody = Partial<UpsertRelationshipBookState>;

type Trilogy = { part1: string; part2: string; part3: string; seriesId: string };

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, SeriesModule, CharactersModule]);
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

function bookScope(bookId: string, extra: ListQuery = {}): ListQuery {
  return { scope: "book", scopeId: bookId, ...extra };
}

function characterScope(characterId: string, extra: ListQuery = {}): ListQuery {
  return { scope: "character", scopeId: characterId, ...extra };
}

async function createBook(token: string, seed: BookSeed): Promise<CreatedBook> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Ursula K. Le Guin" }],
    ownershipStatus: "owned",
    pagesCount: 500,
    title: seed.title,
    ...seriesFields(seed),
    ...progressFields(seed.progress),
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return { id: res.body.id, seriesId: res.body.series?.id ?? "" };
}

async function createCast<const Names extends readonly string[]>(
  token: string,
  names: Names,
): Promise<{ [Index in keyof Names]: string }> {
  const ids: string[] = [];
  for (const name of names) {
    ids.push(await createCharacter(token, name));
  }
  return ids as { [Index in keyof Names]: string };
}

async function createCharacter(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character: { name } });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createEdge(token: string, seed: EdgeSeed): Promise<string> {
  for (const state of seed.states ?? []) {
    await ensureLinkedToBook(token, state.bookId, [seed.source, seed.target]);
  }
  const res = await authed("post", LIST_PATH, token).send({
    ...edgeSemantics(seed),
    initialBookStates: seed.states ?? [],
    isCanonical: seed.isCanonical,
    sourceCharacterId: seed.source,
    sourceLabel: seed.sourceLabel,
    targetCharacterId: seed.target,
    targetLabel: seed.targetLabel,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createStandaloneBook(
  token: string,
  title: string,
  progress?: ReaderProgress,
): Promise<string> {
  const book = await createBook(token, { progress, title });
  return book.id;
}

function edgeSemantics(seed: EdgeSeed): Record<string, unknown> {
  if (seed.custom !== undefined) {
    return {
      category: "custom",
      customType: seed.custom.customType,
      directionality: seed.custom.directionality,
      type: "custom",
    };
  }
  const type = seed.type ?? "friend_of";
  return { ...CATALOG[type], type };
}

async function ensureLinkedToBook(
  token: string,
  bookId: string,
  characterIds: string[],
): Promise<void> {
  for (const characterId of characterIds) {
    const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
      bookProfile: {},
      characterId,
      mode: "existing",
    });
    if (res.status === HttpStatus.CONFLICT) {
      expect(res.body.code).toBe(CHARACTER_ERROR_CODES.alreadyLinkedToBook);
      continue;
    }
    expect(res.status).toBe(HttpStatus.CREATED);
  }
}

function idsOf(items: CharacterRelationshipListItemView[]): string[] {
  return items.map((item) => item.relationship.id);
}

function includesErrorOn(field: string): unknown {
  return expect.arrayContaining([expect.objectContaining({ field, message: expect.any(String) })]);
}

function itemOf(
  page: PaginatedCharacterRelationshipListView,
  relationshipId: string,
): CharacterRelationshipListItemView {
  const item = page.items.find((candidate) => candidate.relationship.id === relationshipId);
  if (item === undefined) {
    throw new Error(`relationship ${relationshipId} is not on the page`);
  }
  return item;
}

async function listIds(token: string, query: ListQuery): Promise<string[]> {
  const page = await listPage(token, query);
  return idsOf(page.items);
}

async function listPage(
  token: string,
  query: ListQuery,
): Promise<PaginatedCharacterRelationshipListView> {
  const res = await listRequest(token, query);
  expect(res.status).toBe(HttpStatus.OK);
  return PaginatedCharacterRelationshipListViewSchema.parse(res.body);
}

function listRequest(token: string, query: ListQuery): request.Test {
  return authed("get", LIST_PATH, token).query(query);
}

function progressFields(progress: ReaderProgress | undefined): Record<string, unknown> {
  if (progress === undefined) {
    return {};
  }
  if ("finished" in progress) {
    return { readingProgress: { finishedAt: FINISHED_AT }, readingStatus: "finished" };
  }
  return { readingProgress: { currentPage: progress.page }, readingStatus: "reading" };
}

async function putState(
  token: string,
  {
    bookId,
    relationshipId,
    state,
  }: { bookId: string; relationshipId: string; state: StateSeedBody },
): Promise<void> {
  const res = await authed("put", `${LIST_PATH}/${relationshipId}/books/${bookId}`, token).send(
    state,
  );
  expect(res.status).toBe(HttpStatus.OK);
}

async function readDetails(
  token: string,
  relationshipId: string,
  query: ListQuery,
): Promise<CharacterRelationshipSafeDetailsView> {
  const res = await authed("get", `${LIST_PATH}/${relationshipId}`, token).query(query);
  expect(res.status).toBe(HttpStatus.OK);
  return CharacterRelationshipSafeDetailsViewSchema.parse(res.body);
}

async function seedTrilogy(
  token: string,
  progress: { part1?: ReaderProgress; part2?: ReaderProgress; part3?: ReaderProgress } = {},
): Promise<Trilogy> {
  const first = await createBook(token, {
    partNumber: 1,
    progress: progress.part1,
    series: { name: "Earthsea" },
    title: "Earthsea One",
  });
  const second = await createBook(token, {
    partNumber: 2,
    progress: progress.part2,
    series: { id: first.seriesId },
    title: "Earthsea Two",
  });
  const third = await createBook(token, {
    partNumber: 3,
    progress: progress.part3,
    series: { id: first.seriesId },
    title: "Earthsea Three",
  });
  return { part1: first.id, part2: second.id, part3: third.id, seriesId: first.seriesId };
}

function seriesFields(seed: BookSeed): Record<string, unknown> {
  if (seed.series === undefined) {
    return {};
  }
  const membership =
    "id" in seed.series ? { seriesId: seed.series.id } : { newSeries: { name: seed.series.name } };
  return { ...membership, bookType: "series_part", partNumber: seed.partNumber };
}

function seriesScope(seriesId: string, extra: ListQuery = {}): ListQuery {
  return { scope: "series", scopeId: seriesId, ...extra };
}

function sorted(values: string[]): string[] {
  return [...values].sort();
}

describe("GET /api/character-relationships query validation", () => {
  it("rejects a request without a scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, { scopeId: MISSING_ID });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("scope"));
  });

  it("rejects a request without a scopeId", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, { scope: "book" });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("scopeId"));
  });

  it("rejects a scopeId that is not a UUID", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, bookScope("not-a-uuid"));
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("scopeId"));
  });

  it("rejects an unknown scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, { scope: "library", scopeId: MISSING_ID });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("scope"));
  });

  it("rejects a contextBookId on the book scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(
      accessToken,
      bookScope(MISSING_ID, { contextBookId: MISSING_ID }),
    );
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("contextBookId"));
  });

  it("rejects a bookId on the book scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, bookScope(MISSING_ID, { bookId: MISSING_ID }));
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("bookId"));
  });

  it("rejects a bookId on the series scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, seriesScope(MISSING_ID, { bookId: MISSING_ID }));
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("bookId"));
  });

  it("rejects a bookId on the character scope once a contextBookId is chosen", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(
      accessToken,
      characterScope(MISSING_ID, { bookId: MISSING_ID, contextBookId: MISSING_ID }),
    );
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("bookId"));
  });

  it("rejects a reading position on the global character scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, characterScope(MISSING_ID, { contextPage: 10 }));
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("contextPage"));
  });

  it("rejects a reading position on the series scope without a contextBookId", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, seriesScope(MISSING_ID, { contextChapter: 3 }));
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("contextChapter"));
  });

  it("rejects a one-character search after whitespace normalization", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, bookScope(MISSING_ID, { q: "  a  " }));
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("q"));
  });

  it("rejects a search longer than 100 characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, bookScope(MISSING_ID, { q: "x".repeat(101) }));
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("q"));
  });

  it("rejects a page size of 0", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, bookScope(MISSING_ID, { pageSize: 0 }));
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("pageSize"));
  });

  it("rejects a page size of 101", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, bookScope(MISSING_ID, { pageSize: 101 }));
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("pageSize"));
  });

  it("rejects an unknown category filter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(
      accessToken,
      bookScope(MISSING_ID, { categories: "social,telepathic" }),
    );
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("categories.1"));
  });

  it("returns 401 without an access token", async () => {
    const res = await request(app.getHttpServer()).get(LIST_PATH).query(bookScope(MISSING_ID));
    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});

describe("GET /api/character-relationships ownership", () => {
  async function seedOwnerA(): Promise<{
    characterId: string;
    standaloneBookId: string;
    trilogy: Trilogy;
  }> {
    const owner = await context.registerVerifyAndLogin();
    const trilogy = await seedTrilogy(owner.accessToken);
    const standaloneBookId = await createStandaloneBook(owner.accessToken, "Tehanu");
    const [ged, tenar] = await createCast(owner.accessToken, ["Ged", "Tenar"]);
    await createEdge(owner.accessToken, {
      source: ged,
      states: [{ bookId: trilogy.part1 }, { bookId: standaloneBookId }],
      target: tenar,
    });
    return { characterId: ged, standaloneBookId, trilogy };
  }

  it("returns 404 for another user's character scope", async () => {
    const ownerA = await seedOwnerA();
    const intruder = await context.registerVerifyAndLogin();

    const res = await listRequest(intruder.accessToken, characterScope(ownerA.characterId));

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 404 for another user's book scope", async () => {
    const ownerA = await seedOwnerA();
    const intruder = await context.registerVerifyAndLogin();

    const res = await listRequest(intruder.accessToken, bookScope(ownerA.standaloneBookId));

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 404 for another user's series scope", async () => {
    const ownerA = await seedOwnerA();
    const intruder = await context.registerVerifyAndLogin();

    const res = await listRequest(intruder.accessToken, seriesScope(ownerA.trilogy.seriesId));

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 404 for another user's book used as the character contextBookId", async () => {
    const ownerA = await seedOwnerA();
    const intruder = await context.registerVerifyAndLogin();
    const ownCharacter = await createCharacter(intruder.accessToken, "Sparrowhawk");

    const res = await listRequest(
      intruder.accessToken,
      characterScope(ownCharacter, { contextBookId: ownerA.trilogy.part1 }),
    );

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 404 for a scope id that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listRequest(accessToken, bookScope(MISSING_ID));

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 400 when the series contextBookId is not a part of that series", async () => {
    const owner = await context.registerVerifyAndLogin();
    const trilogy = await seedTrilogy(owner.accessToken);
    const standaloneBookId = await createStandaloneBook(owner.accessToken, "Tehanu");

    const res = await listRequest(
      owner.accessToken,
      seriesScope(trilogy.seriesId, { contextBookId: standaloneBookId }),
    );

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.code).toBe("relationship_book_context_invalid");
  });
});

describe("GET /api/character-relationships pagination", () => {
  const PAIR_TYPES = ["friend_of", "ally_of", "acquaintance_of", "rival_of", "enemy_of"] as const;

  async function seedTwentyFiveEdges(token: string): Promise<{ bookId: string; ids: string[] }> {
    const bookId = await createStandaloneBook(token, "The Farthest Shore");
    const [hub, ...others] = await createCast(token, [
      "Arren",
      "Cob",
      "Lebannen",
      "Orm",
      "Sopli",
      "Tehanu",
    ]);
    const ids: string[] = [];
    for (const other of others) {
      for (const type of PAIR_TYPES) {
        ids.push(
          await createEdge(token, { source: hub, states: [{ bookId }], target: other, type }),
        );
      }
    }
    return { bookId, ids };
  }

  it("returns 20 items on the first page by default", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await seedTwentyFiveEdges(accessToken);

    const page = await listPage(accessToken, bookScope(bookId));

    expect(page).toMatchObject({ page: 1, pagesCount: 2, pageSize: 20, totalCount: 25 });
    expect(page.items).toHaveLength(20);
  });

  it("returns the remaining 5 items on the second page without repeating the first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, ids } = await seedTwentyFiveEdges(accessToken);

    const first = await listIds(accessToken, bookScope(bookId));
    const second = await listPage(accessToken, bookScope(bookId, { pageNumber: 2 }));

    expect(second).toMatchObject({ page: 2, pagesCount: 2, pageSize: 20, totalCount: 25 });
    expect(second.items).toHaveLength(5);
    expect(sorted([...first, ...idsOf(second.items)])).toEqual(sorted(ids));
  });

  it("splits the same order across pages that a single page returns", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await seedTwentyFiveEdges(accessToken);

    const whole = await listIds(accessToken, bookScope(bookId, { pageSize: 25 }));
    const first = await listIds(accessToken, bookScope(bookId));
    const second = await listIds(accessToken, bookScope(bookId, { pageNumber: 2 }));

    expect([...first, ...second]).toEqual(whole);
  });

  it("returns the identical order for a repeated query", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await seedTwentyFiveEdges(accessToken);

    const first = await listIds(accessToken, bookScope(bookId, { pageSize: 25 }));
    const repeated = await listIds(accessToken, bookScope(bookId, { pageSize: 25 }));

    expect(repeated).toEqual(first);
  });

  it("returns an empty page past the end with the real totals", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await seedTwentyFiveEdges(accessToken);

    const page = await listPage(accessToken, bookScope(bookId, { pageNumber: 3 }));

    expect(page).toEqual({ items: [], page: 3, pagesCount: 2, pageSize: 20, totalCount: 25 });
  });
});

describe("GET /api/character-relationships hidden edges", () => {
  it("omits a whole-hidden edge from the items and the total", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createStandaloneBook(accessToken, "The Other Wind");
    const [hub, visible, hidden] = await createCast(accessToken, ["Alder", "Irian", "Lily"]);
    const visibleEdge = await createEdge(accessToken, {
      source: hub,
      states: [{ bookId }],
      target: visible,
    });
    await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, hideRelationshipAsSpoiler: true }],
      target: hidden,
    });

    const page = await listPage(accessToken, bookScope(bookId));

    expect(idsOf(page.items)).toEqual([visibleEdge]);
    expect(page.totalCount).toBe(1);
  });

  it("omits an edge introduced later when the reading position is unknown", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createStandaloneBook(accessToken, "The Other Wind");
    const [hub, unmarked, marked] = await createCast(accessToken, ["Alder", "Irian", "Lily"]);
    const unmarkedEdge = await createEdge(accessToken, {
      source: hub,
      states: [{ bookId }],
      target: unmarked,
    });
    await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, introducedPage: 10 }],
      target: marked,
    });

    const page = await listPage(accessToken, bookScope(bookId));

    expect(idsOf(page.items)).toEqual([unmarkedEdge]);
    expect(page.totalCount).toBe(1);
  });

  it("omits an edge introduced after an explicit reading position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createStandaloneBook(accessToken, "The Other Wind");
    const [hub, early, late] = await createCast(accessToken, ["Alder", "Irian", "Lily"]);
    const earlyEdge = await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, introducedChapter: "2" }],
      target: early,
    });
    await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, introducedChapter: "9" }],
      target: late,
    });

    const page = await listPage(accessToken, bookScope(bookId, { contextChapter: 5 }));

    expect(idsOf(page.items)).toEqual([earlyEdge]);
    expect(page.totalCount).toBe(1);
  });

  it("omits an edge introduced after the persisted current page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createStandaloneBook(accessToken, "The Other Wind", { page: 30 });
    const [hub, early, late] = await createCast(accessToken, ["Alder", "Irian", "Lily"]);
    const earlyEdge = await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, introducedPage: 20 }],
      target: early,
    });
    await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, introducedPage: 40 }],
      target: late,
    });

    const page = await listPage(accessToken, bookScope(bookId));

    expect(idsOf(page.items)).toEqual([earlyEdge]);
    expect(page.totalCount).toBe(1);
  });

  it("lets an explicit position past the persisted page reveal a later introduction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createStandaloneBook(accessToken, "The Other Wind", { page: 30 });
    const [hub, early, late] = await createCast(accessToken, ["Alder", "Irian", "Lily"]);
    const earlyEdge = await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, introducedPage: 20 }],
      target: early,
    });
    const lateEdge = await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, introducedPage: 40 }],
      target: late,
    });

    const page = await listPage(accessToken, bookScope(bookId, { contextPage: 50 }));

    expect(sorted(idsOf(page.items))).toEqual(sorted([earlyEdge, lateEdge]));
  });

  it("shows every introduction of a finished book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createStandaloneBook(accessToken, "The Other Wind", { finished: true });
    const [hub, late] = await createCast(accessToken, ["Alder", "Lily"]);
    const lateEdge = await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, introducedPage: 450 }],
      target: late,
    });

    const ids = await listIds(accessToken, bookScope(bookId));

    expect(ids).toEqual([lateEdge]);
  });
});

describe("GET /api/character-relationships filters over masked fields", () => {
  type FilterFixture = { bookId: string; hiddenEdge: string; visibleEdge: string };

  async function seedRomanticPair(token: string): Promise<FilterFixture> {
    const bookId = await createStandaloneBook(token, "The Tombs of Atuan");
    const [hub, secret, open] = await createCast(token, ["Tenar", "Manan", "Kossil"]);
    const hiddenEdge = await createEdge(token, {
      isCanonical: true,
      source: hub,
      states: [{ bookId, intensity: "high", isTypeSpoiler: true }],
      target: secret,
      type: "partner_of",
    });
    const visibleEdge = await createEdge(token, {
      isCanonical: true,
      source: hub,
      states: [{ bookId, intensity: "high" }],
      target: open,
      type: "engaged_to",
    });
    return { bookId, hiddenEdge, visibleEdge };
  }

  it("never matches a type-hidden edge by its category", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedRomanticPair(accessToken);

    const page = await listPage(accessToken, bookScope(fixture.bookId, { categories: "romantic" }));

    expect(idsOf(page.items)).toEqual([fixture.visibleEdge]);
    expect(page.totalCount).toBe(1);
  });

  it("never matches a type-hidden edge by its relationship type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedRomanticPair(accessToken);

    const page = await listPage(
      accessToken,
      bookScope(fixture.bookId, { relationshipTypes: "partner_of,engaged_to" }),
    );

    expect(idsOf(page.items)).toEqual([fixture.visibleEdge]);
    expect(page.totalCount).toBe(1);
  });

  it("never matches a type-hidden edge by its canonical flag", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedRomanticPair(accessToken);

    const ids = await listIds(accessToken, bookScope(fixture.bookId, { isCanonical: true }));

    expect(ids).toEqual([fixture.visibleEdge]);
  });

  it("never matches a type-hidden edge by the intensity the type mask hides", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedRomanticPair(accessToken);

    const ids = await listIds(accessToken, bookScope(fixture.bookId, { intensities: "high" }));

    expect(ids).toEqual([fixture.visibleEdge]);
  });

  it("still lists the type-hidden edge when no filter is applied", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedRomanticPair(accessToken);

    const ids = await listIds(accessToken, bookScope(fixture.bookId));

    expect(sorted(ids)).toEqual(sorted([fixture.hiddenEdge, fixture.visibleEdge]));
  });
});

describe("GET /api/character-relationships search", () => {
  it("never matches the custom type or labels of a type-hidden edge", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createStandaloneBook(accessToken, "A Wizard of Earthsea");
    const [hub, secret, open] = await createCast(accessToken, ["Ged", "Shadow", "Vetch"]);
    await createEdge(accessToken, {
      custom: { customType: "Oathbound", directionality: "directed" },
      source: hub,
      sourceLabel: "Oathkeeper",
      states: [{ bookId, isTypeSpoiler: true }],
      target: secret,
      targetLabel: "Oathtaker",
    });
    const visibleEdge = await createEdge(accessToken, {
      custom: { customType: "Oathsworn", directionality: "directed" },
      source: hub,
      states: [{ bookId }],
      target: open,
    });

    const page = await listPage(accessToken, bookScope(bookId, { q: "oath" }));

    expect(idsOf(page.items)).toEqual([visibleEdge]);
    expect(page.totalCount).toBe(1);
  });

  it("never matches a spoiler description", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createStandaloneBook(accessToken, "A Wizard of Earthsea");
    const [hub, secret, open] = await createCast(accessToken, ["Ged", "Jasper", "Vetch"]);
    await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, description: "Secretly poisoned the king", isDescriptionSpoiler: true }],
      target: secret,
    });
    const visibleEdge = await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, description: "Openly poisoned the well" }],
      target: open,
    });

    const page = await listPage(accessToken, bookScope(bookId, { q: "poisoned" }));

    expect(idsOf(page.items)).toEqual([visibleEdge]);
    expect(page.totalCount).toBe(1);
  });

  it("matches the visible description of the effective state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createStandaloneBook(accessToken, "A Wizard of Earthsea");
    const [hub, friend, rival] = await createCast(accessToken, ["Ged", "Vetch", "Jasper"]);
    const describedEdge = await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, description: "Sailed to the Isle of the Dragons" }],
      target: friend,
    });
    await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, description: "Duelled on Roke" }],
      target: rival,
      type: "rival_of",
    });

    const ids = await listIds(accessToken, bookScope(bookId, { q: "dragons" }));

    expect(ids).toEqual([describedEdge]);
  });

  it("matches the other participant name of a type-hidden edge in the character scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createStandaloneBook(accessToken, "A Wizard of Earthsea");
    const [hub, secret, open] = await createCast(accessToken, ["Ged", "Serret", "Vetch"]);
    const hiddenTypeEdge = await createEdge(accessToken, {
      source: hub,
      states: [{ bookId, isTypeSpoiler: true }],
      target: secret,
      type: "partner_of",
    });
    await createEdge(accessToken, { source: hub, states: [{ bookId }], target: open });

    const page = await listPage(accessToken, characterScope(hub, { q: "serr" }));

    expect(idsOf(page.items)).toEqual([hiddenTypeEdge]);
    expect(itemOf(page, hiddenTypeEdge).relationship.typeHidden).toBe(true);
  });

  it("does not match the scope character's own name in the character scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const [hub, friend] = await createCast(accessToken, ["Ogion", "Vetch"]);
    await createEdge(accessToken, { source: hub, target: friend });

    const page = await listPage(accessToken, characterScope(hub, { q: "ogion" }));

    expect(page.totalCount).toBe(0);
  });

  it("matches either participant name in the book scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createStandaloneBook(accessToken, "A Wizard of Earthsea");
    const [ogion, ged, vetch] = await createCast(accessToken, ["Ogion", "Ged", "Vetch"]);
    const mentorship = await createEdge(accessToken, {
      source: ogion,
      states: [{ bookId }],
      target: ged,
      type: "mentor_of",
    });
    await createEdge(accessToken, { source: ged, states: [{ bookId }], target: vetch });

    const ids = await listIds(accessToken, bookScope(bookId, { q: "ogion" }));

    expect(ids).toEqual([mentorship]);
  });
});

describe("GET /api/character-relationships masking", () => {
  async function seedMentorship(
    token: string,
    { progress, state }: { progress?: ReaderProgress; state: StateSeedBody },
  ): Promise<{ bookId: string; edgeId: string; ged: string; ogion: string }> {
    const bookId = await createStandaloneBook(token, "Tales from Earthsea", progress);
    const [ogion, ged] = await createCast(token, ["Ogion", "Ged"]);
    const edgeId = await createEdge(token, {
      isCanonical: true,
      source: ogion,
      sourceLabel: "master",
      states: [{ bookId, ...state }],
      target: ged,
      targetLabel: "apprentice",
      type: "mentor_of",
    });
    return { bookId, edgeId, ged, ogion };
  }

  it("returns a type-hidden edge with every type-derived field nulled", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedMentorship(accessToken, {
      progress: { page: 60 },
      state: { intensity: "high", isTypeSpoiler: true },
    });

    const res = await listRequest(accessToken, bookScope(fixture.bookId));

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].relationship).toEqual({
      category: null,
      createdAt: expect.any(String),
      customType: null,
      directionality: null,
      id: fixture.edgeId,
      isCanonical: null,
      source: { avatar: null, id: fixture.ogion, name: "Ogion" },
      sourceLabel: null,
      target: { avatar: null, id: fixture.ged, name: "Ged" },
      targetLabel: null,
      type: null,
      typeHidden: true,
      visibleChangedAt: expect.any(String),
    });
  });

  it("nulls the intensity of a type-hidden effective state but keeps its status and description", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedMentorship(accessToken, {
      progress: { page: 60 },
      state: { description: "Teaches silence", intensity: "high", isTypeSpoiler: true },
    });

    const page = await listPage(accessToken, bookScope(fixture.bookId));

    expect(page.items[0]?.effectiveState).toMatchObject({
      description: "Teaches silence",
      descriptionHidden: false,
      intensity: null,
      status: "active",
    });
  });

  it("returns an unmasked edge with its type fields and intensity", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedMentorship(accessToken, {
      progress: { page: 60 },
      state: { intensity: "high" },
    });

    const page = await listPage(accessToken, bookScope(fixture.bookId));

    expect(page.items[0]?.relationship).toMatchObject({
      category: "mentorship",
      customType: null,
      directionality: "directed",
      isCanonical: true,
      sourceLabel: "master",
      targetLabel: "apprentice",
      type: "mentor_of",
      typeHidden: false,
    });
    expect(page.items[0]?.effectiveState?.intensity).toBe("high");
  });

  it("hides a spoiler description and flags it without hiding the type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedMentorship(accessToken, {
      progress: { page: 60 },
      state: { description: "Dies on the mountain", isDescriptionSpoiler: true },
    });

    const page = await listPage(accessToken, bookScope(fixture.bookId));

    expect(page.items[0]?.effectiveState).toMatchObject({
      description: null,
      descriptionHidden: true,
    });
    expect(page.items[0]?.relationship.typeHidden).toBe(false);
  });

  it("nulls the ended status and end markers when the end is past the reader", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedMentorship(accessToken, {
      progress: { page: 60 },
      state: { endedChapter: "12", endedPage: 80, status: "ended" },
    });

    const page = await listPage(accessToken, bookScope(fixture.bookId));

    expect(page.items[0]?.effectiveState).toMatchObject({
      endedAudioSeconds: null,
      endedChapter: null,
      endedPage: null,
      status: null,
    });
  });

  it("keeps a non-ended status but nulls an end marker past the reader", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedMentorship(accessToken, {
      progress: { page: 60 },
      state: { endedPage: 80, status: "active" },
    });

    const page = await listPage(accessToken, bookScope(fixture.bookId));

    expect(page.items[0]?.effectiveState).toMatchObject({ endedPage: null, status: "active" });
  });

  it("shows the ended status and end marker once the reader passed the end", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedMentorship(accessToken, {
      progress: { page: 60 },
      state: { endedPage: 40, status: "ended" },
    });

    const page = await listPage(accessToken, bookScope(fixture.bookId));

    expect(page.items[0]?.effectiveState).toMatchObject({ endedPage: 40, status: "ended" });
  });

  it("defers an ended status with an end marker when the reading position is unknown", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedMentorship(accessToken, {
      state: { endedPage: 40, status: "ended" },
    });

    const page = await listPage(accessToken, bookScope(fixture.bookId));

    expect(page.items[0]?.effectiveState).toMatchObject({ endedPage: null, status: null });
  });

  it("keeps an ended status without an end marker when the reading position is unknown", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedMentorship(accessToken, { state: { status: "ended" } });

    const page = await listPage(accessToken, bookScope(fixture.bookId));

    expect(page.items[0]?.effectiveState?.status).toBe("ended");
  });

  it("matches the statuses filter only against the masked status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createStandaloneBook(accessToken, "Tales from Earthsea", { page: 60 });
    const [ogion, ged, vetch] = await createCast(accessToken, ["Ogion", "Ged", "Vetch"]);
    await createEdge(accessToken, {
      source: ogion,
      states: [{ bookId, endedPage: 80, status: "ended" }],
      target: ged,
      type: "mentor_of",
    });
    const reachedEnd = await createEdge(accessToken, {
      source: ogion,
      states: [{ bookId, endedPage: 40, status: "ended" }],
      target: vetch,
      type: "mentor_of",
    });

    const page = await listPage(accessToken, bookScope(bookId, { statuses: "ended" }));

    expect(idsOf(page.items)).toEqual([reachedEnd]);
    expect(page.totalCount).toBe(1);
  });
});

type SeriesEdges = Trilogy & {
  earlyOnly: string;
  evolving: string;
  futureOnly: string;
  gatedLatest: string;
  hub: string;
  unrelated: string;
};

async function seedSeriesEdges(
  token: string,
  progress: { part1?: ReaderProgress; part2?: ReaderProgress; part3?: ReaderProgress } = {},
): Promise<SeriesEdges> {
  const trilogy = await seedTrilogy(token, progress);
  const [hub, tenar, tehanu, lebannen, irian] = await createCast(token, [
    "Ged",
    "Tenar",
    "Tehanu",
    "Lebannen",
    "Irian",
  ]);
  const evolving = await createEdge(token, {
    source: hub,
    states: [
      { bookId: trilogy.part1, description: "Strangers" },
      { bookId: trilogy.part2, description: "Allies" },
      { bookId: trilogy.part3, description: "Family" },
    ],
    target: tenar,
  });
  const gatedLatest = await createEdge(token, {
    source: hub,
    states: [
      { bookId: trilogy.part1, description: "Met" },
      { bookId: trilogy.part2, hideRelationshipAsSpoiler: true },
    ],
    target: tehanu,
  });
  const futureOnly = await createEdge(token, {
    source: hub,
    states: [{ bookId: trilogy.part3 }],
    target: lebannen,
  });
  const earlyOnly = await createEdge(token, {
    source: hub,
    states: [{ bookId: trilogy.part1, description: "Once" }],
    target: irian,
  });
  const unrelated = await createEdge(token, {
    source: tenar,
    states: [{ bookId: trilogy.part1 }, { bookId: trilogy.part2 }],
    target: tehanu,
  });
  return { ...trilogy, earlyOnly, evolving, futureOnly, gatedLatest, hub, unrelated };
}

describe("GET /api/character-relationships series scope", () => {
  it("picks the latest state as of the context part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedSeriesEdges(accessToken);

    const page = await listPage(
      accessToken,
      seriesScope(fixture.seriesId, { contextBookId: fixture.part2 }),
    );

    const item = itemOf(page, fixture.evolving);
    expect(item.effectiveState).toMatchObject({
      bookId: fixture.part2,
      bookTitle: "Earthsea Two",
      description: "Allies",
      partNumber: 2,
    });
    expect(item.bookSummaries).toEqual([]);
  });

  it("carries an earlier part state forward when the context part has none", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedSeriesEdges(accessToken);

    const page = await listPage(
      accessToken,
      seriesScope(fixture.seriesId, { contextBookId: fixture.part2 }),
    );

    expect(itemOf(page, fixture.earlyOnly).effectiveState).toMatchObject({
      bookId: fixture.part1,
      description: "Once",
    });
  });

  it("does not fall back to an older state when the newest effective state is hidden", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedSeriesEdges(accessToken);

    const ids = await listIds(
      accessToken,
      seriesScope(fixture.seriesId, { contextBookId: fixture.part2 }),
    );

    expect(ids).not.toContain(fixture.gatedLatest);
  });

  it("shows the older state while the context is still before the hidden part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedSeriesEdges(accessToken);

    const page = await listPage(
      accessToken,
      seriesScope(fixture.seriesId, { contextBookId: fixture.part1 }),
    );

    expect(itemOf(page, fixture.gatedLatest).effectiveState).toMatchObject({
      bookId: fixture.part1,
      description: "Met",
    });
  });

  it("counts only the edges eligible as of the context and never future parts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedSeriesEdges(accessToken);

    const page = await listPage(
      accessToken,
      seriesScope(fixture.seriesId, { contextBookId: fixture.part2 }),
    );

    expect(sorted(idsOf(page.items))).toEqual(
      sorted([fixture.evolving, fixture.earlyOnly, fixture.unrelated]),
    );
    expect(page.totalCount).toBe(3);
  });

  it("defaults the context to the series reading-context default book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedSeriesEdges(accessToken, {
      part1: { finished: true },
      part2: { finished: true },
    });
    const defaultRes = await authed(
      "get",
      `/api/series/${fixture.seriesId}/reading-context/default`,
      accessToken,
    );
    expect(defaultRes.status).toBe(HttpStatus.OK);
    const defaultContext = SeriesReadingContextDefaultViewSchema.parse(defaultRes.body);
    expect(defaultContext.contextBookId).toBe(fixture.part2);

    const page = await listPage(accessToken, seriesScope(fixture.seriesId));

    expect(itemOf(page, fixture.evolving).effectiveState?.bookId).toBe(
      defaultContext.contextBookId,
    );
    expect(idsOf(page.items)).not.toContain(fixture.futureOnly);
  });

  it("defaults to the first part when no part is finished", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedSeriesEdges(accessToken);

    const page = await listPage(accessToken, seriesScope(fixture.seriesId));

    expect(itemOf(page, fixture.evolving).effectiveState?.bookId).toBe(fixture.part1);
    expect(itemOf(page, fixture.gatedLatest).effectiveState?.bookId).toBe(fixture.part1);
  });

  it("returns an empty page for a series without books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await authed("post", "/api/series", accessToken).send({ name: "Empty Saga" });
    expect(created.status).toBe(HttpStatus.CREATED);

    const page = await listPage(accessToken, seriesScope(created.body.id));

    expect(page).toEqual({ items: [], page: 1, pagesCount: 0, pageSize: 20, totalCount: 0 });
  });
});

describe("GET /api/character-relationships book scope", () => {
  it("returns only the direct state of the book with no summaries", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedSeriesEdges(accessToken);

    const page = await listPage(accessToken, bookScope(fixture.part2));

    const item = itemOf(page, fixture.evolving);
    expect(item.effectiveState).toMatchObject({ bookId: fixture.part2, description: "Allies" });
    expect(item.bookSummaries).toEqual([]);
  });

  it("does not inherit a state from an earlier part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedSeriesEdges(accessToken);

    const page = await listPage(accessToken, bookScope(fixture.part2));

    expect(sorted(idsOf(page.items))).toEqual(sorted([fixture.evolving, fixture.unrelated]));
    expect(page.totalCount).toBe(2);
  });
});

describe("GET /api/character-relationships character scope with a context book", () => {
  it("returns the direct state in the chosen book for edges of the character only", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedSeriesEdges(accessToken);

    const page = await listPage(
      accessToken,
      characterScope(fixture.hub, { contextBookId: fixture.part1 }),
    );

    expect(sorted(idsOf(page.items))).toEqual(
      sorted([fixture.evolving, fixture.gatedLatest, fixture.earlyOnly]),
    );
    expect(page.items.map((item) => item.effectiveState?.bookId)).toEqual([
      fixture.part1,
      fixture.part1,
      fixture.part1,
    ]);
    expect(page.items.flatMap((item) => item.bookSummaries)).toEqual([]);
  });

  it("does not inherit an earlier part state for the chosen book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedSeriesEdges(accessToken);

    const page = await listPage(
      accessToken,
      characterScope(fixture.hub, { contextBookId: fixture.part2 }),
    );

    expect(idsOf(page.items)).toEqual([fixture.evolving]);
    expect(page.totalCount).toBe(1);
  });
});

type GlobalEdges = Trilogy & {
  alphaBookId: string;
  betaBookId: string;
  futureOnly: string;
  hiddenOnly: string;
  hub: string;
  spanning: string;
  stateless: string;
};

async function seedGlobalEdges(token: string): Promise<GlobalEdges> {
  const trilogy = await seedTrilogy(token, {
    part1: { finished: true },
    part2: { finished: true },
  });
  const alphaBookId = await createStandaloneBook(token, "Alpha Tale");
  const betaBookId = await createStandaloneBook(token, "Beta Tale");
  const [hub, arha, cob, irian, lebannen] = await createCast(token, [
    "Ged",
    "Arha",
    "Cob",
    "Irian",
    "Lebannen",
  ]);
  const stateless = await createEdge(token, { source: hub, target: arha });
  const futureOnly = await createEdge(token, {
    source: hub,
    states: [{ bookId: trilogy.part3 }],
    target: cob,
  });
  const spanning = await createEdge(token, {
    source: hub,
    states: [
      { bookId: betaBookId },
      { bookId: trilogy.part2 },
      { bookId: alphaBookId },
      { bookId: trilogy.part3 },
      { bookId: trilogy.part1 },
    ],
    target: irian,
  });
  const hiddenOnly = await createEdge(token, {
    source: hub,
    states: [{ bookId: trilogy.part1, hideRelationshipAsSpoiler: true }],
    target: lebannen,
  });
  return {
    ...trilogy,
    alphaBookId,
    betaBookId,
    futureOnly,
    hiddenOnly,
    hub,
    spanning,
    stateless,
  };
}

describe("GET /api/character-relationships global character scope", () => {
  it("lists a stateless edge with a null effective state, no summaries and its type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedGlobalEdges(accessToken);

    const page = await listPage(accessToken, characterScope(fixture.hub));

    const item = itemOf(page, fixture.stateless);
    expect(item.effectiveState).toBeNull();
    expect(item.bookSummaries).toEqual([]);
    expect(item.relationship).toMatchObject({ type: "friend_of", typeHidden: false });
  });

  it("counts only stateless edges and edges with a permitted state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedGlobalEdges(accessToken);

    const page = await listPage(accessToken, characterScope(fixture.hub));

    expect(sorted(idsOf(page.items))).toEqual(sorted([fixture.stateless, fixture.spanning]));
    expect(page.totalCount).toBe(2);
  });

  it("returns one summary per permitted book with series parts first, then standalones by title", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedGlobalEdges(accessToken);

    const page = await listPage(accessToken, characterScope(fixture.hub));

    const item = itemOf(page, fixture.spanning);
    expect(item.effectiveState).toBeNull();
    expect(item.bookSummaries.map((summary) => summary.bookId)).toEqual([
      fixture.part1,
      fixture.part2,
      fixture.alphaBookId,
      fixture.betaBookId,
    ]);
  });

  it("matches the bookId filter only through a permitted summary", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedGlobalEdges(accessToken);

    const page = await listPage(
      accessToken,
      characterScope(fixture.hub, { bookId: fixture.part1 }),
    );

    expect(idsOf(page.items)).toEqual([fixture.spanning]);
    expect(page.totalCount).toBe(1);
  });

  it("never matches the bookId filter through a future-part state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedGlobalEdges(accessToken);

    const page = await listPage(
      accessToken,
      characterScope(fixture.hub, { bookId: fixture.part3 }),
    );

    expect(page.totalCount).toBe(0);
  });

  it("masks the type when any permitted state is a type spoiler", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const trilogy = await seedTrilogy(accessToken, {
      part1: { finished: true },
      part2: { finished: true },
    });
    const [ged, tenar] = await createCast(accessToken, ["Ged", "Tenar"]);
    const edgeId = await createEdge(accessToken, {
      source: ged,
      states: [
        { bookId: trilogy.part1, intensity: "low" },
        { bookId: trilogy.part2, intensity: "high", isTypeSpoiler: true },
      ],
      target: tenar,
      type: "partner_of",
    });

    const page = await listPage(accessToken, characterScope(ged));

    const item = itemOf(page, edgeId);
    expect(item.relationship).toMatchObject({ category: null, type: null, typeHidden: true });
    expect(item.bookSummaries.map((summary) => summary.intensity)).toEqual([null, null]);
  });

  it("keeps the type when the only type spoiler sits in a future part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const trilogy = await seedTrilogy(accessToken, { part1: { finished: true } });
    const [ged, tenar] = await createCast(accessToken, ["Ged", "Tenar"]);
    const edgeId = await createEdge(accessToken, {
      source: ged,
      states: [
        { bookId: trilogy.part1, intensity: "low" },
        { bookId: trilogy.part2, isTypeSpoiler: true },
      ],
      target: tenar,
      type: "partner_of",
    });

    const page = await listPage(accessToken, characterScope(ged));

    const item = itemOf(page, edgeId);
    expect(item.relationship).toMatchObject({ type: "partner_of", typeHidden: false });
    expect(item.bookSummaries.map((summary) => summary.bookId)).toEqual([trilogy.part1]);
    expect(item.bookSummaries[0]?.intensity).toBe("low");
  });

  describe("status and intensity filters", () => {
    async function seedSplitSummaries(
      token: string,
    ): Promise<{ hub: string; sameSummary: string; splitSummaries: string }> {
      const first = await createStandaloneBook(token, "Alpha Tale", { finished: true });
      const second = await createStandaloneBook(token, "Beta Tale", { finished: true });
      const [hub, split, same] = await createCast(token, ["Ged", "Jasper", "Vetch"]);
      const splitSummaries = await createEdge(token, {
        source: hub,
        states: [
          { bookId: first, intensity: "low", status: "ended" },
          { bookId: second, intensity: "high", status: "active" },
        ],
        target: split,
      });
      const sameSummary = await createEdge(token, {
        source: hub,
        states: [{ bookId: first, intensity: "low", status: "active" }],
        target: same,
      });
      return { hub, sameSummary, splitSummaries };
    }

    it("requires one summary to satisfy both the status and the intensity", async () => {
      const { accessToken } = await context.registerVerifyAndLogin();
      const fixture = await seedSplitSummaries(accessToken);

      const ids = await listIds(
        accessToken,
        characterScope(fixture.hub, { intensities: "low", statuses: "active" }),
      );

      expect(ids).toEqual([fixture.sameSummary]);
    });

    it("matches an edge whose single summary carries both values", async () => {
      const { accessToken } = await context.registerVerifyAndLogin();
      const fixture = await seedSplitSummaries(accessToken);

      const ids = await listIds(
        accessToken,
        characterScope(fixture.hub, { intensities: "high", statuses: "active" }),
      );

      expect(ids).toEqual([fixture.splitSummaries]);
    });
  });
});

describe("GET /api/character-relationships sorting", () => {
  type SortFixture = { arya: string; bran: string; hub: string; tom: string };

  async function seedMentorships(token: string): Promise<SortFixture> {
    const [hub, aryaId, branId, tomId] = await createCast(token, ["Mia", "Arya", "Bran", "Tom"]);
    const tom = await createEdge(token, { source: tomId, target: hub, type: "mentor_of" });
    const arya = await createEdge(token, { source: hub, target: aryaId, type: "mentor_of" });
    const bran = await createEdge(token, { source: branId, target: hub, type: "mentor_of" });
    return { arya, bran, hub, tom };
  }

  it("sorts by the other participant name ascending by default", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedMentorships(accessToken);

    const ids = await listIds(accessToken, characterScope(fixture.hub));

    expect(ids).toEqual([fixture.arya, fixture.bran, fixture.tom]);
  });

  it("sorts by the other participant name descending", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedMentorships(accessToken);

    const ids = await listIds(accessToken, characterScope(fixture.hub, { sort: "name_desc" }));

    expect(ids).toEqual([fixture.tom, fixture.bran, fixture.arya]);
  });

  it("sorts the newest edge first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedMentorships(accessToken);

    const ids = await listIds(accessToken, characterScope(fixture.hub, { sort: "newest" }));

    expect(ids).toEqual([fixture.bran, fixture.arya, fixture.tom]);
  });

  it("rejects an unknown sort", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await listRequest(accessToken, characterScope(MISSING_ID, { sort: "oldest" }));
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(includesErrorOn("sort"));
  });
});

describe("GET /api/character-relationships recently_updated", () => {
  type UpdateFixture = {
    bookId: string;
    descriptionSpoiler: string;
    plainNewest: string;
    plainOldest: string;
    typeSpoiler: string;
  };

  async function seedUpdateOrder(token: string): Promise<UpdateFixture> {
    const bookId = await createStandaloneBook(token, "The Farthest Shore");
    const [hub, alder, irian, lily, orm] = await createCast(token, [
      "Ged",
      "Alder",
      "Irian",
      "Lily",
      "Orm",
    ]);
    const plainOldest = await createEdge(token, {
      source: hub,
      states: [{ bookId, description: "First meeting" }],
      target: alder,
    });
    const typeSpoiler = await createEdge(token, {
      source: hub,
      states: [{ bookId, description: "Bound", isTypeSpoiler: true }],
      target: irian,
    });
    const descriptionSpoiler = await createEdge(token, {
      source: hub,
      states: [{ bookId, description: "Betrays him", isDescriptionSpoiler: true }],
      target: lily,
    });
    const plainNewest = await createEdge(token, {
      source: hub,
      states: [{ bookId, description: "Last meeting" }],
      target: orm,
    });
    return { bookId, descriptionSpoiler, plainNewest, plainOldest, typeSpoiler };
  }

  function recentlyUpdated(bookId: string): ListQuery {
    return bookScope(bookId, { sort: "recently_updated" });
  }

  function visibleChangedAtOf(
    page: PaginatedCharacterRelationshipListView,
    relationshipId: string,
  ): string {
    return itemOf(page, relationshipId).relationship.visibleChangedAt;
  }

  it("orders edges by their visible change, newest first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedUpdateOrder(accessToken);

    const ids = await listIds(accessToken, recentlyUpdated(fixture.bookId));

    expect(ids).toEqual([
      fixture.plainNewest,
      fixture.descriptionSpoiler,
      fixture.typeSpoiler,
      fixture.plainOldest,
    ]);
  });

  it("keeps the order and visibleChangedAt when only a type-hidden state changes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedUpdateOrder(accessToken);
    const before = await listPage(accessToken, recentlyUpdated(fixture.bookId));

    await putState(accessToken, {
      bookId: fixture.bookId,
      relationshipId: fixture.typeSpoiler,
      state: { description: "Bound by a true name", isTypeSpoiler: true },
    });
    const after = await listPage(accessToken, recentlyUpdated(fixture.bookId));

    expect(idsOf(after.items)).toEqual(idsOf(before.items));
    expect(visibleChangedAtOf(after, fixture.typeSpoiler)).toBe(
      visibleChangedAtOf(before, fixture.typeSpoiler),
    );
  });

  it("keeps the order and visibleChangedAt when the type of a type-hidden edge is patched", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedUpdateOrder(accessToken);
    const before = await listPage(accessToken, recentlyUpdated(fixture.bookId));

    const patched = await authed("patch", `${LIST_PATH}/${fixture.typeSpoiler}`, accessToken).send({
      category: "social",
      type: "ally_of",
    });
    expect(patched.status).toBe(HttpStatus.OK);
    const after = await listPage(accessToken, recentlyUpdated(fixture.bookId));

    expect(idsOf(after.items)).toEqual(idsOf(before.items));
    expect(visibleChangedAtOf(after, fixture.typeSpoiler)).toBe(
      visibleChangedAtOf(before, fixture.typeSpoiler),
    );
  });

  it("keeps the order and visibleChangedAt when only a spoiler description changes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedUpdateOrder(accessToken);
    const before = await listPage(accessToken, recentlyUpdated(fixture.bookId));

    await putState(accessToken, {
      bookId: fixture.bookId,
      relationshipId: fixture.descriptionSpoiler,
      state: { description: "Betrays him twice", isDescriptionSpoiler: true },
    });
    const after = await listPage(accessToken, recentlyUpdated(fixture.bookId));

    expect(idsOf(after.items)).toEqual(idsOf(before.items));
    expect(visibleChangedAtOf(after, fixture.descriptionSpoiler)).toBe(
      visibleChangedAtOf(before, fixture.descriptionSpoiler),
    );
  });

  it("moves an edge to the top after a visible state change", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedUpdateOrder(accessToken);
    const before = await listPage(accessToken, recentlyUpdated(fixture.bookId));

    await putState(accessToken, {
      bookId: fixture.bookId,
      relationshipId: fixture.plainOldest,
      state: { description: "Meets again" },
    });
    const after = await listPage(accessToken, recentlyUpdated(fixture.bookId));

    expect(idsOf(after.items)).toEqual([
      fixture.plainOldest,
      fixture.plainNewest,
      fixture.descriptionSpoiler,
      fixture.typeSpoiler,
    ]);
    expect(visibleChangedAtOf(after, fixture.plainOldest)).not.toBe(
      visibleChangedAtOf(before, fixture.plainOldest),
    );
  });

  it("moves an edge to the top after a visible edge patch", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedUpdateOrder(accessToken);

    const patched = await authed("patch", `${LIST_PATH}/${fixture.plainOldest}`, accessToken).send({
      isCanonical: true,
    });
    expect(patched.status).toBe(HttpStatus.OK);
    const ids = await listIds(accessToken, recentlyUpdated(fixture.bookId));

    expect(ids[0]).toBe(fixture.plainOldest);
  });
});

describe("GET /api/character-relationships parity with safe details", () => {
  type ParityFixture = Trilogy & { hub: string };
  type ParityView = Pick<CharacterRelationshipListItemView, "effectiveState" | "relationship">;
  type ParityViews = { detailed: ParityView[]; listed: ParityView[] };

  async function seedParityEdges(token: string): Promise<ParityFixture> {
    const trilogy = await seedTrilogy(token, {
      part1: { finished: true },
      part2: { page: 30 },
    });
    const alphaBookId = await createStandaloneBook(token, "Alpha Tale");
    const [hub, tenar, tehanu, irian, lebannen, orm] = await createCast(token, [
      "Ged",
      "Tenar",
      "Tehanu",
      "Irian",
      "Lebannen",
      "Orm",
    ]);
    await createEdge(token, {
      isCanonical: true,
      source: hub,
      sourceLabel: "husband",
      states: [
        { bookId: trilogy.part1, endedPage: 100, intensity: "medium", status: "ended" },
        { bookId: trilogy.part2, description: "Bound", intensity: "high", isTypeSpoiler: true },
      ],
      target: tenar,
      targetLabel: "wife",
      type: "partner_of",
    });
    await createEdge(token, {
      source: hub,
      states: [
        {
          bookId: trilogy.part2,
          description: "Leaves",
          endedPage: 80,
          isDescriptionSpoiler: true,
          status: "ended",
        },
        { bookId: alphaBookId, description: "Visits", intensity: "low" },
      ],
      target: tehanu,
    });
    await createEdge(token, {
      custom: { customType: "Dragonkin", directionality: "directed" },
      source: irian,
      states: [
        { bookId: trilogy.part1, introducedPage: 10 },
        { bookId: trilogy.part2, description: "Kin", introducedPage: 20 },
      ],
      target: hub,
    });
    await createEdge(token, { source: hub, target: lebannen, type: "mentor_of" });
    await createEdge(token, {
      source: hub,
      states: [{ bookId: trilogy.part1 }, { bookId: trilogy.part2, introducedPage: 50 }],
      target: orm,
      type: "enemy_of",
    });
    return { ...trilogy, hub };
  }

  async function listedAndDetailedViews(token: string, query: ListQuery): Promise<ParityViews> {
    const page = await listPage(token, query);
    const detailed: ParityView[] = [];
    for (const item of page.items) {
      detailed.push(parityViewOf(await readDetails(token, item.relationship.id, query)));
    }
    return { detailed, listed: page.items.map(parityViewOf) };
  }

  function parityViewOf({ effectiveState, relationship }: ParityView): ParityView {
    return { effectiveState, relationship };
  }

  it("matches the details in the book scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedParityEdges(accessToken);

    const views = await listedAndDetailedViews(accessToken, bookScope(fixture.part2));

    expect(views.listed.length).toBeGreaterThanOrEqual(3);
    expect(views.listed).toEqual(views.detailed);
  });

  it("matches the details in the book scope with an explicit position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedParityEdges(accessToken);

    const views = await listedAndDetailedViews(
      accessToken,
      bookScope(fixture.part2, { contextPage: 90 }),
    );

    expect(views.listed.length).toBeGreaterThanOrEqual(4);
    expect(views.listed).toEqual(views.detailed);
  });

  it("matches the details in the series scope as of a context part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedParityEdges(accessToken);

    const views = await listedAndDetailedViews(
      accessToken,
      seriesScope(fixture.seriesId, { contextBookId: fixture.part2 }),
    );

    expect(views.listed.length).toBeGreaterThanOrEqual(3);
    expect(views.listed).toEqual(views.detailed);
  });

  it("matches the details in the character scope with a context book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedParityEdges(accessToken);

    const views = await listedAndDetailedViews(
      accessToken,
      characterScope(fixture.hub, { contextBookId: fixture.part2 }),
    );

    expect(views.listed.length).toBeGreaterThanOrEqual(3);
    expect(views.listed).toEqual(views.detailed);
  });

  it("matches the details and history in the global character scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedParityEdges(accessToken);
    const query = characterScope(fixture.hub);

    const views = await listedAndDetailedViews(accessToken, query);
    expect(views.listed.length).toBeGreaterThanOrEqual(4);
    expect(views.listed).toEqual(views.detailed);
    const page = await listPage(accessToken, query);
    for (const item of page.items) {
      const details = await readDetails(accessToken, item.relationship.id, query);
      expect(item.bookSummaries).toEqual(details.history);
    }
  });
});

describe("authoring CRUD reflected in GET /api/character-relationships", () => {
  type CrudFixture = {
    edgeId: string;
    firstBook: string;
    hub: string;
    secondBook: string;
    tenar: string;
  };

  async function seedAuthoredEdge(token: string): Promise<CrudFixture> {
    const firstBook = await createStandaloneBook(token, "Alpha Tale");
    const secondBook = await createStandaloneBook(token, "Beta Tale");
    const [hub, tenar] = await createCast(token, ["Ged", "Tenar"]);
    const edgeId = await createEdge(token, {
      source: hub,
      states: [{ bookId: firstBook, description: "Meet in the tombs", intensity: "medium" }],
      target: tenar,
    });
    return { edgeId, firstBook, hub, secondBook, tenar };
  }

  it("lists an edge created with initial book states in that book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedAuthoredEdge(accessToken);

    const page = await listPage(accessToken, bookScope(fixture.firstBook));

    expect(idsOf(page.items)).toEqual([fixture.edgeId]);
    expect(page.items[0]?.effectiveState).toMatchObject({
      bookId: fixture.firstBook,
      bookTitle: "Alpha Tale",
      description: "Meet in the tombs",
      intensity: "medium",
      status: "active",
    });
  });

  it("reflects a patched relationship type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedAuthoredEdge(accessToken);

    const patched = await authed("patch", `${LIST_PATH}/${fixture.edgeId}`, accessToken).send({
      category: "romantic",
      type: "partner_of",
    });
    expect(patched.status).toBe(HttpStatus.OK);
    const page = await listPage(accessToken, bookScope(fixture.firstBook));

    expect(page.items[0]?.relationship).toMatchObject({ category: "romantic", type: "partner_of" });
  });

  it("lists the edge in a book that received a new state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedAuthoredEdge(accessToken);
    expect(await listIds(accessToken, bookScope(fixture.secondBook))).toEqual([]);
    await ensureLinkedToBook(accessToken, fixture.secondBook, [fixture.hub, fixture.tenar]);

    await putState(accessToken, {
      bookId: fixture.secondBook,
      relationshipId: fixture.edgeId,
      state: { description: "Return to Gont", status: "active" },
    });
    const page = await listPage(accessToken, bookScope(fixture.secondBook));

    expect(idsOf(page.items)).toEqual([fixture.edgeId]);
    expect(page.items[0]?.effectiveState?.description).toBe("Return to Gont");
  });

  it("drops the edge from a book whose state was deleted", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedAuthoredEdge(accessToken);

    const removed = await authed(
      "delete",
      `${LIST_PATH}/${fixture.edgeId}/books/${fixture.firstBook}`,
      accessToken,
    );
    expect(removed.status).toBe(HttpStatus.NO_CONTENT);
    const page = await listPage(accessToken, bookScope(fixture.firstBook));

    expect(page.totalCount).toBe(0);
  });

  it("drops a deleted edge from the global character scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const fixture = await seedAuthoredEdge(accessToken);
    expect(await listIds(accessToken, characterScope(fixture.hub))).toEqual([fixture.edgeId]);

    const removed = await authed("delete", `${LIST_PATH}/${fixture.edgeId}`, accessToken);
    expect(removed.status).toBe(HttpStatus.OK);
    const page = await listPage(accessToken, characterScope(fixture.hub));

    expect(page.totalCount).toBe(0);
  });
});
