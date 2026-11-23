import type { FamilyTreeLineageView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { BookFamilyTreeViewSchema } from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";

const UNKNOWN_BOOK_ID = "00000000-0000-4000-8000-000000000000";

const EIGHT_GENERATIONS = [
  "Brandon the Builder",
  "Cregan",
  "Beron",
  "Willam",
  "Edwyle",
  "Rickard",
  "Eddard",
  "Robb",
];

type SeededLine = {
  bookId: string;
  characterIds: string[];
  lineage: FamilyTreeLineageView[];
};

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

function authed(method: "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "George R. R. Martin" }],
    ownershipStatus: "owned",
    title: "A Game of Thrones",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCharacter(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character: { name } });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createParentLink({
  bookId,
  childId,
  parentId,
  token,
}: {
  bookId: string;
  childId: string;
  parentId: string;
  token: string;
}): Promise<string> {
  const res = await authed("post", "/api/character-relationships", token).send({
    category: "family",
    directionality: "directed",
    initialBookStates: [{ bookId, status: "active" }],
    sourceCharacterId: parentId,
    targetCharacterId: childId,
    type: "biological_parent_of",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function familyTreePath(bookId: string): string {
  return `/api/books/${bookId}/character-graph/family-tree`;
}

async function linkToBook({
  bookId,
  characterIds,
  token,
}: {
  bookId: string;
  characterIds: string[];
  token: string;
}): Promise<void> {
  for (const characterId of characterIds) {
    const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
      bookProfile: {},
      characterId,
      mode: "existing",
    });
    expect(res.status).toBe(HttpStatus.CREATED);
  }
}

async function seedLine({ names, token }: { names: string[]; token: string }): Promise<SeededLine> {
  const bookId = await createBook(token);
  const characterIds: string[] = [];
  for (const name of names) {
    characterIds.push(await createCharacter(token, name));
  }
  await linkToBook({ bookId, characterIds, token });
  const lineage: FamilyTreeLineageView[] = [];
  for (const [offset, childId] of characterIds.entries()) {
    const parentId = characterIds[offset - 1];
    if (parentId === undefined) {
      continue;
    }
    const relationshipId = await createParentLink({ bookId, childId, parentId, token });
    lineage.push({ childId, kind: "biological", parentId, relationshipId });
  }
  return { bookId, characterIds, lineage };
}

function sortedLineage(lineage: FamilyTreeLineageView[]): FamilyTreeLineageView[] {
  return [...lineage].sort((left, right) =>
    left.relationshipId.localeCompare(right.relationshipId),
  );
}

describe("GET /api/books/:bookId/character-graph/family-tree", () => {
  it("returns all eight generations of a line with scope book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, characterIds, lineage } = await seedLine({
      names: EIGHT_GENERATIONS,
      token: accessToken,
    });

    const res = await authed("get", familyTreePath(bookId), accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    const body = BookFamilyTreeViewSchema.parse(res.body);
    expect(body.scope).toBe("book");
    expect(body.nodes.map((node) => node.id).sort()).toEqual([...characterIds].sort());
    expect(sortedLineage(body.lineage)).toEqual(sortedLineage(lineage));
  });

  it("returns 404 for a book that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("get", familyTreePath(UNKNOWN_BOOK_ID), accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 404 for a book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const bookId = await createBook(owner.accessToken);

    const res = await authed("get", familyTreePath(bookId), intruder.accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get(familyTreePath(UNKNOWN_BOOK_ID));

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});

describe("GET /api/books/:bookId/character-graph with projection=family_tree", () => {
  it("still returns the focused family_tree projection beside the book tree route", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const rickard = await createCharacter(accessToken, "Rickard");
    const eddard = await createCharacter(accessToken, "Eddard");
    await linkToBook({ bookId, characterIds: [rickard, eddard], token: accessToken });
    await createParentLink({ bookId, childId: eddard, parentId: rickard, token: accessToken });

    const res = await authed(
      "get",
      `/api/books/${bookId}/character-graph?projection=family_tree&focusCharacterId=${eddard}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({ focusCharacterId: eddard, projection: "family_tree" });
  });
});
