import type { CharacterFactView, PaginatedCharacterFacts } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { CharacterFactViewSchema, PaginatedCharacterFactsSchema } from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import { addMinutes, isAfter } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";

type AppearanceIds = { bookId: string; characterId: string };

type FactRoute = "create" | "list" | "remove" | "update";

type Outcome = { body: unknown; status: number };

type SeedFact = {
  chapter?: string;
  createdAt: Date;
  id?: string;
  page?: number;
  text?: string;
  title: string;
};

const FIXTURE = {
  errorCodes: {
    characterNotFound: "character_not_found",
    factNotFound: "character_fact_not_found",
    pageExceedsBook: "character_fact_page_exceeds_book",
  },
  factIds: {
    earlierTie: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    laterTie: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    oldest: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  },
  missingId: "99999999-9999-4999-8999-999999999999",
  seededAt: new Date("2026-01-01T09:00:00.000Z"),
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
} as const;

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
  method: "delete" | "get" | "patch" | "post",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "J. K. Rowling" }],
    ownershipStatus: "owned",
    title: "Harry Potter",
    ...overrides,
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

async function factCount(factId: string): Promise<number> {
  return prisma.characterFact.count({ where: { id: factId } });
}

function factPath(ids: AppearanceIds, factId: string): string {
  return `${factsPath(ids)}/${factId}`;
}

function factsPath({ bookId, characterId }: AppearanceIds): string {
  return `/api/books/${bookId}/characters/${characterId}/facts`;
}

async function hitEveryRoute(
  token: string,
  ids: AppearanceIds,
  factId: string,
): Promise<Record<FactRoute, Outcome>> {
  return {
    create: outcomeOf(
      await authed("post", factsPath(ids), token).send({ text: "Intruder", title: "Intruder" }),
    ),
    list: outcomeOf(await authed("get", factsPath(ids), token)),
    remove: outcomeOf(await authed("delete", factPath(ids, factId), token)),
    update: outcomeOf(
      await authed("patch", factPath(ids, factId), token).send({ title: "Hijacked" }),
    ),
  };
}

async function insertFacts(ids: AppearanceIds, facts: SeedFact[]): Promise<void> {
  const appearance = await prisma.bookCharacter.findFirstOrThrow({
    select: { id: true },
    where: ids,
  });
  await prisma.characterFact.createMany({
    data: facts.map((fact) => ({
      bookCharacterId: appearance.id,
      chapter: fact.chapter,
      createdAt: fact.createdAt,
      id: fact.id,
      page: fact.page,
      text: fact.text ?? `${fact.title} in detail`,
      title: fact.title,
      updatedAt: fact.createdAt,
    })),
  });
}

async function linkCharacter(token: string, bookId: string, characterId: string): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "supporting" },
    characterId,
    mode: "existing",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
}

async function listFacts(
  token: string,
  ids: AppearanceIds,
  query: Record<string, number | string> = {},
): Promise<PaginatedCharacterFacts> {
  const res = await authed("get", factsPath(ids), token).query(query);
  expect(res.status).toBe(HttpStatus.OK);
  return PaginatedCharacterFactsSchema.parse(res.body);
}

async function listTitles(
  token: string,
  ids: AppearanceIds,
  query: Record<string, number | string> = {},
): Promise<string[]> {
  const page = await listFacts(token, ids, query);
  return page.items.map((fact) => fact.title);
}

function notFound(code: string): Outcome {
  return {
    body: { code, message: expect.any(String), requestId: expect.any(String) },
    status: HttpStatus.NOT_FOUND,
  };
}

function notFoundOnEveryRoute(code: string): Record<FactRoute, Outcome> {
  return {
    create: notFound(code),
    list: notFound(code),
    remove: notFound(code),
    update: notFound(code),
  };
}

function numberedFacts(count: number): SeedFact[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return {
      createdAt: addMinutes(FIXTURE.seededAt, number),
      text: number === 1 ? "Hides a basilisk fang" : `Detail number ${number}`,
      title: `Fact ${String(number).padStart(2, "0")}`,
    };
  });
}

