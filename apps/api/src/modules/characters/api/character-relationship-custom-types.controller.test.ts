import type {
  PaginatedCharacterRelationshipCustomTypesView,
  RelationshipDirectionality,
} from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { PaginatedCharacterRelationshipCustomTypesViewSchema } from "@app/shared";
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

const CUSTOM_TYPES = "/api/character-relationship-custom-types";
const RELATIONSHIPS = "/api/character-relationships";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SEEDED_AT = new Date("2026-03-01T10:00:00.000Z");

type CustomEdge = {
  customType: string;
  directionality: RelationshipDirectionality;
  source: string;
  target: string;
};

type SeedRow = {
  directionality: RelationshipDirectionality;
  id?: string;
  lastUsedAt: Date;
  name: string;
  normalizedName: string;
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

async function createCharacter(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character: { name } });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCustomEdge(token: string, edge: CustomEdge): Promise<string> {
  const created = await postCustomEdge(token, edge);
  expect(created.status).toBe(HttpStatus.CREATED);
  return created.body.id;
}

function customBody(edge: CustomEdge): Record<string, unknown> {
  return {
    category: "custom",
    customType: edge.customType,
    directionality: edge.directionality,
    sourceCharacterId: edge.source,
    targetCharacterId: edge.target,
    type: "custom",
  };
}

async function insertDirectedCustomEdge({
  customType,
  source,
  target,
  userId,
}: {
  customType: string;
  source: string;
  target: string;
  userId: string;
}): Promise<string> {
  const edge = await prisma.characterRelationship.create({
    data: {
      category: "custom",
      customType,
      directionality: "directed",
      sourceCharacterId: source,
      targetCharacterId: target,
      type: "custom",
      userId,
    },
    select: { id: true },
  });
  return edge.id;
}

async function listCustomTypes(
  token: string,
  query: Record<string, number | string> = {},
): Promise<PaginatedCharacterRelationshipCustomTypesView> {
  const res = await authed("get", CUSTOM_TYPES, token).query(query);
  expect(res.status).toBe(HttpStatus.OK);
  return PaginatedCharacterRelationshipCustomTypesViewSchema.parse(res.body);
}

function namesOf(page: PaginatedCharacterRelationshipCustomTypesView): string[] {
  return page.items.map((item) => item.name);
}

function numberedName(position: number): string {
  return `тип ${String(position).padStart(2, "0")}`;
}

function numberedRows(count: number): SeedRow[] {
  return Array.from({ length: count }, (_, index): SeedRow => ({
    directionality: "symmetric",
    lastUsedAt: addMinutes(SEEDED_AT, index + 1),
    name: numberedName(index + 1),
    normalizedName: numberedName(index + 1),
  }));
}

function postCustomEdge(token: string, edge: CustomEdge): request.Test {
  return authed("post", RELATIONSHIPS, token).send(customBody(edge));
}

async function seedCustomTypes(userId: string, rows: SeedRow[]): Promise<void> {
  for (const row of rows) {
    await prisma.userRelationshipCustomType.create({ data: { ...row, userId } });
  }
}

function signaturesOf(page: PaginatedCharacterRelationshipCustomTypesView): string[] {
  return page.items.map((item) => `${item.name}/${item.directionality}`);
}

