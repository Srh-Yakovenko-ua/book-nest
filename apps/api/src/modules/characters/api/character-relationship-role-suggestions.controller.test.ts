import type {
  CharacterRelationshipDetailsView,
  PaginatedCharacterRelationshipRoleSuggestionsView,
  RelationshipDirectionality,
} from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import {
  CharacterRelationshipDetailsViewSchema,
  PaginatedCharacterRelationshipCustomTypesViewSchema,
  PaginatedCharacterRelationshipRoleSuggestionsViewSchema,
} from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import { addMinutes } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";

const ROLE_SUGGESTIONS = "/api/character-relationship-role-suggestions";
const CUSTOM_TYPES = "/api/character-relationship-custom-types";
const RELATIONSHIPS = "/api/character-relationships";
const SEEDED_AT = new Date("2026-03-01T10:00:00.000Z");

type CustomEdgeSeed = {
  customType: string;
  directionality: RelationshipDirectionality;
  pair: Pair;
};

type Pair = { source: string; target: string };

type Roles = { sourceLabel?: string; targetLabel?: string };

type SeedRow = {
  id?: string;
  label: string;
  lastUsedAt: Date;
  normalizedLabel: string;
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, CharactersModule]);
  app = context.app;
  prisma = app.get(PrismaService);
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

async function createBookWithOnlySourceLinked(token: string, pair: Pair): Promise<string> {
  const book = await authed("post", "/api/books", token).send({
    authors: [{ name: "Ursula K. Le Guin" }],
    ownershipStatus: "owned",
    title: "A Wizard of Earthsea",
  });
  expect(book.status).toBe(HttpStatus.CREATED);
  const bookId: string = book.body.id;
  const linked = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: {},
    characterId: pair.source,
    mode: "existing",
  });
  expect(linked.status).toBe(HttpStatus.CREATED);
  return bookId;
}

