import type { CatalogLocale, SpeciesBrowsePage, SpeciesOptionView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { SpeciesBrowsePageSchema } from "@app/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { SpeciesApi } from "./species-api.fixtures.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { seedSystemSpeciesCatalog } from "../../../test/system-species.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { readSpeciesCatalog } from "../infrastructure/species-catalog-file.js";
import { SpeciesModule } from "../species.module.js";
import { speciesApi } from "./species-api.fixtures.js";

const BROWSE = {
  maxPageSize: 100,
  systemSpeciesCount: 114,
} as const;

type BrowseQuery = Parameters<SpeciesApi["browse"]>[0];

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, SpeciesModule]);
  app = context.app;
});

beforeEach(async () => {
  context.reset();
  await seedSystemSpeciesCatalog(app);
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function browseAll(api: SpeciesApi, locale?: CatalogLocale): Promise<SpeciesOptionView[]> {
  const pages = await browsePages(api, { locale, pageSize: BROWSE.maxPageSize });
  return pages.flatMap((page) => page.items);
}

async function browsePage(api: SpeciesApi, query: BrowseQuery): Promise<SpeciesBrowsePage> {
  return SpeciesBrowsePageSchema.parse((await api.browse(query)).body);
}

async function browsePages(
  api: SpeciesApi,
  { locale, pageSize }: { locale?: CatalogLocale; pageSize: number },
): Promise<SpeciesBrowsePage[]> {
  const first = await browsePage(api, { locale, pageNumber: 1, pageSize });
  const rest = await Promise.all(
    Array.from({ length: Math.max(first.pagesCount - 1, 0) }, (_, index) =>
      browsePage(api, { locale, pageNumber: index + 2, pageSize }),
    ),
  );
  return [first, ...rest];
}

function categoryRuns(items: readonly SpeciesOptionView[]): string[] {
  return items
    .flatMap((item) => (item.isOwn || item.category === null ? [] : [item.category.key]))
    .filter((key, index, keys) => index === 0 || key !== keys[index - 1]);
}

function findByKey(
  items: readonly SpeciesOptionView[],
  key: string,
): SpeciesOptionView | undefined {
  return items.find((item) => item.key === key);
}

async function signIn(): Promise<SpeciesApi> {
  const { accessToken } = await context.registerVerifyAndLogin();
  return speciesApi({ accessToken, app });
}

describe("GET /api/species/browse access and validation", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/species/browse");

    expect(res.status).toBe(401);
  });

  it.each([0, 101])("rejects pageSize=%i with 400 naming the pageSize field", async (pageSize) => {
    const api = await signIn();

    const res = await api.browse({ pageSize });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "pageSize" })]),
    );
  });
});

describe("GET /api/species/browse pagination", () => {
  it("serves the first page at 30 species when no paging is given", async () => {
    const api = await signIn();

    const res = await api.browse({});
    const page = SpeciesBrowsePageSchema.parse(res.body);

    expect(res.status).toBe(200);
    expect({ ...page, items: page.items.length }).toEqual({
      items: 30,
      page: 1,
      pagesCount: 4,
      pageSize: 30,
      totalCount: BROWSE.systemSpeciesCount,
    });
  });

  it("fills each page up to pageSize and reports the same totals on every page", async () => {
    const api = await signIn();
    await api.create("Зорянин");
    await api.create("Мороколь");

    const pages = await browsePages(api, { pageSize: 50 });

    expect(pages.map((page) => ({ ...page, items: page.items.length }))).toEqual([
      { items: 50, page: 1, pagesCount: 3, pageSize: 50, totalCount: 116 },
      { items: 50, page: 2, pagesCount: 3, pageSize: 50, totalCount: 116 },
      { items: 16, page: 3, pagesCount: 3, pageSize: 50, totalCount: 116 },
    ]);
  });

  it("spreads every visible species across the pages exactly once", async () => {
    const api = await signIn();
    const zorianyn = await api.create("Зорянин");
    const morokol = await api.create("Мороколь");
    const catalog = await readSpeciesCatalog();

    const items = (await browsePages(api, { pageSize: 50 })).flatMap((page) => page.items);

    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(new Set(items.flatMap((item) => (item.key === null ? [] : [item.key])))).toEqual(
      new Set(catalog.items.map((item) => item.key)),
    );
    expect(new Set(items.filter((item) => item.isOwn).map((item) => item.id))).toEqual(
      new Set([morokol.body.id, zorianyn.body.id]),
    );
  });

  it("returns an empty page past the last one while keeping the totals", async () => {
    const api = await signIn();

    const page = await browsePage(api, { pageNumber: 5, pageSize: 30 });

    expect(page).toEqual({
      items: [],
      page: 5,
      pagesCount: 4,
      pageSize: 30,
      totalCount: BROWSE.systemSpeciesCount,
    });
  });
});

describe("GET /api/species/browse visibility", () => {
  it("lists the caller's own species before any system species, ordered by name", async () => {
    const api = await signIn();
    await api.create("Туманник");
    await api.create("Зорянин");
    await api.create("Мороколь");

    const { items } = await browsePage(api, {});

    expect(items.slice(0, 3).map((item) => item.name)).toEqual(["Зорянин", "Мороколь", "Туманник"]);
    expect(items.slice(0, 4).map((item) => item.isOwn)).toEqual([true, true, true, false]);
  });

  it("never lists another user's own species", async () => {
    const alice = await signIn();
    const bob = await signIn();
    await alice.create("Зорянин");
    const bobs = await bob.create("Мороколь");

    const items = await browseAll(alice);

    expect(items.map((item) => item.id)).not.toContain(bobs.body.id);
    expect(items).toHaveLength(BROWSE.systemSpeciesCount + 1);
  });
});

describe("GET /api/species/browse system species order", () => {
  it("groups system species by category in the catalog's category order", async () => {
    const api = await signIn();
    const catalog = await readSpeciesCatalog();

    const items = await browseAll(api);

    expect(categoryRuns(items)).toEqual(catalog.categories.map((category) => category.key));
  });

  it("places a system species whose category the catalog does not list after every listed category", async () => {
    const api = await signIn();
    await app.get(PrismaService).species.create({
      data: {
        categoryKey: "aardvarks",
        key: "probe_unlisted",
        name: "Аарон",
        normalizedName: "аарон",
      },
    });

    const items = await browseAll(api);

    expect(items.at(-1)).toMatchObject({
      category: { key: "aardvarks", name: "aardvarks" },
      key: "probe_unlisted",
    });
  });
});

describe("GET /api/species/browse locale", () => {
  it("labels species and their category in Ukrainian when no locale is given", async () => {
    const api = await signIn();

    const items = await browseAll(api);

    expect(findByKey(items, "dark_elf")).toMatchObject({
      category: { key: "elven", name: "Ельфи та споріднені" },
      name: "Темний ельф",
    });
  });

  it("labels species and their category in English for locale=en", async () => {
    const api = await signIn();

    const items = await browseAll(api, "en");

    expect(findByKey(items, "dark_elf")).toMatchObject({
      category: { key: "elven", name: "Elves & kin" },
      name: "Dark elf",
    });
  });

  it("orders a category by its English names for locale=en", async () => {
    const api = await signIn();

    const items = await browseAll(api, "en");

    expect(items.filter((item) => item.category?.key === "elven").map((item) => item.name)).toEqual(
      ["Dark elf", "Elf", "Half-elf", "High elf", "Ice elf", "Sea elf", "Wood elf"],
    );
  });
});