describe("GET /api/character-relationship-custom-types access", () => {
  it("T09 returns 401 without a token", async () => {
    const res = await request(app.getHttpServer()).get(CUSTOM_TYPES);

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("T09 T18 lists only the current user's names, even when the query names another user's type", async () => {
    const owner = await context.registerVerifyAndLogin();
    const other = await context.registerVerifyAndLogin({ email: "other@example.com" });
    await seedCustomTypes(owner.userId, [
      {
        directionality: "symmetric",
        lastUsedAt: SEEDED_AT,
        name: "Побратими",
        normalizedName: "побратими",
      },
    ]);
    await seedCustomTypes(other.userId, [
      {
        directionality: "directed",
        lastUsedAt: addMinutes(SEEDED_AT, 1),
        name: "Суперники",
        normalizedName: "суперники",
      },
    ]);

    const own = await listCustomTypes(owner.accessToken);
    const probe = await listCustomTypes(owner.accessToken, { q: "Суперники" });

    expect(namesOf(own)).toEqual(["Побратими"]);
    expect(probe.totalCount).toBe(0);
  });

  it("T09 keeps each author's write in their own dictionary when two users use the same name", async () => {
    const owner = await context.registerVerifyAndLogin();
    const other = await context.registerVerifyAndLogin({ email: "other@example.com" });
    for (const user of [owner, other]) {
      await createCustomEdge(user.accessToken, {
        customType: "Побратими",
        directionality: "symmetric",
        source: await createCharacter(user.accessToken, "Alice"),
        target: await createCharacter(user.accessToken, "Bob"),
      });
    }

    const ownerPage = await listCustomTypes(owner.accessToken);
    const otherPage = await listCustomTypes(other.accessToken);

    expect(signaturesOf(ownerPage)).toEqual(["Побратими/symmetric"]);
    expect(signaturesOf(otherPage)).toEqual(["Побратими/symmetric"]);
    expect(ownerPage.items[0]?.id).not.toBe(otherPage.items[0]?.id);
  });
});

describe("GET /api/character-relationship-custom-types browse", () => {
  it("T05 returns the 20 most recently used names with page meta by default", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedCustomTypes(userId, numberedRows(45));

    const page = await listCustomTypes(accessToken);

    expect(page).toMatchObject({ page: 1, pagesCount: 3, pageSize: 20, totalCount: 45 });
    expect(namesOf(page)).toEqual(
      Array.from({ length: 20 }, (_, index) => numberedName(45 - index)),
    );
  });

  it("T05 walks 20, 20 and 5 names across the pages without gaps or repeats", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedCustomTypes(userId, numberedRows(45));

    const first = await listCustomTypes(accessToken, { pageNumber: 1 });
    const second = await listCustomTypes(accessToken, { pageNumber: 2 });
    const third = await listCustomTypes(accessToken, { pageNumber: 3 });
    const pages = [first, second, third];

    expect(pages.map((page) => page.items.length)).toEqual([20, 20, 5]);
    expect(new Set(pages.flatMap((page) => namesOf(page))).size).toBe(45);
    expect(namesOf(third)).toEqual(["тип 05", "тип 04", "тип 03", "тип 02", "тип 01"]);
  });

  it("orders by lastUsedAt descending and breaks ties by id ascending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedCustomTypes(userId, [
      {
        directionality: "symmetric",
        id: "20000000-0000-4000-8000-000000000000",
        lastUsedAt: SEEDED_AT,
        name: "Друге в нічиї",
        normalizedName: "друге в нічиї",
      },
      {
        directionality: "symmetric",
        id: "30000000-0000-4000-8000-000000000000",
        lastUsedAt: addMinutes(SEEDED_AT, 1),
        name: "Найсвіжіше",
        normalizedName: "найсвіжіше",
      },
      {
        directionality: "symmetric",
        id: "10000000-0000-4000-8000-000000000000",
        lastUsedAt: SEEDED_AT,
        name: "Перше в нічиї",
        normalizedName: "перше в нічиї",
      },
    ]);

    const page = await listCustomTypes(accessToken);

    expect(namesOf(page)).toEqual(["Найсвіжіше", "Перше в нічиї", "Друге в нічиї"]);
  });

  it("treats a blank q as browsing", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedCustomTypes(userId, numberedRows(3));

    const page = await listCustomTypes(accessToken, { q: "   " });

    expect(namesOf(page)).toEqual(["тип 03", "тип 02", "тип 01"]);
  });
});

