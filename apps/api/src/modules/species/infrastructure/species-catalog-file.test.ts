import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

import { normalizeSpeciesName } from "../domain/species-name-normalizer.js";
import { readSpeciesCatalog, type SpeciesCatalog } from "./species-catalog-file.js";

const EXPECTED_CATALOG = {
  categoryCount: 15,
  labelsPerSpecies: 2,
  speciesCount: 114,
} as const;

const EXPAND_MIGRATION_URL = new URL(
  "../../../../prisma/migrations/20261009112906_species_catalog_expand/migration.sql",
  import.meta.url,
);

const SEED_TUPLE =
  /^\s+\('((?:[^']|'')*)', '((?:[^']|'')*)', '((?:[^']|'')*)', '((?:[^']|'')*)'\),?\r?$/gm;

const LABELS_INSERT = 'INSERT INTO "species_names"';

let catalog: SpeciesCatalog;
let migrationSql: string;

function seedTuples(sql: string): string[] {
  return Array.from(sql.matchAll(SEED_TUPLE), (match) =>
    match
      .slice(1)
      .map((value) => value.replaceAll("''", "'"))
      .join("|"),
  ).sort();
}

beforeAll(async () => {
  catalog = await readSpeciesCatalog();
  migrationSql = await readFile(EXPAND_MIGRATION_URL, "utf8");
});

describe("species catalog fixture", () => {
  it("holds exactly 114 species and says so", () => {
    expect(catalog.items).toHaveLength(EXPECTED_CATALOG.speciesCount);
    expect(catalog.count).toBe(EXPECTED_CATALOG.speciesCount);
  });

  it("gives every species a unique key", () => {
    expect(new Set(catalog.items.map((item) => item.key)).size).toBe(EXPECTED_CATALOG.speciesCount);
  });

  it("gives every species non-empty uk and en labels", () => {
    const blank = catalog.items
      .filter(
        (item) =>
          normalizeSpeciesName(item.nameUk) === "" || normalizeSpeciesName(item.nameEn) === "",
      )
      .map((item) => item.key);

    expect(blank).toEqual([]);
  });

  it("keeps all 228 labels pairwise distinct after species normalization", () => {
    const labels = catalog.items.flatMap((item) => [
      normalizeSpeciesName(item.nameUk),
      normalizeSpeciesName(item.nameEn),
    ]);

    expect(labels).toHaveLength(EXPECTED_CATALOG.speciesCount * EXPECTED_CATALOG.labelsPerSpecies);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("declares 15 categories whose counts match their items and sum to 114", () => {
    expect(catalog.categories).toHaveLength(EXPECTED_CATALOG.categoryCount);
    expect(new Set(catalog.categories.map((category) => category.key)).size).toBe(
      EXPECTED_CATALOG.categoryCount,
    );

    const declaredCounts = Object.fromEntries(
      catalog.categories.map((category) => [category.key, category.count]),
    );
    const actualCounts = Object.fromEntries(
      catalog.categories.map((category) => [
        category.key,
        catalog.items.filter((item) => item.categoryKey === category.key).length,
      ]),
    );

    expect(actualCounts).toEqual(declaredCounts);

    const declaredTotal = catalog.categories.reduce((total, category) => total + category.count, 0);
    expect(declaredTotal).toBe(EXPECTED_CATALOG.speciesCount);
  });

  it("repeats each category label exactly as its category declares it", () => {
    const categoriesByKey = new Map(catalog.categories.map((category) => [category.key, category]));

    const mismatched = catalog.items
      .filter((item) => {
        const category = categoriesByKey.get(item.categoryKey);
        return item.categoryUk !== category?.nameUk || item.categoryEn !== category.nameEn;
      })
      .map((item) => item.key);

    expect(mismatched).toEqual([]);
  });
});

describe("species seed inside the expand migration", () => {
  it("inserts exactly the fixture species with their normalized English names", () => {
    const [speciesSection = ""] = migrationSql.split(LABELS_INSERT);
    const expected = catalog.items
      .map((item) =>
        [item.key, item.nameEn, normalizeSpeciesName(item.nameEn), item.categoryKey].join("|"),
      )
      .sort();

    expect(seedTuples(speciesSection)).toEqual(expected);
  });

  it("inserts exactly the fixture uk and en labels with their normalized forms", () => {
    const [, labelsSection = ""] = migrationSql.split(LABELS_INSERT);
    const expected = catalog.items
      .flatMap((item) => [
        [item.key, "uk", item.nameUk, normalizeSpeciesName(item.nameUk)].join("|"),
        [item.key, "en", item.nameEn, normalizeSpeciesName(item.nameEn)].join("|"),
      ])
      .sort();

    expect(seedTuples(labelsSection)).toEqual(expected);
  });
});
