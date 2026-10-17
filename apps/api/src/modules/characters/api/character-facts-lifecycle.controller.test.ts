import type { CharacterFactView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { CharacterFactViewSchema, PaginatedCharacterFactsSchema } from "@app/shared";
import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CharacterFactModel } from "../../../generated/prisma/models.js";
import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { BookLifecycleService } from "../../books/application/book-lifecycle.service.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { BOOK_PURGE_QUEUE_NAME } from "../../books/domain/book-purge.js";
import { StoragePort } from "../../media/domain/storage.port.js";
import { CharacterLifecycleService } from "../application/character-lifecycle.service.js";
import { CharactersModule } from "../characters.module.js";
import { CHARACTER_PURGE_QUEUE_NAME } from "../domain/character-purge.js";

type AppearanceIds = { bookId: string; characterId: string };

const FIXTURE = {
  characterNotFound: "character_not_found",
  factInputs: [
    { chapter: "Chapter 3", page: 42, text: "Keeps a cloak of invisibility", title: "Cloak" },
    { text: "Speaks Parseltongue", title: "Parselmouth" },
  ],
} as const;

const queueStub = {
  add: (): Promise<void> => Promise.resolve(),
  remove: (): Promise<void> => Promise.resolve(),
};

const storageStub = {
  delete: (): Promise<void> => Promise.resolve(),
  get: (): Promise<Buffer> => Promise.resolve(Buffer.alloc(0)),
  publicUrl: (key: string): string => `http://test.local/${key}`,
  put: (): Promise<void> => Promise.resolve(),
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let characterLifecycle: CharacterLifecycleService;
let bookLifecycle: BookLifecycleService;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule, CharactersModule],
    [
      { provide: StoragePort, useValue: storageStub },
      { provide: getQueueToken(CHARACTER_PURGE_QUEUE_NAME), useValue: queueStub },
      { provide: getQueueToken(BOOK_PURGE_QUEUE_NAME), useValue: queueStub },
    ],
  );
  app = context.app;
  prisma = app.get(PrismaService);
  characterLifecycle = app.get(CharacterLifecycleService);
  const bookLifecycleModule = await import("../../books/application/book-lifecycle.service.js");
  bookLifecycle = app.get(bookLifecycleModule.BookLifecycleService);
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
  method: "delete" | "get" | "patch" | "post",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function backdateBookPurge(bookId: string): Promise<void> {
  await prisma.book.update({
    data: TRASH_RETENTION.stamp(subDays(new Date(), TRASH_RETENTION.days + 1)),
    where: { id: bookId },
  });
}

async function backdateCharacterPurge(characterId: string): Promise<void> {
  await prisma.character.update({
    data: TRASH_RETENTION.stamp(subDays(new Date(), TRASH_RETENTION.days + 1)),
    where: { id: characterId },
  });
}

function byId<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

async function createBook(token: string, title: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "J. K. Rowling" }],
    ownershipStatus: "owned",
    title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCharacterInBook(token: string, bookId: string, name: string): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "central" },
    character: { name },
    mode: "new",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function expectCharacterNotFound(res: request.Response): void {
  expect(res.status).toBe(HttpStatus.NOT_FOUND);
  expect(res.body).toMatchObject({ code: FIXTURE.characterNotFound });
}

async function factRows(facts: readonly CharacterFactView[]): Promise<CharacterFactModel[]> {
  return prisma.characterFact.findMany({
    orderBy: { id: "asc" },
    where: { id: { in: facts.map((fact) => fact.id) } },
  });
}

function factsPath({ bookId, characterId }: AppearanceIds): string {
  return `/api/books/${bookId}/characters/${characterId}/facts`;
}

async function linkCharacter(token: string, bookId: string, characterId: string): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "supporting" },
    characterId,
    mode: "existing",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
}