function outcomeOf(res: request.Response): Outcome {
  return { body: res.body, status: res.status };
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

async function seedAppearance(
  token: string,
  bookOverrides: Record<string, unknown> = {},
): Promise<AppearanceIds> {
  const bookId = await createBook(token, bookOverrides);
  const characterId = await createCharacterInBook(token, bookId, "Harry Potter");
  return { bookId, characterId };
}

describe("character facts round trip", () => {
  it("creates, lists, updates and deletes a fact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);

    const created = await postFact(accessToken, ids, {
      chapter: "  Chapter 1 ",
      page: 12,
      text: " Lives under the stairs ",
      title: " Home ",
    });
    expect(created).toMatchObject({
      chapter: "Chapter 1",
      page: 12,
      text: "Lives under the stairs",
      title: "Home",
    });
    expect(created.id).toMatch(FIXTURE.uuid);

    const listed = await listFacts(accessToken, ids);
    expect(listed).toMatchObject({ page: 1, pagesCount: 1, pageSize: 20, totalCount: 1 });
    expect(listed.items).toEqual([created]);

    const patched = await authed("patch", factPath(ids, created.id), accessToken).send({
      title: "Cupboard",
    });
    expect(patched.status).toBe(HttpStatus.OK);
    expect(CharacterFactViewSchema.parse(patched.body)).toMatchObject({
      id: created.id,
      text: "Lives under the stairs",
      title: "Cupboard",
    });

    const removed = await authed("delete", factPath(ids, created.id), accessToken);
    expect(removed.status).toBe(HttpStatus.NO_CONTENT);
    expect((await listFacts(accessToken, ids)).totalCount).toBe(0);
  });
});

describe("authentication", () => {
  it("rejects listing facts without a token", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);

    const res = await request(app.getHttpServer()).get(factsPath(ids));

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("rejects creating a fact without a token and stores nothing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);

    const res = await request(app.getHttpServer())
      .post(factsPath(ids))
      .send({ text: "Anonymous", title: "Anonymous" });

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    expect((await listFacts(accessToken, ids)).totalCount).toBe(0);
  });
});

describe("ownership and appearance scoping", () => {
  it("answers 404 on every route for another user's book and character and leaves the fact intact", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(owner.accessToken);
    const fact = await postFact(owner.accessToken, ids, { text: "Secret", title: "Owner fact" });

    const outcomes = await hitEveryRoute(intruder.accessToken, ids, fact.id);

    expect(outcomes).toEqual(notFoundOnEveryRoute(FIXTURE.errorCodes.characterNotFound));
    expect((await listFacts(owner.accessToken, ids)).items).toEqual([fact]);
  });

  it("answers 404 when the book belongs to another user even if a link row exists", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin();
    const ownerIds = await seedAppearance(owner.accessToken);
    const intruderIds = await seedAppearance(intruder.accessToken);
    const forgedIds = { bookId: ownerIds.bookId, characterId: intruderIds.characterId };
    await prisma.bookCharacter.create({ data: forgedIds });

    const res = await authed("get", factsPath(forgedIds), intruder.accessToken);

    expect(outcomeOf(res)).toEqual(notFound(FIXTURE.errorCodes.characterNotFound));
  });

  it("answers 404 when the character belongs to another user even if a link row exists", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin();
    const ownerIds = await seedAppearance(owner.accessToken);
    const intruderIds = await seedAppearance(intruder.accessToken);
    const forgedIds = { bookId: intruderIds.bookId, characterId: ownerIds.characterId };
    await prisma.bookCharacter.create({ data: forgedIds });

    const res = await authed("get", factsPath(forgedIds), intruder.accessToken);

    expect(outcomeOf(res)).toEqual(notFound(FIXTURE.errorCodes.characterNotFound));
  });

  it("answers 404 for a character that is not linked to the book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const unlinkedBookId = await createBook(accessToken, { title: "Unrelated" });
    const unlinked = { bookId: unlinkedBookId, characterId: ids.characterId };

    const listed = await authed("get", factsPath(unlinked), accessToken);
    const created = await authed("post", factsPath(unlinked), accessToken).send({
      text: "Should not land",
      title: "Stray",
    });

    expect(outcomeOf(listed)).toEqual(notFound(FIXTURE.errorCodes.characterNotFound));
    expect(outcomeOf(created)).toEqual(notFound(FIXTURE.errorCodes.characterNotFound));
  });

  it("answers 404 when patching a fact that belongs to another character in the same book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const other = {
      bookId: ids.bookId,
      characterId: await createCharacterInBook(accessToken, ids.bookId, "Ron Weasley"),
    };
    const foreignFact = await postFact(accessToken, other, { text: "Ginger", title: "Hair" });

    const res = await authed("patch", factPath(ids, foreignFact.id), accessToken).send({
      title: "Hijacked",
    });

    expect(outcomeOf(res)).toEqual(notFound(FIXTURE.errorCodes.factNotFound));
    expect((await listFacts(accessToken, other)).items).toEqual([foreignFact]);
  });

  it("answers 404 when deleting a fact that belongs to another character in the same book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const other = {
      bookId: ids.bookId,
      characterId: await createCharacterInBook(accessToken, ids.bookId, "Ron Weasley"),
    };
    const foreignFact = await postFact(accessToken, other, { text: "Ginger", title: "Hair" });

    const res = await authed("delete", factPath(ids, foreignFact.id), accessToken);

    expect(outcomeOf(res)).toEqual(notFound(FIXTURE.errorCodes.factNotFound));
    expect(await factCount(foreignFact.id)).toBe(1);
  });

  it("answers 404 when patching an unknown fact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);

    const res = await authed("patch", factPath(ids, FIXTURE.missingId), accessToken).send({
      title: "Ghost",
    });

    expect(outcomeOf(res)).toEqual(notFound(FIXTURE.errorCodes.factNotFound));
  });

  it("answers 404 when deleting an unknown fact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);

    const res = await authed("delete", factPath(ids, FIXTURE.missingId), accessToken);

    expect(outcomeOf(res)).toEqual(notFound(FIXTURE.errorCodes.factNotFound));
  });
});

