import type { CharacterAppearanceBook, CharacterCatalogItemView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { CHARACTER_ERROR_CODES } from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";

const SEED_IDS = {
  duneFirstSeries: "10000000-0000-4000-8000-000000000000",
  duneSecondSeries: "20000000-0000-4000-8000-000000000000",
  iriySeries: "05000000-0000-4000-8000-000000000000",
  missingCharacter: "99999999-9999-4999-8999-999999999999",
  windEarlierBook: "a1000000-0000-4000-8000-000000000000",
  windLaterBook: "b1000000-0000-4000-8000-000000000000",
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

type BookSeed = {
  coverMediaId?: string;
  id?: string;
  partNumber?: number;
  seriesId?: string;
  title: string;
  trashed?: boolean;
};

type BooksTarget = {
  characterId: string;
  token: string;
};

type CanonicalShelf = {
  characterId: string;
  expectedBooks: CharacterAppearanceBook[];
  token: string;
};

type CatalogItem = Pick<CharacterCatalogItemView, "appearanceCount" | "booksPreview" | "id">;

function authed(
  method: "delete" | "get" | "patch" | "post" | "put",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function catalogItem(token: string, characterId: string): Promise<CatalogItem> {
  const res = await authed("get", "/api/characters", token);
  expect(res.status).toBe(HttpStatus.OK);
  const items: CatalogItem[] = res.body.items;
  const item = items.find((candidate) => candidate.id === characterId);
  if (item === undefined) throw new Error(`character ${characterId} is missing from the catalog`);
  return item;
}

function characterBooks(token: string, characterId: string, query = ""): request.Test {
  return authed("get", `/api/characters/${characterId}/books${query}`, token);
}

async function createGlobal(token: string, character: Record<string, unknown>): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createInBook(
  token: string,
  bookId: string,
  character: Record<string, unknown>,
  profile: Record<string, unknown> = {},
): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "supporting", ...profile },
    character,
    mode: "new",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createSeriesFirstBook(token: string, seriesName: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    newSeries: { name: seriesName },
    ownershipStatus: "owned",
    partNumber: 1,
    title: "Dune",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function idsOf(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id);
}

async function linkBooks(characterId: string, bookIds: string[]): Promise<void> {
  await prisma.bookCharacter.createMany({
    data: bookIds.map((bookId) => ({ bookId, characterId })),
  });
}

async function seedBook(userId: string, { trashed = false, ...book }: BookSeed): Promise<string> {
  const created = await prisma.book.create({
    data: { ...book, ...(trashed ? TRASH_RETENTION.stamp() : {}), userId },
  });
  return created.id;
}

async function seedCanonicalShelf(): Promise<CanonicalShelf> {
  const { accessToken, userId } = await context.registerVerifyAndLogin();
  await seedSeries(userId, { id: SEED_IDS.iriySeries, name: "Ірій", normalizedName: "ірій" });
  await seedSeries(userId, {
    id: SEED_IDS.duneSecondSeries,
    name: "Дюна",
    normalizedName: "дюна друга",
  });
  await seedSeries(userId, { id: SEED_IDS.duneFirstSeries, name: "Дюна", normalizedName: "дюна" });
  const windEarlierCover = await seedCover(userId);
  const sandCover = await seedCover(userId);

  const appleId = await seedBook(userId, { title: "Яблуко" });
  const alphabetId = await seedBook(userId, { title: "Абетка" });
  const iriyId = await seedBook(userId, {
    partNumber: 1,
    seriesId: SEED_IDS.iriySeries,
    title: "Ірій",
  });
  const arrakisId = await seedBook(userId, {
    partNumber: 1,
    seriesId: SEED_IDS.duneSecondSeries,
    title: "Арракіс",
  });
  const stormId = await seedBook(userId, { seriesId: SEED_IDS.duneFirstSeries, title: "Буря" });
  const sandId = await seedBook(userId, {
    coverMediaId: sandCover,
    partNumber: 2,
    seriesId: SEED_IDS.duneFirstSeries,
    title: "Пісок",
  });
  await seedBook(userId, {
    id: SEED_IDS.windLaterBook,
    seriesId: SEED_IDS.duneFirstSeries,
    title: "Вітер",
  });
  await seedBook(userId, {
    coverMediaId: windEarlierCover,
    id: SEED_IDS.windEarlierBook,
    seriesId: SEED_IDS.duneFirstSeries,
    title: "Вітер",
  });
  const trashedId = await seedBook(userId, {
    partNumber: 1,
    seriesId: SEED_IDS.duneFirstSeries,
    title: "Альфа",
    trashed: true,
  });

  const characterId = await createGlobal(accessToken, { name: "Paul Atreides" });
  await linkBooks(characterId, [
    appleId,
    alphabetId,
    iriyId,
    arrakisId,
    stormId,
    sandId,
    SEED_IDS.windLaterBook,
    SEED_IDS.windEarlierBook,
    trashedId,
  ]);

  const duneFirst = { id: SEED_IDS.duneFirstSeries, name: "Дюна" };
  return {
    characterId,
    expectedBooks: [
      {
        cover: expect.objectContaining({ id: sandCover, kind: "book_cover" }),
        id: sandId,
        series: { ...duneFirst, partNumber: 2 },
        title: "Пісок",
      },
      { cover: null, id: stormId, series: { ...duneFirst, partNumber: null }, title: "Буря" },
      {
        cover: expect.objectContaining({ id: windEarlierCover, kind: "book_cover" }),
        id: SEED_IDS.windEarlierBook,
        series: { ...duneFirst, partNumber: null },
        title: "Вітер",
      },
      {
        cover: null,
        id: SEED_IDS.windLaterBook,
        series: { ...duneFirst, partNumber: null },
        title: "Вітер",
      },
      {
        cover: null,
        id: arrakisId,
        series: { id: SEED_IDS.duneSecondSeries, name: "Дюна", partNumber: 1 },
        title: "Арракіс",
      },
      {
        cover: null,
        id: iriyId,
        series: { id: SEED_IDS.iriySeries, name: "Ірій", partNumber: 1 },
        title: "Ірій",
      },
      { cover: null, id: alphabetId, series: null, title: "Абетка" },
      { cover: null, id: appleId, series: null, title: "Яблуко" },
    ],
    token: accessToken,
  };
}

async function seedCover(userId: string): Promise<string> {
  const asset = await prisma.mediaAsset.create({
    data: {
      contentType: "image/webp",
      height: 900,
      kind: "book_cover",
      sizeBytes: 1000,
      storageKey: `media/book_cover/${randomUUID()}/image.webp`,
      userId,
      width: 600,
    },
  });
  return asset.id;
}

async function seedSeries(
  userId: string,
  series: { id?: string; name: string; normalizedName: string },
): Promise<string> {
  const created = await prisma.series.create({ data: { ...series, userId } });
  return created.id;
}

describe("global catalog: books preview", () => {
  it("caps each character's preview at its own first three books and leaves a bookless one empty", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const messiah = await seedBook(userId, { title: "Месія Дюни" });
    const chapterhouse = await seedBook(userId, { title: "Капітул Дюни" });
    const heretics = await seedBook(userId, { title: "Єретики Дюни" });
    const dune = await seedBook(userId, { title: "Дюна" });
    const children = await seedBook(userId, { title: "Діти Дюни" });
    const paul = await createGlobal(accessToken, { name: "Paul Atreides" });
    const chani = await createGlobal(accessToken, { name: "Chani" });
    const leto = await createGlobal(accessToken, { name: "Leto II" });
    await linkBooks(paul, [messiah, chapterhouse, heretics, dune, children]);
    await linkBooks(chani, [messiah, dune]);

    const res = await authed("get", "/api/characters", accessToken);
    expect(res.status).toBe(HttpStatus.OK);

    const previewByCharacter = Object.fromEntries(
      res.body.items.map((item: CatalogItem) => [
        item.id,
        { appearanceCount: item.appearanceCount, preview: idsOf(item.booksPreview) },
      ]),
    );
    expect(previewByCharacter).toEqual({
      [chani]: { appearanceCount: 2, preview: [dune, messiah] },
      [leto]: { appearanceCount: 0, preview: [] },
      [paul]: { appearanceCount: 5, preview: [children, dune, heretics] },
    });
  });

  it("previews the canonical head with a coverless book in place and a trashed one skipped", async () => {
    const { characterId, expectedBooks, token } = await seedCanonicalShelf();

    const item = await catalogItem(token, characterId);
    const books = await characterBooks(token, characterId);
    expect(books.status).toBe(HttpStatus.OK);

    expect(item.booksPreview).toEqual(expectedBooks.slice(0, 3));
    expect(item.booksPreview).toEqual(books.body.items.slice(0, 3));
  });

  it("counts the same active books in appearanceCount as the books endpoint totalCount", async () => {
    const { characterId, token } = await seedCanonicalShelf();

    const item = await catalogItem(token, characterId);
    const books = await characterBooks(token, characterId);

    expect(books.body.totalCount).toBe(8);
    expect(item.appearanceCount).toBe(books.body.totalCount);
  });
});

describe("GET /api/characters/:characterId/books", () => {
  it("lists every active book in the canonical order with each book's own part number", async () => {
    const { characterId, expectedBooks, token } = await seedCanonicalShelf();

    const res = await characterBooks(token, characterId);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual({
      items: expectedBooks,
      page: 1,
      pagesCount: 1,
      pageSize: 20,
      totalCount: 8,
    });
  });

  it("sorts all books before slicing pages at the default page size of 20", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await seedSeries(userId, { name: "Хроніки", normalizedName: "хроніки" });
    const appendixId = await seedBook(userId, { title: "Додаток" });
    const volumeIdsByDescendingPart: string[] = [];
    for (const part of Array.from({ length: 20 }, (_, index) => 20 - index)) {
      volumeIdsByDescendingPart.push(
        await seedBook(userId, { partNumber: part, seriesId, title: `Том ${part}` }),
      );
    }
    const characterId = await createGlobal(accessToken, { name: "Leto II" });
    await linkBooks(characterId, [appendixId, ...volumeIdsByDescendingPart]);

    const firstPage = await characterBooks(accessToken, characterId);
    const secondPage = await characterBooks(accessToken, characterId, "?pageNumber=2");

    expect(firstPage.body).toMatchObject({ page: 1, pagesCount: 2, pageSize: 20, totalCount: 21 });
    expect(secondPage.body).toMatchObject({ page: 2, pagesCount: 2, pageSize: 20, totalCount: 21 });
    expect(firstPage.body.items).toHaveLength(20);
    expect(secondPage.body.items).toHaveLength(1);
    expect([...idsOf(firstPage.body.items), ...idsOf(secondPage.body.items)]).toEqual([
      ...[...volumeIdsByDescendingPart].reverse(),
      appendixId,
    ]);
  });

  it("returns 401 without a bearer token", async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/characters/${SEED_IDS.missingCharacter}/books`,
    );

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("returns 400 for a non-UUID character id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("get", "/api/characters/not-a-uuid/books", accessToken);

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("returns 400 with a pageSize field error for pageSize=0", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const characterId = await createGlobal(accessToken, { name: "Paul Atreides" });

    const res = await characterBooks(accessToken, characterId, "?pageSize=0");

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "pageSize" })]),
    );
  });

  it.each([
    {
      name: "another user's character",
      target: async (): Promise<BooksTarget> => {
        const owner = await context.registerVerifyAndLogin();
        const intruder = await context.registerVerifyAndLogin();
        const characterId = await createGlobal(owner.accessToken, { name: "Paul Atreides" });
        return { characterId, token: intruder.accessToken };
      },
    },
    {
      name: "a well-formed id that does not exist",
      target: async (): Promise<BooksTarget> => {
        const { accessToken } = await context.registerVerifyAndLogin();
        return { characterId: SEED_IDS.missingCharacter, token: accessToken };
      },
    },
    {
      name: "a soft-deleted character",
      target: async (): Promise<BooksTarget> => {
        const { accessToken } = await context.registerVerifyAndLogin();
        const characterId = await createGlobal(accessToken, { name: "Paul Atreides" });
        const deleted = await authed(
          "delete",
          `/api/characters/${characterId}?confirm=true`,
          accessToken,
        );
        expect(deleted.status).toBe(HttpStatus.OK);
        return { characterId, token: accessToken };
      },
    },
  ])("returns the shared character 404 body for $name", async ({ target }) => {
    const { characterId, token } = await target();

    const res = await characterBooks(token, characterId);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body).toEqual({
      code: CHARACTER_ERROR_CODES.notFound,
      message: "Character not found",
      requestId: expect.any(String),
    });
  });
});

describe("character book items: spoiler-safe shape", () => {
  it.each([
    {
      read: async (token: string, characterId: string): Promise<CharacterAppearanceBook[]> =>
        (await catalogItem(token, characterId)).booksPreview,
      surface: "the catalog booksPreview",
    },
    {
      read: async (token: string, characterId: string): Promise<CharacterAppearanceBook[]> =>
        (await characterBooks(token, characterId)).body.items,
      surface: "the character books page",
    },
  ])("exposes only cover, id, series and title on $surface", async ({ read }) => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createSeriesFirstBook(accessToken, "Дюна");
    const characterId = await createInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      {
        displayName: "Muad'Dib",
        displayNameIsSpoiler: true,
        status: "dead",
        statusIsSpoiler: true,
      },
    );

    const books = await read(accessToken, characterId);

    expect(books.map((book) => Object.keys(book).sort())).toEqual([
      ["cover", "id", "series", "title"],
    ]);
    expect(books.map((book) => Object.keys(book.series ?? {}).sort())).toEqual([
      ["id", "name", "partNumber"],
    ]);
    expect(JSON.stringify(books)).not.toMatch(/Muad'Dib|dead/);
  });
});