async function listFacts(token: string, ids: AppearanceIds): Promise<CharacterFactView[]> {
  const res = await authed("get", factsPath(ids), token);
  expect(res.status).toBe(HttpStatus.OK);
  return PaginatedCharacterFactsSchema.parse(res.body).items;
}

async function postFact(
  token: string,
  ids: AppearanceIds,
  body: Record<string, unknown>,
): Promise<CharacterFactView> {
  const res = await authed("post", factsPath(ids), token).send(body);
  expect(res.status).toBe(HttpStatus.CREATED);
  return CharacterFactViewSchema.parse(res.body);
}

async function postStandardFacts(token: string, ids: AppearanceIds): Promise<CharacterFactView[]> {
  const created: CharacterFactView[] = [];
  for (const input of FIXTURE.factInputs) {
    created.push(await postFact(token, ids, input));
  }
  return created;
}

async function seedAppearance(token: string): Promise<AppearanceIds> {
  const bookId = await createBook(token, "Chamber of Secrets");
  const characterId = await createCharacterInBook(token, bookId, "Harry Potter");
  return { bookId, characterId };
}

async function seedTwoBookCharacter(
  token: string,
): Promise<{ first: AppearanceIds; second: AppearanceIds }> {
  const first = await seedAppearance(token);
  const secondBookId = await createBook(token, "Prisoner of Azkaban");
  await linkCharacter(token, secondBookId, first.characterId);
  return { first, second: { bookId: secondBookId, characterId: first.characterId } };
}

async function softDeleteBook(token: string, bookId: string): Promise<void> {
  const res = await authed("delete", `/api/books/${bookId}`, token);
  expect(res.status).toBe(HttpStatus.OK);
}

async function softDeleteCharacter(token: string, characterId: string): Promise<void> {
  const res = await authed("delete", `/api/characters/${characterId}`, token).query({
    confirm: "true",
  });
  expect(res.status).toBe(HttpStatus.OK);
}

describe("character soft delete and restore", () => {
  it("answers 404 on the facts list while the character is trashed and keeps every fact row unchanged", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const facts = await postStandardFacts(accessToken, ids);
    const rowsBefore = await factRows(facts);

    await softDeleteCharacter(accessToken, ids.characterId);

    expectCharacterNotFound(await authed("get", factsPath(ids), accessToken));
    expect(rowsBefore).toHaveLength(2);
    expect(await factRows(facts)).toEqual(rowsBefore);
  });

  it("lists the same fact ids and content after the character is restored", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const facts = await postStandardFacts(accessToken, ids);
    await softDeleteCharacter(accessToken, ids.characterId);

    const restored = await authed(
      "post",
      `/api/characters/${ids.characterId}/restore`,
      accessToken,
    );

    expect(restored.status).toBe(HttpStatus.OK);
    expect(byId(await listFacts(accessToken, ids))).toEqual(byId(facts));
  });
});

describe("book soft delete and restore", () => {
  it("answers 404 on the facts list while the book is trashed and keeps every fact row unchanged", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const facts = await postStandardFacts(accessToken, ids);
    const rowsBefore = await factRows(facts);

    await softDeleteBook(accessToken, ids.bookId);

    expectCharacterNotFound(await authed("get", factsPath(ids), accessToken));
    expect(rowsBefore).toHaveLength(2);
    expect(await factRows(facts)).toEqual(rowsBefore);
  });

  it("lists the same fact ids and content after the book is restored", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const facts = await postStandardFacts(accessToken, ids);
    await softDeleteBook(accessToken, ids.bookId);

    const restored = await authed("post", `/api/books/${ids.bookId}/restore`, accessToken);

    expect(restored.status).toBe(HttpStatus.CREATED);
    expect(byId(await listFacts(accessToken, ids))).toEqual(byId(facts));
  });
});