describe("book path forging for a character in two books", () => {
  async function seedTwoBookCharacter(token: string): Promise<{
    bookA: AppearanceIds;
    bookB: AppearanceIds;
    fact: CharacterFactView;
  }> {
    const bookA = await seedAppearance(token, { title: "Book A" });
    const bookBId = await createBook(token, { title: "Book B" });
    await linkCharacter(token, bookBId, bookA.characterId);
    const fact = await postFact(token, bookA, { text: "Only in book A", title: "Book A fact" });
    return { bookA, bookB: { bookId: bookBId, characterId: bookA.characterId }, fact };
  }

  it("does not list a fact of book A under book B", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookB } = await seedTwoBookCharacter(accessToken);

    expect(await listFacts(accessToken, bookB)).toMatchObject({ items: [], totalCount: 0 });
  });

  it("cannot edit a fact of book A through book B", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookA, bookB, fact } = await seedTwoBookCharacter(accessToken);

    const res = await authed("patch", factPath(bookB, fact.id), accessToken).send({
      title: "Forged",
    });

    expect(outcomeOf(res)).toEqual(notFound(FIXTURE.errorCodes.factNotFound));
    expect((await listFacts(accessToken, bookA)).items).toEqual([fact]);
  });

  it("cannot delete a fact of book A through book B", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookA, bookB, fact } = await seedTwoBookCharacter(accessToken);

    const res = await authed("delete", factPath(bookB, fact.id), accessToken);

    expect(outcomeOf(res)).toEqual(notFound(FIXTURE.errorCodes.factNotFound));
    expect((await listFacts(accessToken, bookA)).items).toEqual([fact]);
  });
});

describe("input validation", () => {
  it.each([
    ["a blank title", { title: "   " }, "title"],
    ["a blank text", { text: " \n " }, "text"],
    ["a 121 character title", { title: "t".repeat(121) }, "title"],
    ["a 5001 character text", { text: "x".repeat(5001) }, "text"],
    ["a 101 character chapter", { chapter: "c".repeat(101) }, "chapter"],
    ["page 0", { page: 0 }, "page"],
    ["page -1", { page: -1 }, "page"],
    ["page 1.5", { page: 1.5 }, "page"],
  ])("rejects %s with 400 on create", async (_label, override, field) => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);

    const res = await authed("post", factsPath(ids), accessToken).send({
      text: "Valid text",
      title: "Valid title",
      ...override,
    });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field, message: expect.any(String) })]),
    );
  });

  it("rejects a page beyond the book page count with the page-exceeds code", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken, { pagesCount: 300 });

    const res = await authed("post", factsPath(ids), accessToken).send({
      page: 301,
      text: "Past the end",
      title: "Epilogue",
    });

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe(FIXTURE.errorCodes.pageExceedsBook);
    expect((await listFacts(accessToken, ids)).totalCount).toBe(0);
  });

  it("accepts the last page of the book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken, { pagesCount: 300 });

    const fact = await postFact(accessToken, ids, { page: 300, text: "Last page", title: "End" });

    expect(fact.page).toBe(300);
  });

  it("rejects a patch that moves the page beyond the book page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken, { pagesCount: 300 });
    const fact = await postFact(accessToken, ids, { page: 10, text: "Early", title: "Start" });

    const res = await authed("patch", factPath(ids, fact.id), accessToken).send({ page: 301 });

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe(FIXTURE.errorCodes.pageExceedsBook);
  });

  it("accepts any page when the book has no page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);

    const fact = await postFact(accessToken, ids, { page: 5000, text: "Far in", title: "Deep" });

    expect(fact.page).toBe(5000);
  });
});

