import type { SpeciesOptionView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import {
  OwnSpeciesListSchema,
  SpeciesCandidatesSchema,
  SpeciesSearchResultSchema,
} from "@app/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { SpeciesCatalogItem } from "../infrastructure/species-catalog-file.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { seedSystemSpeciesCatalog } from "../../../test/system-species.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { readSpeciesCatalog } from "../infrastructure/species-catalog-file.js";
import { SpeciesRepository } from "../infrastructure/species.repository.js";
import { SpeciesModule } from "../species.module.js";
import { speciesApi } from "./species-api.fixtures.js";

const SYSTEM_SPECIES_COUNT = 114;
const CATALOG_PROBE_BATCH = 6;
const CATALOG_PROBE_TIMEOUT_MS = 60_000;
const LIGATURE_EXPANDING_TO_18_CHARS = "\uFDFA";

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

function batchesOf<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

function candidateIds(body: unknown): string[] {
  const { exact, similar } = SpeciesCandidatesSchema.parse(body);
  return [...(exact === null ? [] : [exact.id]), ...similar.map((item) => item.id)];
}

function ownNames(body: unknown): string[] {
  return OwnSpeciesListSchema.parse(body).items.map((item) => item.name);
}

function searchItems(body: unknown): SpeciesOptionView[] {
  return SpeciesSearchResultSchema.parse(body).items;
}

async function signIn(): Promise<ReturnType<typeof speciesApi>> {
  const { accessToken } = await context.registerVerifyAndLogin();
  return speciesApi({ accessToken, app });
}

describe("species API authentication", () => {
  it("returns 401 for a search without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/species");

    expect(res.status).toBe(401);
  });
});

describe("GET /api/species/candidates over the system catalog", () => {
  it(
    "resolves each of the 114 system species by its uk label and by its en label",
    async () => {
      const api = await signIn();
      const catalog = await readSpeciesCatalog();
      const resolvedIds = new Set<string>();
      const mismatches: string[] = [];

      async function probe(item: SpeciesCatalogItem): Promise<void> {
        const [uk, en] = await Promise.all([
          api.candidates(item.nameUk, "uk"),
          api.candidates(item.nameEn, "en"),
        ]);
        const ukExact = SpeciesCandidatesSchema.parse(uk.body).exact;
        const enExact = SpeciesCandidatesSchema.parse(en.body).exact;
        if (ukExact?.key !== item.key || ukExact.name !== item.nameUk) {
          mismatches.push(`uk ${item.key}`);
        }
        if (enExact?.key !== item.key || enExact.name !== item.nameEn) {
          mismatches.push(`en ${item.key}`);
        }
        if (ukExact !== null && ukExact.id === enExact?.id) {
          resolvedIds.add(ukExact.id);
        }
      }

      for (const batch of batchesOf(catalog.items, CATALOG_PROBE_BATCH)) {
        await Promise.all(batch.map(probe));
      }

      expect(mismatches).toEqual([]);
      expect(resolvedIds.size).toBe(SYSTEM_SPECIES_COUNT);
    },
    CATALOG_PROBE_TIMEOUT_MS,
  );

  it("keeps the exact match but skips similar names for a name that normalizes past 120 characters", async () => {
    const api = await signIn();
    const expandingName = `${LIGATURE_EXPANDING_TO_18_CHARS.repeat(118)}zz`;
    const contained = await api.create(LIGATURE_EXPANDING_TO_18_CHARS.normalize("NFKC"));
    const stored = await api.create(expandingName);

    const res = await api.candidates(expandingName);

    expect(contained.status).toBe(201);
    expect(stored.status).toBe(201);
    expect(res.status).toBe(200);
    expect(SpeciesCandidatesSchema.parse(res.body)).toMatchObject({
      exact: { id: stored.body.id },
      similar: [],
    });
  });
});

describe("GET /api/species labels", () => {
  it("labels a system species in English with its English category for locale=en", async () => {
    const api = await signIn();

    const res = await api.search({ locale: "en", q: "dark" });

    expect(res.status).toBe(200);
    expect(searchItems(res.body)).toContainEqual(
      expect.objectContaining({
        category: { key: "elven", name: "Elves & kin" },
        isOwn: false,
        key: "dark_elf",
        name: "Dark elf",
      }),
    );
  });

  it("labels the same system species in Ukrainian for locale=uk", async () => {
    const api = await signIn();

    const res = await api.search({ locale: "uk", q: "темний" });

    expect(searchItems(res.body)).toContainEqual(
      expect.objectContaining({
        category: { key: "elven", name: "Ельфи та споріднені" },
        key: "dark_elf",
        name: "Темний ельф",
      }),
    );
  });

  it("finds a system species by its Ukrainian label while answering in English", async () => {
    const api = await signIn();

    const res = await api.search({ locale: "en", q: "темний" });

    expect(searchItems(res.body)).toContainEqual(
      expect.objectContaining({ key: "dark_elf", name: "Dark elf" }),
    );
  });

  it("shows an own species under the entered name in both locales", async () => {
    const api = await signIn();
    const created = await api.create("Зорянин");

    const [uk, en] = await Promise.all([
      api.search({ locale: "uk", q: "зорян" }),
      api.search({ locale: "en", q: "зорян" }),
    ]);

    const expected = {
      category: null,
      id: created.body.id,
      isOwn: true,
      key: null,
      name: "Зорянин",
    };
    expect(searchItems(uk.body)).toEqual([expected]);
    expect(searchItems(en.body)).toEqual([expected]);
  });
});