describe("purge", () => {
  it("removes the facts of every appearance when the character is purged", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { first, second } = await seedTwoBookCharacter(accessToken);
    const facts = [
      ...(await postStandardFacts(accessToken, first)),
      await postFact(accessToken, second, { text: "Rides a hippogriff", title: "Buckbeak" }),
    ];
    await softDeleteCharacter(accessToken, first.characterId);
    await backdateCharacterPurge(first.characterId);
    expect(await factRows(facts)).toHaveLength(3);

    await characterLifecycle.purge({ characterId: first.characterId, userId });

    expect(await factRows(facts)).toEqual([]);
  });

  it("removes the purged book's facts and keeps the character's facts in another book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { first, second } = await seedTwoBookCharacter(accessToken);
    const purgedFacts = await postStandardFacts(accessToken, first);
    const keptFact = await postFact(accessToken, second, {
      text: "Rides a hippogriff",
      title: "Buckbeak",
    });
    await softDeleteBook(accessToken, first.bookId);
    await backdateBookPurge(first.bookId);
    expect(await factRows(purgedFacts)).toHaveLength(2);

    await bookLifecycle.purge({ bookId: first.bookId, userId });

    expect(await factRows(purgedFacts)).toEqual([]);
    expect(await listFacts(accessToken, second)).toEqual([keptFact]);
  });
});

describe("unlink", () => {
  it("removes the unlinked appearance's facts and keeps the same character's facts in another book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { first, second } = await seedTwoBookCharacter(accessToken);
    const unlinkedFacts = await postStandardFacts(accessToken, first);
    const keptFact = await postFact(accessToken, second, {
      text: "Rides a hippogriff",
      title: "Buckbeak",
    });

    const res = await authed(
      "delete",
      `/api/books/${first.bookId}/characters/${first.characterId}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.NO_CONTENT);
    expect(await factRows(unlinkedFacts)).toEqual([]);
    expect(await listFacts(accessToken, second)).toEqual([keptFact]);
  });

  it("does not resurrect the old facts when the character is linked to the book again", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { first } = await seedTwoBookCharacter(accessToken);
    await postStandardFacts(accessToken, first);
    await authed(
      "delete",
      `/api/books/${first.bookId}/characters/${first.characterId}`,
      accessToken,
    ).expect(HttpStatus.NO_CONTENT);

    await linkCharacter(accessToken, first.bookId, first.characterId);

    const res = await authed("get", factsPath(first), accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(PaginatedCharacterFactsSchema.parse(res.body)).toMatchObject({
      items: [],
      totalCount: 0,
    });
  });

  it("leaves every fact intact when the unlink fails because the character is not in that book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { first, second } = await seedTwoBookCharacter(accessToken);
    const facts = [
      ...(await postStandardFacts(accessToken, first)),
      await postFact(accessToken, second, { text: "Rides a hippogriff", title: "Buckbeak" }),
    ];
    const unrelatedBookId = await createBook(accessToken, "Goblet of Fire");
    const rowsBefore = await factRows(facts);

    const res = await authed(
      "delete",
      `/api/books/${unrelatedBookId}/characters/${first.characterId}`,
      accessToken,
    );

    expectCharacterNotFound(res);
    expect(rowsBefore).toHaveLength(3);
    expect(await factRows(facts)).toEqual(rowsBefore);
  });
});

describe("GET /api/characters/:characterId/deletion-preview", () => {
  it("counts the facts across all of the character's appearances and no one else's", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { first, second } = await seedTwoBookCharacter(accessToken);
    await postStandardFacts(accessToken, first);
    await postStandardFacts(accessToken, second);
    await postFact(accessToken, second, { text: "Rides a hippogriff", title: "Buckbeak" });
    const ronId = await createCharacterInBook(accessToken, first.bookId, "Ron Weasley");
    await postFact(
      accessToken,
      { bookId: first.bookId, characterId: ronId },
      { text: "Has a pet rat", title: "Scabbers" },
    );

    const res = await authed(
      "get",
      `/api/characters/${first.characterId}/deletion-preview`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({ appearanceCount: 2, factCount: 5 });
  });
});