describe("list ordering", () => {
  it("orders by createdAt descending and breaks ties by id descending", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const tiedAt = addMinutes(FIXTURE.seededAt, 10);
    await insertFacts(ids, [
      { createdAt: FIXTURE.seededAt, id: FIXTURE.factIds.oldest, title: "Oldest" },
      { createdAt: tiedAt, id: FIXTURE.factIds.earlierTie, title: "Tie with lower id" },
      { createdAt: tiedAt, id: FIXTURE.factIds.laterTie, title: "Tie with higher id" },
    ]);

    expect(await listTitles(accessToken, ids)).toEqual([
      "Tie with higher id",
      "Tie with lower id",
      "Oldest",
    ]);
  });

  it("keeps an edited older fact in its original position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    await insertFacts(ids, [
      { createdAt: FIXTURE.seededAt, id: FIXTURE.factIds.oldest, title: "Older" },
      { createdAt: addMinutes(FIXTURE.seededAt, 5), title: "Newer" },
    ]);

    const res = await authed("patch", factPath(ids, FIXTURE.factIds.oldest), accessToken).send({
      text: "Edited just now",
    });

    expect(res.status).toBe(HttpStatus.OK);
    expect(await listTitles(accessToken, ids)).toEqual(["Newer", "Older"]);
  });
});

describe("pagination", () => {
  it("splits 45 facts into pages of 20, 20 and 5", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    await insertFacts(ids, numberedFacts(45));

    const first = await listFacts(accessToken, ids, { pageNumber: 1 });
    const second = await listFacts(accessToken, ids, { pageNumber: 2 });
    const third = await listFacts(accessToken, ids, { pageNumber: 3 });

    expect(first).toMatchObject({ page: 1, pagesCount: 3, pageSize: 20, totalCount: 45 });
    expect(first.items).toHaveLength(20);
    expect(first.items.at(0)?.title).toBe("Fact 45");
    expect(first.items.at(-1)?.title).toBe("Fact 26");
    expect(second.items).toHaveLength(20);
    expect(second.items.at(0)?.title).toBe("Fact 25");
    expect(second.items.at(-1)?.title).toBe("Fact 06");
    expect(third.items.map((fact) => fact.title)).toEqual([
      "Fact 05",
      "Fact 04",
      "Fact 03",
      "Fact 02",
      "Fact 01",
    ]);
  });

  it("rejects a page size above 20", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);

    const res = await authed("get", factsPath(ids), accessToken).query({ pageSize: 21 });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "pageSize" })]),
    );
  });
});

describe("search", () => {
  it("matches the title case-insensitively", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    await insertFacts(ids, [
      { createdAt: FIXTURE.seededAt, text: "A silver stag", title: "Patronus form" },
      { createdAt: addMinutes(FIXTURE.seededAt, 1), text: "Holly and feather", title: "Wand" },
    ]);

    expect(await listTitles(accessToken, ids, { q: "PATRONUS" })).toEqual(["Patronus form"]);
  });

  it("matches the text", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    await insertFacts(ids, [
      { createdAt: FIXTURE.seededAt, text: "A silver stag", title: "Patronus form" },
      { createdAt: addMinutes(FIXTURE.seededAt, 1), text: "Holly and phoenix", title: "Wand" },
    ]);

    expect(await listTitles(accessToken, ids, { q: "Phoenix" })).toEqual(["Wand"]);
  });

  it("collapses repeated spaces in the search term", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    await insertFacts(ids, [
      { createdAt: FIXTURE.seededAt, title: "Knows two words of Parseltongue" },
      { createdAt: addMinutes(FIXTURE.seededAt, 1), title: "Two-word spells" },
    ]);

    expect(await listTitles(accessToken, ids, { q: "  two   words " })).toEqual([
      "Knows two words of Parseltongue",
    ]);
  });

  it("finds a fact that sits on the third page of the unfiltered list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    await insertFacts(ids, numberedFacts(45));

    const found = await listFacts(accessToken, ids, { q: "basilisk" });

    expect(found).toMatchObject({ page: 1, pagesCount: 1, totalCount: 1 });
    expect(found.items.map((fact) => fact.title)).toEqual(["Fact 01"]);
  });

  it("treats a percent sign literally", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    await insertFacts(ids, [
      { createdAt: FIXTURE.seededAt, title: "100% loyal" },
      { createdAt: addMinutes(FIXTURE.seededAt, 1), title: "1000 galleons" },
    ]);

    expect(await listTitles(accessToken, ids, { q: "0%" })).toEqual(["100% loyal"]);
  });

  it("treats an underscore literally", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    await insertFacts(ids, [
      { createdAt: FIXTURE.seededAt, title: "snake_tongue" },
      { createdAt: addMinutes(FIXTURE.seededAt, 1), title: "snakeXtongue" },
    ]);

    expect(await listTitles(accessToken, ids, { q: "e_t" })).toEqual(["snake_tongue"]);
  });

  it("never returns facts of another character in the same book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const other = {
      bookId: ids.bookId,
      characterId: await createCharacterInBook(accessToken, ids.bookId, "Charlie Weasley"),
    };
    await insertFacts(ids, [{ createdAt: FIXTURE.seededAt, title: "Fought a dragon" }]);
    await insertFacts(other, [{ createdAt: FIXTURE.seededAt, title: "Tames every dragon" }]);

    expect(await listTitles(accessToken, ids, { q: "dragon" })).toEqual(["Fought a dragon"]);
  });
});

