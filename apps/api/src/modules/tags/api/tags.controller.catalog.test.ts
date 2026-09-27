import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { TagsUsageFixtures } from "./tags-usage.fixtures.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { TagsModule } from "../tags.module.js";
import { createTagsUsageFixtures } from "./tags-usage.fixtures.js";

let context: AuthTestContext;
let app: INestApplication;
let seed: TagsUsageFixtures;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, TagsModule]);
  app = context.app;
  seed = createTagsUsageFixtures(app.get(PrismaService));
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

const HIDDEN_AT = new Date("2026-01-15T00:00:00.000Z");

type CatalogItem = {
  booksCount: number;
  charactersCount: number;
  color: string;
  id: string;
  name: string;
  type: string;
  usageCount: number;
};

function getCatalog(accessToken: string, query = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/tags/catalog${query === "" ? "" : `?${query}`}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getFacets(accessToken: string, query = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/tags/catalog/facets${query === "" ? "" : `?${query}`}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function itemNamed(res: request.Response, name: string): CatalogItem | undefined {
  return itemsOf(res).find((item) => item.name === name);
}

function itemsOf(res: request.Response): CatalogItem[] {
  return res.body.items;
}

function namesOf(res: request.Response): string[] {
  return itemsOf(res).map((item) => item.name);
}

async function seedUsageScenario(userId: string): Promise<void> {
  const firstBook = await seed.book({ title: "Dune", userId });
  const secondBook = await seed.book({ title: "Messiah", userId });
  const trashedBook = await seed.book({ deletedAt: HIDDEN_AT, title: "Trashed", userId });
  const paul = await seed.character({ name: "Paul", userId });
  const chani = await seed.character({ name: "Chani", userId });
  const archived = await seed.character({ archivedAt: HIDDEN_AT, name: "Archived", userId });
  const deleted = await seed.character({ deletedAt: HIDDEN_AT, name: "Deleted", userId });
  await seed.appearIn({ bookIds: [firstBook.id, secondBook.id], characterId: paul.id });

  const booksOnly = await seed.tag({ name: "books only", userId });
  await seed.tagBooks({ bookIds: [firstBook.id], tagId: booksOnly.id });

  const charactersOnly = await seed.tag({ name: "characters only", userId });
  await seed.tagCharacters({ characterIds: [chani.id], tagId: charactersOnly.id });

  const both = await seed.tag({ name: "both", userId });
  await seed.tagBooks({ bookIds: [firstBook.id, secondBook.id], tagId: both.id });
  await seed.tagCharacters({ characterIds: [paul.id], tagId: both.id });

  await seed.tag({ name: "unused", userId });

  const hiddenOnly = await seed.tag({ name: "hidden only", userId });
  await seed.tagBooks({ bookIds: [trashedBook.id], tagId: hiddenOnly.id });
  await seed.tagCharacters({ characterIds: [archived.id, deleted.id], tagId: hiddenOnly.id });
}

describe("GET /api/tags/catalog", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/tags/catalog");

    expect(res.status).toBe(401);
  });

  describe("catalog items", () => {
    it("B-CAT-01 returns only the caller's own tags", async () => {
      const owner = await context.registerVerifyAndLogin();
      const stranger = await context.registerVerifyAndLogin({
        email: "stranger@example.com",
        nickname: "stranger",
      });
      await seed.tag({ name: "mine", userId: owner.userId });
      await seed.tag({ name: "theirs", userId: stranger.userId });

      const res = await getCatalog(owner.accessToken);

      expect(res.status).toBe(200);
      expect(namesOf(res)).toEqual(["mine"]);
      expect(res.body.totalCount).toBe(1);
    });

    it("B-CAT-02 exposes usageCount as booksCount plus charactersCount", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seedUsageScenario(userId);

      const res = await getCatalog(accessToken);

      expect(itemNamed(res, "both")).toMatchObject({
        booksCount: 2,
        charactersCount: 1,
        usageCount: 3,
      });
    });

    it("B-CAT-02 returns the item shape with the effective color and usage counts", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seed.tag({
        color: "sage",
        description: "slow and quiet",
        name: "cozy",
        type: "atmosphere",
        userId,
      });

      const res = await getCatalog(accessToken);

      expect(itemsOf(res)[0]).toEqual({
        booksCount: 0,
        charactersCount: 0,
        color: "sage",
        description: "slow and quiet",
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        name: "cozy",
        type: "atmosphere",
        usageCount: 0,
      });
    });

    it("B-CAT-03 / I-CHAR-02 counts a character that appears in two books once", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const firstBook = await seed.book({ userId });
      const secondBook = await seed.book({ userId });
      const paul = await seed.character({ name: "Paul", userId });
      await seed.appearIn({ bookIds: [firstBook.id, secondBook.id], characterId: paul.id });
      const tag = await seed.tag({ name: "chosen one", userId });
      await seed.tagCharacters({ characterIds: [paul.id], tagId: tag.id });

      const res = await getCatalog(accessToken);

      expect(itemNamed(res, "chosen one")).toMatchObject({
        booksCount: 0,
        charactersCount: 1,
        usageCount: 1,
      });
    });

    it("B-CAT-04 reads a null color and a legacy hex color as parchment", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seed.tag({ color: null, name: "no color", userId });
      await seed.tag({ color: "#A96E47", name: "legacy hex", userId });
      await seed.tag({ color: "rose", name: "palette", userId });

      const res = await getCatalog(accessToken);

      expect(itemNamed(res, "no color")?.color).toBe("parchment");
      expect(itemNamed(res, "legacy hex")?.color).toBe("parchment");
      expect(itemNamed(res, "palette")?.color).toBe("rose");
    });

    it("B-CAT-05 defaults to page 1 with a page size of 20", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      for (let index = 0; index < 21; index += 1) {
        await seed.tag({ name: `tag ${String(index).padStart(2, "0")}`, userId });
      }

      const res = await getCatalog(accessToken);

      expect(res.body).toMatchObject({ page: 1, pagesCount: 2, pageSize: 20, totalCount: 21 });
      expect(itemsOf(res)).toHaveLength(20);
    });
  });

  describe("visible usage scope", () => {
    it("excludes a trashed book from booksCount", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const activeBook = await seed.book({ userId });
      const trashedBook = await seed.book({ deletedAt: HIDDEN_AT, userId });
      const tag = await seed.tag({ name: "grimdark", userId });
      await seed.tagBooks({ bookIds: [activeBook.id, trashedBook.id], tagId: tag.id });

      const res = await getCatalog(accessToken);

      expect(itemNamed(res, "grimdark")).toMatchObject({ booksCount: 1, usageCount: 1 });
    });

    it("excludes an archived and a trashed character from charactersCount", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const visible = await seed.character({ name: "Visible", userId });
      const archived = await seed.character({ archivedAt: HIDDEN_AT, name: "Archived", userId });
      const deleted = await seed.character({ deletedAt: HIDDEN_AT, name: "Deleted", userId });
      const tag = await seed.tag({ name: "mentor", userId });
      await seed.tagCharacters({
        characterIds: [visible.id, archived.id, deleted.id],
        tagId: tag.id,
      });

      const res = await getCatalog(accessToken);

      expect(itemNamed(res, "mentor")).toMatchObject({ charactersCount: 1, usageCount: 1 });
    });

    it("counts a spoiler-hidden character as visible usage", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const hidden = await seed.character({ hideProfileAsSpoiler: true, name: "Twist", userId });
      const tag = await seed.tag({ name: "traitor", userId });
      await seed.tagCharacters({ characterIds: [hidden.id], tagId: tag.id });

      const res = await getCatalog(accessToken);

      expect(itemNamed(res, "traitor")).toMatchObject({ charactersCount: 1, usageCount: 1 });
    });
  });

  describe("search", () => {
    it("B-SRCH-01 matches the tag name case-insensitively", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seed.tag({ name: "dark academia", userId });
      await seed.tag({ name: "slow burn", userId });

      const res = await getCatalog(accessToken, "q=ACADEM");

      expect(namesOf(res)).toEqual(["dark academia"]);
    });

    it("B-SRCH-02 matches the tag description", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seed.tag({ description: "moody university vibes", name: "dark academia", userId });
      await seed.tag({ name: "slow burn", userId });

      const res = await getCatalog(accessToken, "q=university");

      expect(namesOf(res)).toEqual(["dark academia"]);
    });

    it("B-SRCH-03 does not match a tag through a linked book title or character name", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seedUsageScenario(userId);

      const byBookTitle = await getCatalog(accessToken, "q=Dune");
      const byCharacterName = await getCatalog(accessToken, "q=Paul");

      expect(byBookTitle.body.totalCount).toBe(0);
      expect(byCharacterName.body.totalCount).toBe(0);
    });

    it("B-SRCH-04 treats a whitespace-only q as no search", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seed.tag({ name: "dark academia", userId });
      await seed.tag({ name: "slow burn", userId });

      const res = await getCatalog(accessToken, "q=%20%20%20");

      expect(res.status).toBe(200);
      expect(res.body.totalCount).toBe(2);
    });
  });

  describe("quick filter", () => {
    it("B-FLT-01 filter=used keeps tags with any visible book or character usage", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seedUsageScenario(userId);

      const res = await getCatalog(accessToken, "filter=used&sort=name_asc");

      expect(namesOf(res)).toEqual(["books only", "both", "characters only"]);
    });

    it("B-FLT-02 filter=books keeps tags with book usage, including those also used by characters", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seedUsageScenario(userId);

      const res = await getCatalog(accessToken, "filter=books&sort=name_asc");

      expect(namesOf(res)).toEqual(["books only", "both"]);
    });

    it("B-FLT-03 filter=characters keeps tags with character usage, including those also used by books", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seedUsageScenario(userId);

      const res = await getCatalog(accessToken, "filter=characters&sort=name_asc");

      expect(namesOf(res)).toEqual(["both", "characters only"]);
    });

    it("B-FLT-04 filter=unused keeps tags whose only links point at hidden books and characters", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seedUsageScenario(userId);

      const res = await getCatalog(accessToken, "filter=unused&sort=name_asc");

      expect(namesOf(res)).toEqual(["hidden only", "unused"]);
    });
  });

  describe("type and color dimensions", () => {
    it("B-DIM-01 ORs several selected types", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seed.tag({ name: "enemies to lovers", type: "trope", userId });
      await seed.tag({ name: "grief", type: "theme", userId });
      await seed.tag({ name: "cozy", type: "atmosphere", userId });

      const res = await getCatalog(accessToken, "type=trope&type=theme&sort=name_asc");

      expect(namesOf(res)).toEqual(["enemies to lovers", "grief"]);
    });

    it("B-DIM-02 ORs several selected colors", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seed.tag({ color: "sage", name: "calm", userId });
      await seed.tag({ color: "rose", name: "romance", userId });
      await seed.tag({ color: "sky", name: "airy", userId });

      const res = await getCatalog(accessToken, "color=sage&color=rose&sort=name_asc");

      expect(namesOf(res)).toEqual(["calm", "romance"]);
    });

    it("B-DIM-03 composes search, quick filter, type and color with AND", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const book = await seed.book({ userId });
      const target = await seed.tag({ color: "sage", name: "dark forest", type: "trope", userId });
      const wrongType = await seed.tag({
        color: "sage",
        name: "dark alley",
        type: "theme",
        userId,
      });
      const wrongColor = await seed.tag({
        color: "rose",
        name: "dark sky",
        type: "trope",
        userId,
      });
      await seed.tag({ color: "sage", name: "dark hall", type: "trope", userId });
      const wrongName = await seed.tag({
        color: "sage",
        name: "bright meadow",
        type: "trope",
        userId,
      });
      for (const tag of [target, wrongType, wrongColor, wrongName]) {
        await seed.tagBooks({ bookIds: [book.id], tagId: tag.id });
      }

      const res = await getCatalog(accessToken, "q=dark&filter=used&type=trope&color=sage");

      expect(namesOf(res)).toEqual(["dark forest"]);
    });

    it("B-DIM-04 color=parchment matches explicit parchment, null and legacy colors", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seed.tag({ color: "parchment", name: "explicit", userId });
      await seed.tag({ color: null, name: "no color", userId });
      await seed.tag({ color: "#A96E47", name: "legacy hex", userId });
      await seed.tag({ color: "sage", name: "sage", userId });

      const res = await getCatalog(accessToken, "color=parchment&sort=name_asc");

      expect(namesOf(res)).toEqual(["explicit", "legacy hex", "no color"]);
    });

    it("rejects a color outside the palette with 400", async () => {
      const { accessToken } = await context.registerVerifyAndLogin();

      const res = await getCatalog(accessToken, "color=%23A96E47");

      expect(res.status).toBe(400);
    });
  });

  describe("sort", () => {
    it("B-SORT-01 sorts by usageCount descending by default", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const [first, second] = [await seed.book({ userId }), await seed.book({ userId })];
      await seed.tag({ name: "alpha", userId });
      const beta = await seed.tag({ name: "beta", userId });
      await seed.tagBooks({ bookIds: [first.id], tagId: beta.id });
      const gamma = await seed.tag({ name: "gamma", userId });
      await seed.tagBooks({ bookIds: [first.id, second.id], tagId: gamma.id });

      const res = await getCatalog(accessToken);

      expect(namesOf(res)).toEqual(["gamma", "beta", "alpha"]);
    });

    it("B-SORT-02 breaks a usage tie by name ascending", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seed.tag({ name: "charlie", userId });
      await seed.tag({ name: "alpha", userId });
      await seed.tag({ name: "bravo", userId });

      const res = await getCatalog(accessToken);

      expect(namesOf(res)).toEqual(["alpha", "bravo", "charlie"]);
    });

    it("B-SORT-02 breaks a usage and name tie by id ascending", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const first = await seed.tag({ name: "twin", normalizedName: "twin one", userId });
      const second = await seed.tag({ name: "twin", normalizedName: "twin two", userId });
      const expectedIds = [first.id, second.id].sort();

      const res = await getCatalog(accessToken);

      expect(itemsOf(res).map((item) => item.id)).toEqual(expectedIds);
    });

    it("B-SORT-03 books_count_desc puts the higher booksCount first even with lower usage", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const [first, second] = [await seed.book({ userId }), await seed.book({ userId })];
      const characters = [
        await seed.character({ name: "One", userId }),
        await seed.character({ name: "Two", userId }),
        await seed.character({ name: "Three", userId }),
      ];
      const characterHeavy = await seed.tag({ name: "alpha", userId });
      await seed.tagBooks({ bookIds: [first.id], tagId: characterHeavy.id });
      await seed.tagCharacters({
        characterIds: characters.map((character) => character.id),
        tagId: characterHeavy.id,
      });
      const bookHeavy = await seed.tag({ name: "beta", userId });
      await seed.tagBooks({ bookIds: [first.id, second.id], tagId: bookHeavy.id });

      const res = await getCatalog(accessToken, "sort=books_count_desc");

      expect(namesOf(res)).toEqual(["beta", "alpha"]);
    });

    it("B-SORT-04 characters_count_desc puts the higher charactersCount first even with lower usage", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const books = [
        await seed.book({ userId }),
        await seed.book({ userId }),
        await seed.book({ userId }),
      ];
      const [paul, chani] = [
        await seed.character({ name: "Paul", userId }),
        await seed.character({ name: "Chani", userId }),
      ];
      const bookHeavy = await seed.tag({ name: "alpha", userId });
      await seed.tagBooks({ bookIds: books.map((book) => book.id), tagId: bookHeavy.id });
      await seed.tagCharacters({ characterIds: [paul.id], tagId: bookHeavy.id });
      const characterHeavy = await seed.tag({ name: "beta", userId });
      await seed.tagCharacters({ characterIds: [paul.id, chani.id], tagId: characterHeavy.id });

      const res = await getCatalog(accessToken, "sort=characters_count_desc");

      expect(namesOf(res)).toEqual(["beta", "alpha"]);
    });

    it("B-SORT-05 type_asc follows the canonical type rank, not alphabetical order", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      for (const type of ["custom", "format", "character", "theme", "atmosphere", "trope"]) {
        await seed.tag({ name: `${type} tag`, type, userId });
      }

      const res = await getCatalog(accessToken, "sort=type_asc");

      expect(itemsOf(res).map((item) => item.type)).toEqual([
        "trope",
        "atmosphere",
        "theme",
        "character",
        "format",
        "custom",
      ]);
    });

    it("B-SORT-06 created_desc pages newest first with an id fallback for equal timestamps", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      await seed.tag({ createdAt: new Date("2026-01-01T00:00:00.000Z"), name: "oldest", userId });
      await seed.tag({ createdAt: new Date("2026-03-01T00:00:00.000Z"), name: "newest", userId });
      const tieFirst = await seed.tag({
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        name: "tie x",
        userId,
      });
      const tieSecond = await seed.tag({
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        name: "tie y",
        userId,
      });
      const tieIds = [tieFirst.id, tieSecond.id].sort();

      const firstPage = await getCatalog(accessToken, "sort=created_desc&pageNumber=1&pageSize=2");
      const secondPage = await getCatalog(accessToken, "sort=created_desc&pageNumber=2&pageSize=2");

      const pagedIds = [...itemsOf(firstPage), ...itemsOf(secondPage)].map((item) => item.id);
      expect(namesOf(firstPage)[0]).toBe("newest");
      expect(namesOf(secondPage)[1]).toBe("oldest");
      expect(pagedIds.slice(1, 3)).toEqual(tieIds);
    });
  });
});