describe("GET /api/character-relationship-custom-types search", () => {
  it("T04 finds a name inside the whole dictionary that browsing shows only past the first page", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedCustomTypes(userId, [
      ...numberedRows(25),
      {
        directionality: "directed",
        lastUsedAt: SEEDED_AT,
        name: "Названі брати",
        normalizedName: "названі брати",
      },
    ]);

    const browse = await listCustomTypes(accessToken);
    const found = await listCustomTypes(accessToken, { q: "брати" });

    expect(namesOf(browse)).not.toContain("Названі брати");
    expect(found).toMatchObject({ page: 1, pagesCount: 1, totalCount: 1 });
    expect(namesOf(found)).toEqual(["Названі брати"]);
  });

  it("T08 matches regardless of case and repeated spaces in q", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedCustomTypes(userId, [
      {
        directionality: "directed",
        lastUsedAt: SEEDED_AT,
        name: "Названі брати",
        normalizedName: "названі брати",
      },
      {
        directionality: "symmetric",
        lastUsedAt: addMinutes(SEEDED_AT, 1),
        name: "Побратими",
        normalizedName: "побратими",
      },
    ]);

    const found = await listCustomTypes(accessToken, { q: "  НАЗВАНІ   Брати " });

    expect(namesOf(found)).toEqual(["Названі брати"]);
  });

  it("narrows the list to one directionality", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedCustomTypes(userId, [
      {
        directionality: "symmetric",
        lastUsedAt: addMinutes(SEEDED_AT, 1),
        name: "Побратими",
        normalizedName: "побратими",
      },
      {
        directionality: "directed",
        lastUsedAt: SEEDED_AT,
        name: "Наставник",
        normalizedName: "наставник",
      },
    ]);

    const directed = await listCustomTypes(accessToken, { directionality: "directed" });

    expect(directed.totalCount).toBe(1);
    expect(signaturesOf(directed)).toEqual(["Наставник/directed"]);
  });
});