async function createCharacter(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character: { name } });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCustomEdge(token: string, edge: CustomEdgeSeed): Promise<string> {
  const res = await authed("post", RELATIONSHIPS, token).send({
    category: "custom",
    customType: edge.customType,
    directionality: edge.directionality,
    sourceCharacterId: edge.pair.source,
    targetCharacterId: edge.pair.target,
    type: "custom",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createMentorship(token: string, pair: Pair, roles: Roles = {}): Promise<string> {
  const res = await postMentorship(token, pair, roles);
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createPair(
  token: string,
  names: [string, string] = ["Alice", "Bob"],
): Promise<Pair> {
  const [source, target] = names;
  return {
    source: await createCharacter(token, source),
    target: await createCharacter(token, target),
  };
}

async function customTypeSignatures(
  token: string,
  query: Record<string, string> = {},
): Promise<string[]> {
  const res = await authed("get", CUSTOM_TYPES, token).query(query);
  expect(res.status).toBe(HttpStatus.OK);
  return PaginatedCharacterRelationshipCustomTypesViewSchema.parse(res.body).items.map(
    (item) => `${item.name}/${item.directionality}`,
  );
}

function labelsOf(page: PaginatedCharacterRelationshipRoleSuggestionsView): string[] {
  return page.items.map((item) => item.label);
}

async function listRoles(
  token: string,
  query: Record<string, number | string> = {},
): Promise<PaginatedCharacterRelationshipRoleSuggestionsView> {
  const res = await authed("get", ROLE_SUGGESTIONS, token).query(query);
  expect(res.status).toBe(HttpStatus.OK);
  return PaginatedCharacterRelationshipRoleSuggestionsViewSchema.parse(res.body);
}

function numberedLabel(position: number): string {
  return `role ${String(position).padStart(2, "0")}`;
}

function numberedRows(count: number): SeedRow[] {
  return Array.from({ length: count }, (_, index): SeedRow => ({
    label: numberedLabel(index + 1),
    lastUsedAt: addMinutes(SEEDED_AT, index + 1),
    normalizedLabel: numberedLabel(index + 1),
  }));
}

function patchEdge(token: string, edgeId: string, body: Record<string, unknown>): request.Test {
  return authed("patch", `${RELATIONSHIPS}/${edgeId}`, token).send(body);
}

function postMentorship(token: string, pair: Pair, roles: Roles = {}): request.Test {
  return authed("post", RELATIONSHIPS, token).send({
    category: "mentorship",
    directionality: "directed",
    sourceCharacterId: pair.source,
    targetCharacterId: pair.target,
    type: "mentor_of",
    ...roles,
  });
}

async function readForEdit(
  token: string,
  edgeId: string,
): Promise<CharacterRelationshipDetailsView> {
  const res = await authed("get", `${RELATIONSHIPS}/${edgeId}/edit`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return CharacterRelationshipDetailsViewSchema.parse(res.body);
}

async function seedMentorAndNewerRival(userId: string): Promise<void> {
  await seedRoles(userId, [
    { label: "Mentor", lastUsedAt: SEEDED_AT, normalizedLabel: "mentor" },
    { label: "Rival", lastUsedAt: addMinutes(SEEDED_AT, 1), normalizedLabel: "rival" },
  ]);
}

async function seedRoles(userId: string, rows: SeedRow[]): Promise<void> {
  for (const row of rows) {
    await prisma.userRelationshipRoleSuggestion.create({ data: { ...row, userId } });
  }
}

describe("GET /api/character-relationship-role-suggestions access", () => {
  it("E12 returns 401 without a token, so the dictionary is never public", async () => {
    const res = await request(app.getHttpServer()).get(ROLE_SUGGESTIONS);

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("E04 lists only the current user's roles, even when q names another user's role", async () => {
    const owner = await context.registerVerifyAndLogin();
    const other = await context.registerVerifyAndLogin({ email: "other@example.com" });
    await seedRoles(owner.userId, [
      { label: "Mentor", lastUsedAt: SEEDED_AT, normalizedLabel: "mentor" },
    ]);
    await seedRoles(other.userId, [
      { label: "Archmage", lastUsedAt: addMinutes(SEEDED_AT, 1), normalizedLabel: "archmage" },
    ]);

    const own = await listRoles(owner.accessToken);
    const probe = await listRoles(owner.accessToken, { q: "Archmage" });

    expect(labelsOf(own)).toEqual(["Mentor"]);
    expect(probe.totalCount).toBe(0);
  });

  it("E04 keeps each user's PATCHed role in that user's own dictionary", async () => {
    const owner = await context.registerVerifyAndLogin();
    const other = await context.registerVerifyAndLogin({ email: "other@example.com" });
    for (const user of [owner, other]) {
      const edgeId = await createMentorship(user.accessToken, await createPair(user.accessToken));
      const patched = await patchEdge(user.accessToken, edgeId, { sourceLabel: "Mentor" });
      expect(patched.status).toBe(HttpStatus.OK);
    }

    const ownerPage = await listRoles(owner.accessToken);
    const otherPage = await listRoles(other.accessToken);

    expect(labelsOf(ownerPage)).toEqual(["Mentor"]);
    expect(labelsOf(otherPage)).toEqual(["Mentor"]);
    expect(ownerPage.items[0]?.id).not.toBe(otherPage.items[0]?.id);
  });

  it("E04 T13 answers 404 to a PATCH of another user's edge and records no role or name for anyone", async () => {
    const owner = await context.registerVerifyAndLogin();
    const other = await context.registerVerifyAndLogin({ email: "other@example.com" });
    const edgeId = await createCustomEdge(owner.accessToken, {
      customType: "Liege",
      directionality: "directed",
      pair: await createPair(owner.accessToken),
    });

    const patched = await patchEdge(other.accessToken, edgeId, {
      customType: "Overlord",
      sourceLabel: "Vassal",
    });

    expect(patched.status).toBe(HttpStatus.NOT_FOUND);
    expect((await listRoles(owner.accessToken)).totalCount).toBe(0);
    expect((await listRoles(other.accessToken)).totalCount).toBe(0);
    expect(await customTypeSignatures(owner.accessToken)).toEqual(["Liege/directed"]);
    expect(await customTypeSignatures(other.accessToken)).toEqual([]);
  });
});

describe("GET /api/character-relationship-role-suggestions browse", () => {
  it("E06 returns the 20 most recently used roles with page meta by default", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedRoles(userId, numberedRows(45));

    const page = await listRoles(accessToken);

    expect(page).toMatchObject({ page: 1, pagesCount: 3, pageSize: 20, totalCount: 45 });
    expect(labelsOf(page)).toEqual(
      Array.from({ length: 20 }, (_, index) => numberedLabel(45 - index)),
    );
  });

  it("E06 walks 20, 20 and 5 roles across the pages without gaps or repeats", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedRoles(userId, numberedRows(45));

    const first = await listRoles(accessToken, { pageNumber: 1 });
    const second = await listRoles(accessToken, { pageNumber: 2 });
    const third = await listRoles(accessToken, { pageNumber: 3 });
    const pages = [first, second, third];

    expect(pages.map((page) => page.items.length)).toEqual([20, 20, 5]);
    expect(new Set(pages.flatMap((page) => labelsOf(page))).size).toBe(45);
    expect(labelsOf(third)).toEqual(["role 05", "role 04", "role 03", "role 02", "role 01"]);
  });

  it("orders by lastUsedAt descending and breaks ties by id ascending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedRoles(userId, [
      {
        id: "20000000-0000-4000-8000-000000000000",
        label: "Second in tie",
        lastUsedAt: SEEDED_AT,
        normalizedLabel: "second in tie",
      },
      {
        id: "30000000-0000-4000-8000-000000000000",
        label: "Freshest",
        lastUsedAt: addMinutes(SEEDED_AT, 1),
        normalizedLabel: "freshest",
      },
      {
        id: "10000000-0000-4000-8000-000000000000",
        label: "First in tie",
        lastUsedAt: SEEDED_AT,
        normalizedLabel: "first in tie",
      },
    ]);

    const page = await listRoles(accessToken);

    expect(labelsOf(page)).toEqual(["Freshest", "First in tie", "Second in tie"]);
  });

  it("treats a blank q as browsing", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedRoles(userId, numberedRows(3));

    const page = await listRoles(accessToken, { q: "   " });

    expect(labelsOf(page)).toEqual(["role 03", "role 02", "role 01"]);
  });

  it("returns 400 with a q error for a q longer than 120 characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("get", ROLE_SUGGESTIONS, accessToken).query({ q: "x".repeat(121) });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "q" })]),
    );
  });
});