describe("GET /api/tags/catalog/facets", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/tags/catalog/facets");

    expect(res.status).toBe(401);
  });

  it("B-FAC-01 returns all, used, books, characters and unused counts", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedUsageScenario(userId);

    const res = await getFacets(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      quickCounts: { all: 5, books: 2, characters: 2, unused: 2, used: 3 },
    });
  });

  it("B-FAC-01 never counts another user's tags", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seed.tag({ name: "mine", userId: owner.userId });
    await seedUsageScenario(stranger.userId);

    const res = await getFacets(owner.accessToken);

    expect(res.body.quickCounts).toEqual({
      all: 1,
      books: 0,
      characters: 0,
      unused: 1,
      used: 0,
    });
  });

  it("B-FAC-02 narrows every count by q, type and color", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book = await seed.book({ userId });
    const inContextUsed = await seed.tag({
      color: "sage",
      name: "dark forest",
      type: "trope",
      userId,
    });
    await seed.tagBooks({ bookIds: [book.id], tagId: inContextUsed.id });
    await seed.tag({ color: "sage", name: "dark hall", type: "trope", userId });
    const outOfContext = [
      await seed.tag({ color: "sage", name: "dark alley", type: "theme", userId }),
      await seed.tag({ color: "rose", name: "dark sky", type: "trope", userId }),
      await seed.tag({ color: "sage", name: "bright meadow", type: "trope", userId }),
    ];
    for (const tag of outOfContext) {
      await seed.tagBooks({ bookIds: [book.id], tagId: tag.id });
    }

    const res = await getFacets(accessToken, "q=dark&type=trope&color=sage");

    expect(res.body.quickCounts).toEqual({
      all: 2,
      books: 1,
      characters: 0,
      unused: 1,
      used: 1,
    });
  });

  it("B-FAC-03 ignores an active quick filter so the other counts do not collapse", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedUsageScenario(userId);

    const withoutFilter = await getFacets(accessToken);
    const withUnusedFilter = await getFacets(accessToken, "filter=unused");

    expect(withUnusedFilter.status).toBe(200);
    expect(withUnusedFilter.body).toEqual(withoutFilter.body);
    expect(withUnusedFilter.body.quickCounts.used).toBe(3);
  });

  it("B-FAC-04 returns the same counts regardless of sort and page", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedUsageScenario(userId);

    const baseline = await getFacets(accessToken);
    const withSortAndPage = await getFacets(accessToken, "sort=name_asc&pageNumber=3&pageSize=1");

    expect(withSortAndPage.status).toBe(200);
    expect(withSortAndPage.body).toEqual(baseline.body);
  });

  it("B-FAC-05 counts a tag used by both books and characters in both quick counts", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book = await seed.book({ userId });
    const character = await seed.character({ name: "Paul", userId });
    const tag = await seed.tag({ name: "both", userId });
    await seed.tagBooks({ bookIds: [book.id], tagId: tag.id });
    await seed.tagCharacters({ characterIds: [character.id], tagId: tag.id });

    const res = await getFacets(accessToken);

    expect(res.body.quickCounts).toMatchObject({ all: 1, books: 1, characters: 1, used: 1 });
  });
});