describe("custom type dictionary writes on POST /api/character-relationships", () => {
  it("T01 adds the name of a successful custom POST", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createCustomEdge(accessToken, {
      customType: "Старі друзі",
      directionality: "directed",
      source: await createCharacter(accessToken, "Alice"),
      target: await createCharacter(accessToken, "Bob"),
    });

    const page = await listCustomTypes(accessToken);

    expect(page).toEqual({
      items: [{ directionality: "directed", id: expect.stringMatching(UUID), name: "Старі друзі" }],
      page: 1,
      pagesCount: 1,
      pageSize: 20,
      totalCount: 1,
    });
  });

  it("T02 adds nothing for a standard type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await authed("post", RELATIONSHIPS, accessToken).send({
      category: "social",
      directionality: "symmetric",
      sourceCharacterId: await createCharacter(accessToken, "Alice"),
      targetCharacterId: await createCharacter(accessToken, "Bob"),
      type: "friend_of",
    });
    expect(created.status).toBe(HttpStatus.CREATED);

    const page = await listCustomTypes(accessToken);

    expect(page.totalCount).toBe(0);
  });

  it("T06 keeps one entry per directionality for the same name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    await createCustomEdge(accessToken, {
      customType: "Побратими",
      directionality: "symmetric",
      source: alice,
      target: bob,
    });
    await createCustomEdge(accessToken, {
      customType: "Побратими",
      directionality: "directed",
      source: alice,
      target: carol,
    });

    const page = await listCustomTypes(accessToken);

    expect(page.totalCount).toBe(2);
    expect(signaturesOf(page).sort()).toEqual(["Побратими/directed", "Побратими/symmetric"]);
  });

  it("T08 reuses the entry for a differently cased name and keeps the first display name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const alice = await createCharacter(accessToken, "Alice");
    await createCustomEdge(accessToken, {
      customType: "Побратими",
      directionality: "symmetric",
      source: alice,
      target: await createCharacter(accessToken, "Bob"),
    });
    await createCustomEdge(accessToken, {
      customType: "ПОБРАТИМИ",
      directionality: "symmetric",
      source: alice,
      target: await createCharacter(accessToken, "Carol"),
    });

    const page = await listCustomTypes(accessToken);

    expect(signaturesOf(page)).toEqual(["Побратими/symmetric"]);
  });

  it("T07 touches only the entry of the posted directionality", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedCustomTypes(userId, [
      {
        directionality: "symmetric",
        lastUsedAt: SEEDED_AT,
        name: "Побратими",
        normalizedName: "побратими",
      },
      {
        directionality: "symmetric",
        lastUsedAt: addMinutes(SEEDED_AT, 1),
        name: "Інше",
        normalizedName: "інше",
      },
    ]);
    await createCustomEdge(accessToken, {
      customType: "Побратими",
      directionality: "directed",
      source: await createCharacter(accessToken, "Alice"),
      target: await createCharacter(accessToken, "Bob"),
    });

    const page = await listCustomTypes(accessToken);

    expect(signaturesOf(page)).toEqual([
      "Побратими/directed",
      "Інше/symmetric",
      "Побратими/symmetric",
    ]);
  });

  it("T10 adds nothing when the custom edge is a duplicate", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    await insertDirectedCustomEdge({ customType: "Побратими", source: alice, target: bob, userId });

    const duplicate = await postCustomEdge(accessToken, {
      customType: "Побратими",
      directionality: "directed",
      source: alice,
      target: bob,
    });
    const page = await listCustomTypes(accessToken);

    expect(duplicate.status).toBe(HttpStatus.CONFLICT);
    expect(duplicate.body.code).toBe("relationship_duplicate");
    expect(page.totalCount).toBe(0);
  });

  it("T10 adds nothing when book membership rejects the custom edge", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const book = await authed("post", "/api/books", accessToken).send({
      authors: [{ name: "Ursula K. Le Guin" }],
      ownershipStatus: "owned",
      title: "A Wizard of Earthsea",
    });
    expect(book.status).toBe(HttpStatus.CREATED);
    const bookId: string = book.body.id;
    const alice = await createCharacter(accessToken, "Alice");
    const linked = await authed("post", `/api/books/${bookId}/characters`, accessToken).send({
      bookProfile: {},
      characterId: alice,
      mode: "existing",
    });
    expect(linked.status).toBe(HttpStatus.CREATED);

    const rejected = await authed("post", RELATIONSHIPS, accessToken).send({
      ...customBody({
        customType: "Побратими",
        directionality: "symmetric",
        source: alice,
        target: await createCharacter(accessToken, "Bob"),
      }),
      initialBookStates: [{ bookId, status: "active" }],
    });
    const page = await listCustomTypes(accessToken);

    expect(rejected.status).toBe(HttpStatus.BAD_REQUEST);
    expect(rejected.body.code).toBe("relationship_book_context_invalid");
    expect(page.totalCount).toBe(0);
  });

  it("T17 leaves one entry after concurrent identical custom POSTs on different pairs", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const alice = await createCharacter(accessToken, "Alice");
    const bob = await createCharacter(accessToken, "Bob");
    const carol = await createCharacter(accessToken, "Carol");
    const dave = await createCharacter(accessToken, "Dave");

    const [first, second] = await Promise.all([
      postCustomEdge(accessToken, {
        customType: "Побратими",
        directionality: "symmetric",
        source: alice,
        target: bob,
      }),
      postCustomEdge(accessToken, {
        customType: "Побратими",
        directionality: "symmetric",
        source: carol,
        target: dave,
      }),
    ]);
    const page = await listCustomTypes(accessToken);

    expect([first.status, second.status]).toEqual([HttpStatus.CREATED, HttpStatus.CREATED]);
    expect(signaturesOf(page)).toEqual(["Побратими/symmetric"]);
  });
});