describe("soft-deleted owners", () => {
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

  it("answers 404 on every route for a soft-deleted book and keeps the fact row", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const fact = await postFact(accessToken, ids, { text: "Survives", title: "Kept" });
    await softDeleteBook(accessToken, ids.bookId);

    const outcomes = await hitEveryRoute(accessToken, ids, fact.id);

    expect(outcomes).toEqual(notFoundOnEveryRoute(FIXTURE.errorCodes.characterNotFound));
    expect(await factCount(fact.id)).toBe(1);
  });

  it("answers 404 on every route for a soft-deleted character and keeps the fact row", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const fact = await postFact(accessToken, ids, { text: "Survives", title: "Kept" });
    await softDeleteCharacter(accessToken, ids.characterId);

    const outcomes = await hitEveryRoute(accessToken, ids, fact.id);

    expect(outcomes).toEqual(notFoundOnEveryRoute(FIXTURE.errorCodes.characterNotFound));
    expect(await factCount(fact.id)).toBe(1);
  });

  it("shows the facts again once the book is restored", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const fact = await postFact(accessToken, ids, { text: "Survives", title: "Kept" });
    await softDeleteBook(accessToken, ids.bookId);

    await prisma.book.update({
      data: { deletedAt: null, purgeAt: null },
      where: { id: ids.bookId },
    });

    expect((await listFacts(accessToken, ids)).items).toEqual([fact]);
  });

  it("shows the facts again once the character is restored", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const fact = await postFact(accessToken, ids, { text: "Survives", title: "Kept" });
    await softDeleteCharacter(accessToken, ids.characterId);

    await prisma.character.update({
      data: { deletedAt: null, purgeAt: null },
      where: { id: ids.characterId },
    });

    expect((await listFacts(accessToken, ids)).items).toEqual([fact]);
  });
});

describe("partial updates", () => {
  it("clears chapter and page with null", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    const fact = await postFact(accessToken, ids, {
      chapter: "Chapter 2",
      page: 40,
      text: "Platform",
      title: "Train",
    });

    const res = await authed("patch", factPath(ids, fact.id), accessToken).send({
      chapter: null,
      page: null,
    });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({ chapter: null, page: null, text: "Platform", title: "Train" });
    expect((await listFacts(accessToken, ids)).items).toMatchObject([
      { chapter: null, page: null },
    ]);
  });

  it("keeps text, chapter, page and createdAt when only the title changes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    await insertFacts(ids, [
      {
        chapter: "Chapter 7",
        createdAt: FIXTURE.seededAt,
        id: FIXTURE.factIds.oldest,
        page: 77,
        text: "Original text",
        title: "Original title",
      },
    ]);

    const res = await authed("patch", factPath(ids, FIXTURE.factIds.oldest), accessToken).send({
      title: "Renamed",
    });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({
      chapter: "Chapter 7",
      createdAt: "2026-01-01T09:00:00.000Z",
      page: 77,
      text: "Original text",
      title: "Renamed",
    });
  });

  it("advances updatedAt on edit", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = await seedAppearance(accessToken);
    await insertFacts(ids, [
      { createdAt: FIXTURE.seededAt, id: FIXTURE.factIds.oldest, title: "Original title" },
    ]);

    const res = await authed("patch", factPath(ids, FIXTURE.factIds.oldest), accessToken).send({
      title: "Renamed",
    });

    expect(res.status).toBe(HttpStatus.OK);
    expect(isAfter(CharacterFactViewSchema.parse(res.body).updatedAt, FIXTURE.seededAt)).toBe(true);
  });
});