describe("GET /api/character-relationship-role-suggestions search", () => {
  it("E07 finds a role inside the whole dictionary that browsing shows only past the first page", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedRoles(userId, [
      ...numberedRows(25),
      { label: "Sworn protector", lastUsedAt: SEEDED_AT, normalizedLabel: "sworn protector" },
    ]);

    const browsed = await listRoles(accessToken);
    const found = await listRoles(accessToken, { q: "protector" });

    expect(labelsOf(browsed)).not.toContain("Sworn protector");
    expect(found).toMatchObject({ page: 1, pagesCount: 1, totalCount: 1 });
    expect(labelsOf(found)).toEqual(["Sworn protector"]);
  });

  it("E05 matches regardless of case and repeated spaces in q", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedRoles(userId, [
      { label: "Sworn protector", lastUsedAt: SEEDED_AT, normalizedLabel: "sworn protector" },
      { label: "Mentor", lastUsedAt: addMinutes(SEEDED_AT, 1), normalizedLabel: "mentor" },
    ]);

    const found = await listRoles(accessToken, { q: "  SWORN   Prot " });

    expect(labelsOf(found)).toEqual(["Sworn protector"]);
  });

  it("treats a percent sign in q as a literal character", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedRoles(userId, [
      { label: "100% loyal", lastUsedAt: SEEDED_AT, normalizedLabel: "100% loyal" },
      { label: "Mentor", lastUsedAt: addMinutes(SEEDED_AT, 1), normalizedLabel: "mentor" },
    ]);

    const found = await listRoles(accessToken, { q: "%" });

    expect(labelsOf(found)).toEqual(["100% loyal"]);
  });
});