describe("custom type dictionary writes on PATCH and DELETE", () => {
  async function seedLegacyEdgeWithOlderEntry(): Promise<{ accessToken: string; edgeId: string }> {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const edgeId = await insertDirectedCustomEdge({
      customType: "Побратими",
      source: await createCharacter(accessToken, "Alice"),
      target: await createCharacter(accessToken, "Bob"),
      userId,
    });
    await seedCustomTypes(userId, [
      {
        directionality: "directed",
        lastUsedAt: SEEDED_AT,
        name: "Побратими",
        normalizedName: "побратими",
      },
      {
        directionality: "directed",
        lastUsedAt: addMinutes(SEEDED_AT, 1),
        name: "Суперники",
        normalizedName: "суперники",
      },
    ]);
    return { accessToken, edgeId };
  }

  it("records the name with the edge's directionality when PATCH switches a standard edge to custom", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await authed("post", RELATIONSHIPS, accessToken).send({
      category: "social",
      directionality: "symmetric",
      sourceCharacterId: await createCharacter(accessToken, "Alice"),
      targetCharacterId: await createCharacter(accessToken, "Bob"),
      type: "friend_of",
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    const edgeId: string = created.body.id;

    const patched = await authed("patch", `${RELATIONSHIPS}/${edgeId}`, accessToken).send({
      category: "custom",
      customType: "Побратими",
      type: "custom",
    });
    const page = await listCustomTypes(accessToken);

    expect(patched.status).toBe(HttpStatus.OK);
    expect(signaturesOf(page)).toEqual(["Побратими/symmetric"]);
  });

  it("T03 adds the new name when PATCH renames a custom edge and keeps the old one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const edgeId = await createCustomEdge(accessToken, {
      customType: "Побратими",
      directionality: "directed",
      source: await createCharacter(accessToken, "Alice"),
      target: await createCharacter(accessToken, "Bob"),
    });

    const patched = await authed("patch", `${RELATIONSHIPS}/${edgeId}`, accessToken).send({
      customType: "Названі брати",
    });
    const page = await listCustomTypes(accessToken);

    expect(patched.status).toBe(HttpStatus.OK);
    expect(signaturesOf(page).sort()).toEqual(["Названі брати/directed", "Побратими/directed"]);
  });

  it("keeps lastUsedAt on an unrelated PATCH of a custom edge", async () => {
    const { accessToken, edgeId } = await seedLegacyEdgeWithOlderEntry();

    const patched = await authed("patch", `${RELATIONSHIPS}/${edgeId}`, accessToken).send({
      isCanonical: true,
    });
    const page = await listCustomTypes(accessToken);

    expect(patched.status).toBe(HttpStatus.OK);
    expect(namesOf(page)).toEqual(["Суперники", "Побратими"]);
  });

  it("keeps lastUsedAt when PATCH re-sends the same custom name", async () => {
    const { accessToken, edgeId } = await seedLegacyEdgeWithOlderEntry();

    const patched = await authed("patch", `${RELATIONSHIPS}/${edgeId}`, accessToken).send({
      customType: "Побратими",
    });
    const page = await listCustomTypes(accessToken);

    expect(patched.status).toBe(HttpStatus.OK);
    expect(namesOf(page)).toEqual(["Суперники", "Побратими"]);
  });

  it("T03 keeps the entry after its edge is deleted", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const edgeId = await createCustomEdge(accessToken, {
      customType: "Побратими",
      directionality: "symmetric",
      source: await createCharacter(accessToken, "Alice"),
      target: await createCharacter(accessToken, "Bob"),
    });

    const removed = await authed("delete", `${RELATIONSHIPS}/${edgeId}`, accessToken);
    const page = await listCustomTypes(accessToken);

    expect(removed.status).toBe(HttpStatus.OK);
    expect(signaturesOf(page)).toEqual(["Побратими/symmetric"]);
  });
});