describe("GET /api/species result size", () => {
  it("caps a broad query at 10 results even though more species match", async () => {
    const api = await signIn();

    const res = await api.search({ locale: "uk", q: "ль" });

    expect(searchItems(res.body)).toHaveLength(10);
  });

  it("offers 8 to 12 suggestions for an empty query, popular system species first, then the newest own ones", async () => {
    const api = await signIn();
    await api.create("Зорянин");
    await api.create("Мороколь");
    await api.create("Туманник");

    const items = searchItems((await api.search({ locale: "uk" })).body);
    const ownItems = items.filter((item) => item.isOwn);

    expect(items.length).toBeGreaterThanOrEqual(8);
    expect(items.length).toBeLessThanOrEqual(12);
    expect(items.slice(-ownItems.length).every((item) => item.isOwn)).toBe(true);
    expect(ownItems.map((item) => item.name)).toEqual(["Туманник", "Мороколь"]);
  });
});

describe("species visibility between users", () => {
  it("never shows one user's species to another in search", async () => {
    const alice = await signIn();
    const bob = await signIn();
    await alice.create("Зорянин");
    await bob.create("Мороколь");

    const [aliceSeesOwn, aliceSeesBob, bobSeesOwn, bobSeesAlice] = await Promise.all([
      alice.search({ q: "зорян" }),
      alice.search({ q: "мороко" }),
      bob.search({ q: "мороко" }),
      bob.search({ q: "зорян" }),
    ]);

    expect(searchItems(aliceSeesOwn.body).map((item) => item.name)).toEqual(["Зорянин"]);
    expect(searchItems(aliceSeesBob.body)).toEqual([]);
    expect(searchItems(bobSeesOwn.body).map((item) => item.name)).toEqual(["Мороколь"]);
    expect(searchItems(bobSeesAlice.body)).toEqual([]);
  });

  it("keeps another user's species out of the empty-query suggestions", async () => {
    const alice = await signIn();
    const bob = await signIn();
    await bob.create("Мороколь");

    const items = searchItems((await alice.search({})).body);

    expect(items.every((item) => !item.isOwn)).toBe(true);
    expect(items.map((item) => item.name)).not.toContain("Мороколь");
  });

  it("never offers another user's species as an exact or similar candidate", async () => {
    const alice = await signIn();
    const bob = await signIn();
    const bobs = await bob.create("Мороколь");

    const [aliceExact, aliceNear, bobExact, bobNear] = await Promise.all([
      alice.candidates("Мороколь"),
      alice.candidates("Мороколі"),
      bob.candidates("Мороколь"),
      bob.candidates("Мороколі"),
    ]);

    expect(SpeciesCandidatesSchema.parse(aliceExact.body).exact).toBeNull();
    expect(candidateIds(aliceNear.body)).not.toContain(bobs.body.id);
    expect(SpeciesCandidatesSchema.parse(bobExact.body).exact?.id).toBe(bobs.body.id);
    expect(candidateIds(bobNear.body)).toContain(bobs.body.id);
  });

  it("lists only the caller's own species", async () => {
    const alice = await signIn();
    const bob = await signIn();
    await alice.create("Зорянин");
    await bob.create("Мороколь");

    const [aliceOwn, bobOwn] = await Promise.all([alice.own(), bob.own()]);

    expect(ownNames(aliceOwn.body)).toEqual(["Зорянин"]);
    expect(ownNames(bobOwn.body)).toEqual(["Мороколь"]);
  });

  it("lets two users each own a species with the same name", async () => {
    const alice = await signIn();
    const bob = await signIn();

    const aliceCreated = await alice.create("Зорянин");
    const bobCreated = await bob.create("Зорянин");

    expect(aliceCreated.status).toBe(201);
    expect(bobCreated.status).toBe(201);
    expect(bobCreated.body.id).not.toBe(aliceCreated.body.id);
  });
});

describe("species search with LIKE wildcard characters", () => {
  it("matches underscore and percent literally instead of as wildcards", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const api = speciesApi({ accessToken, app });
    const literal = await api.create("Лісо_вик");
    const repository = app.get(SpeciesRepository);

    const [underscores, percents, literalUnderscore, viaHttp] = await Promise.all([
      repository.searchVisible({ normalizedQuery: "__", userId }),
      repository.searchVisible({ normalizedQuery: "%%", userId }),
      repository.searchVisible({ normalizedQuery: "о_", userId }),
      api.search({ q: "__" }),
    ]);

    expect(underscores).toEqual([]);
    expect(percents).toEqual([]);
    expect(literalUnderscore.map((species) => species.id)).toEqual([literal.body.id]);
    expect(searchItems(viaHttp.body)).toEqual([]);
  });
});