describe("role dictionary writes on PATCH /api/character-relationships/:id", () => {
  it("E02 adds both roles of a successful PATCH with collapsed display labels", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const edgeId = await createMentorship(accessToken, await createPair(accessToken));

    const patched = await patchEdge(accessToken, edgeId, {
      sourceLabel: "Mentor",
      targetLabel: "  Young   Apprentice ",
    });
    const page = await listRoles(accessToken);

    expect(patched.status).toBe(HttpStatus.OK);
    expect(labelsOf(page).sort()).toEqual(["Mentor", "Young Apprentice"]);
  });

  it("E05 reuses the entry of a differently cased role, keeps its display label and moves it to the top", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedMentorAndNewerRival(userId);
    const edgeId = await createMentorship(accessToken, await createPair(accessToken));

    const patched = await patchEdge(accessToken, edgeId, { sourceLabel: "  MENTOR " });
    const page = await listRoles(accessToken);

    expect(patched.status).toBe(HttpStatus.OK);
    expect(page.totalCount).toBe(2);
    expect(labelsOf(page)).toEqual(["Mentor", "Rival"]);
  });

  it("E01 keeps the spelling the PATCH sent on the edge instead of the dictionary spelling", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedMentorAndNewerRival(userId);
    const edgeId = await createMentorship(accessToken, await createPair(accessToken), {
      targetLabel: "Pupil",
    });

    const patched = await patchEdge(accessToken, edgeId, { sourceLabel: "MENTOR" });
    const edit = await readForEdit(accessToken, edgeId);

    expect(patched.status).toBe(HttpStatus.OK);
    expect(edit).toMatchObject({ sourceLabel: "MENTOR", targetLabel: "Pupil" });
  });

  it("E03 keeps both roles in the dictionary after a PATCH clears them from the edge", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const edgeId = await createMentorship(accessToken, await createPair(accessToken));
    const named = await patchEdge(accessToken, edgeId, {
      sourceLabel: "Mentor",
      targetLabel: "Pupil",
    });
    expect(named.status).toBe(HttpStatus.OK);

    const cleared = await patchEdge(accessToken, edgeId, { sourceLabel: null, targetLabel: "" });
    const page = await listRoles(accessToken);

    expect(cleared.status).toBe(HttpStatus.OK);
    expect(cleared.body).toMatchObject({ sourceLabel: null, targetLabel: null });
    expect(labelsOf(page).sort()).toEqual(["Mentor", "Pupil"]);
  });

  it("keeps lastUsedAt on an unrelated PATCH of an edge that has a role", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedMentorAndNewerRival(userId);
    const edgeId = await createMentorship(accessToken, await createPair(accessToken), {
      sourceLabel: "Mentor",
    });

    const patched = await patchEdge(accessToken, edgeId, { isCanonical: true });
    const page = await listRoles(accessToken);

    expect(patched.status).toBe(HttpStatus.OK);
    expect(labelsOf(page)).toEqual(["Rival", "Mentor"]);
  });

  it("keeps lastUsedAt when a PATCH re-sends the stored role", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedMentorAndNewerRival(userId);
    const edgeId = await createMentorship(accessToken, await createPair(accessToken), {
      sourceLabel: "Mentor",
    });

    const patched = await patchEdge(accessToken, edgeId, { sourceLabel: "Mentor" });
    const page = await listRoles(accessToken);

    expect(patched.status).toBe(HttpStatus.OK);
    expect(labelsOf(page)).toEqual(["Rival", "Mentor"]);
  });

  it("leaves one entry after concurrent PATCHes send the same role on different edges", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstEdge = await createMentorship(accessToken, await createPair(accessToken));
    const secondEdge = await createMentorship(
      accessToken,
      await createPair(accessToken, ["Carol", "Dave"]),
    );

    const [first, second] = await Promise.all([
      patchEdge(accessToken, firstEdge, { sourceLabel: "Mentor" }),
      patchEdge(accessToken, secondEdge, { sourceLabel: "Mentor" }),
    ]);
    const page = await listRoles(accessToken);

    expect([first.status, second.status]).toEqual([HttpStatus.OK, HttpStatus.OK]);
    expect(labelsOf(page)).toEqual(["Mentor"]);
  });

  it("E03 keeps the role after the edge that used it is deleted", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const edgeId = await createMentorship(accessToken, await createPair(accessToken));
    const patched = await patchEdge(accessToken, edgeId, { sourceLabel: "Mentor" });
    expect(patched.status).toBe(HttpStatus.OK);

    const removed = await authed("delete", `${RELATIONSHIPS}/${edgeId}`, accessToken);
    const page = await listRoles(accessToken);

    expect(removed.status).toBe(HttpStatus.OK);
    expect(labelsOf(page)).toEqual(["Mentor"]);
  });

  it("E09 adds no role when the PATCH is rejected as a duplicate", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const pair = await createPair(accessToken);
    await createCustomEdge(accessToken, { customType: "Liege", directionality: "directed", pair });
    const oathEdge = await createCustomEdge(accessToken, {
      customType: "Oath",
      directionality: "directed",
      pair,
    });

    const rejected = await patchEdge(accessToken, oathEdge, {
      customType: "Liege",
      sourceLabel: "Vassal",
    });
    const page = await listRoles(accessToken);

    expect(rejected.status).toBe(HttpStatus.CONFLICT);
    expect(rejected.body.code).toBe("relationship_duplicate");
    expect(page.totalCount).toBe(0);
  });

  it("adds no role when POST creates an edge with both roles", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const created = await postMentorship(accessToken, await createPair(accessToken), {
      sourceLabel: "Mentor",
      targetLabel: "Pupil",
    });
    const page = await listRoles(accessToken);

    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body).toMatchObject({ sourceLabel: "Mentor", targetLabel: "Pupil" });
    expect(page.totalCount).toBe(0);
  });
});

describe("custom type and role dictionaries during edit", () => {
  it("T12 records a renamed symmetric custom edge under symmetric only and keeps the edge symmetric", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const edgeId = await createCustomEdge(accessToken, {
      customType: "Sworn kin",
      directionality: "symmetric",
      pair: await createPair(accessToken),
    });

    const patched = await patchEdge(accessToken, edgeId, { customType: "Blood oath" });
    const symmetric = await customTypeSignatures(accessToken, { directionality: "symmetric" });
    const directed = await customTypeSignatures(accessToken, { directionality: "directed" });

    expect(patched.status).toBe(HttpStatus.OK);
    expect(patched.body).toMatchObject({ customType: "Blood oath", directionality: "symmetric" });
    expect(symmetric.sort()).toEqual(["Blood oath/symmetric", "Sworn kin/symmetric"]);
    expect(directed).toEqual([]);
  });

  it("T12 T13 rejects a PATCH that sends a directionality and records nothing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const edgeId = await createCustomEdge(accessToken, {
      customType: "Sworn kin",
      directionality: "symmetric",
      pair: await createPair(accessToken),
    });

    const rejected = await patchEdge(accessToken, edgeId, {
      customType: "Blood oath",
      directionality: "directed",
      sourceLabel: "Kinsman",
    });
    const edit = await readForEdit(accessToken, edgeId);

    expect(rejected.status).toBe(HttpStatus.BAD_REQUEST);
    expect(edit).toMatchObject({ customType: "Sworn kin", directionality: "symmetric" });
    expect(await customTypeSignatures(accessToken)).toEqual(["Sworn kin/symmetric"]);
    expect((await listRoles(accessToken)).totalCount).toBe(0);
  });

  it("T14 keeps what a successful PATCH recorded when the following book state PUT fails", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const pair = await createPair(accessToken);
    const bookId = await createBookWithOnlySourceLinked(accessToken, pair);
    const edgeId = await createCustomEdge(accessToken, {
      customType: "Liege",
      directionality: "directed",
      pair,
    });

    const patched = await patchEdge(accessToken, edgeId, {
      customType: "Overlord",
      sourceLabel: "Vassal",
    });
    const statePath = `${RELATIONSHIPS}/${edgeId}/books/${bookId}`;
    const put = await authed("put", statePath, accessToken).send({ status: "active" });
    const edit = await readForEdit(accessToken, edgeId);
    const roles = await listRoles(accessToken);
    const directed = await customTypeSignatures(accessToken, { directionality: "directed" });

    expect(patched.status).toBe(HttpStatus.OK);
    expect(put.status).toBe(HttpStatus.BAD_REQUEST);
    expect(put.body.code).toBe("relationship_book_context_invalid");
    expect(edit).toMatchObject({ bookStates: [], customType: "Overlord", sourceLabel: "Vassal" });
    expect(labelsOf(roles)).toEqual(["Vassal"]);
    expect(directed.sort()).toEqual(["Liege/directed", "Overlord/directed"]);
  });
});
