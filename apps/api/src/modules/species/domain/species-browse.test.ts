import type { CatalogLocale, Nullable, SpeciesOptionView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { orderSpeciesForBrowse } from "./species-browse.js";

const BROWSE_FIXTURE = {
  categoryOrder: ["humanoid", "elven"],
  groupLabels: { own: "own", uncategorized: "uncategorized" },
  sharedCategory: "mythical",
} as const;

function groupOf(entry: SpeciesOptionView): string {
  if (entry.isOwn) {
    return BROWSE_FIXTURE.groupLabels.own;
  }
  return entry.category?.key ?? BROWSE_FIXTURE.groupLabels.uncategorized;
}

function groupRuns(options: readonly SpeciesOptionView[]): string[] {
  return options
    .map(groupOf)
    .filter((group, index, groups) => index === 0 || group !== groups[index - 1]);
}

function ids(options: readonly SpeciesOptionView[]): string[] {
  return options.map((entry) => entry.id);
}

function namesInBrowseOrder(locale: CatalogLocale, names: readonly string[]): string[] {
  return orderSpeciesForBrowse({
    categoryOrder: [BROWSE_FIXTURE.sharedCategory],
    locale,
    options: names.map((name, index) =>
      option({ category: BROWSE_FIXTURE.sharedCategory, id: `species-${index}`, name }),
    ),
  }).map((entry) => entry.name);
}

function option({
  category = null,
  id,
  isOwn = false,
  name,
}: {
  category?: Nullable<string>;
  id: string;
  isOwn?: boolean;
  name: string;
}): SpeciesOptionView {
  return {
    category: category === null ? null : { key: category, name: category },
    id,
    isOwn,
    key: null,
    name,
  };
}

describe("orderSpeciesForBrowse group order", () => {
  it("lists own species, then catalog categories in catalog order, then unlisted categories by key, then uncategorized", () => {
    const ordered = orderSpeciesForBrowse({
      categoryOrder: BROWSE_FIXTURE.categoryOrder,
      locale: "uk",
      options: [
        option({ id: "uncategorized", name: "Аарон" }),
        option({ category: "zeta", id: "unlisted-zeta", name: "Бабай" }),
        option({ category: "alpha", id: "unlisted-alpha", name: "Вовкулака" }),
        option({ category: "elven", id: "elven", name: "Ельф" }),
        option({ category: "humanoid", id: "humanoid", name: "Людина" }),
        option({ id: "own", isOwn: true, name: "Ящірник" }),
      ],
    });

    expect(ids(ordered)).toEqual([
      "own",
      "humanoid",
      "elven",
      "unlisted-alpha",
      "unlisted-zeta",
      "uncategorized",
    ]);
  });

  it("keeps every group contiguous even when names interleave across groups", () => {
    const ordered = orderSpeciesForBrowse({
      categoryOrder: BROWSE_FIXTURE.categoryOrder,
      locale: "uk",
      options: [
        option({ category: "zeta", id: "zeta-1", name: "Нявка" }),
        option({ id: "none-1", name: "Шептун" }),
        option({ category: "alpha", id: "alpha-1", name: "Мавка" }),
        option({ id: "own-1", isOwn: true, name: "Яр" }),
        option({ category: "elven", id: "elven-1", name: "Ельф" }),
        option({ category: "humanoid", id: "humanoid-1", name: "Людина" }),
        option({ category: "zeta", id: "zeta-2", name: "Блуд" }),
        option({ id: "none-2", name: "Арахна" }),
        option({ category: "alpha", id: "alpha-2", name: "Гаргулья" }),
        option({ id: "own-2", isOwn: true, name: "Бук" }),
        option({ category: "elven", id: "elven-2", name: "Дроу" }),
        option({ category: "humanoid", id: "humanoid-2", name: "Велетень" }),
      ],
    });

    expect(groupRuns(ordered)).toEqual([
      "own",
      "humanoid",
      "elven",
      "alpha",
      "zeta",
      "uncategorized",
    ]);
  });
});

describe("orderSpeciesForBrowse name order within a group", () => {
  it("follows the Ukrainian alphabet for locale uk, placing ґ, є, і and ї after their base letters", () => {
    expect(
      namesInBrowseOrder("uk", ["Єдиноріг", "Ігуана", "Їжак", "Гоблін", "Дракон", "Ельф", "Ґном"]),
    ).toEqual(["Гоблін", "Ґном", "Дракон", "Ельф", "Єдиноріг", "Ігуана", "Їжак"]);
  });

  it("ignores case and accents for locale en", () => {
    expect(namesInBrowseOrder("en", ["Ent", "Zombie", "dryad", "elf", "Ångel"])).toEqual([
      "Ångel",
      "dryad",
      "elf",
      "Ent",
      "Zombie",
    ]);
  });

  it("puts Cyrillic names before Latin ones for locale uk", () => {
    expect(namesInBrowseOrder("uk", ["Elf", "Ельф", "Angel", "Ангел"])).toEqual([
      "Ангел",
      "Ельф",
      "Angel",
      "Elf",
    ]);
  });

  it("puts Latin names before Cyrillic ones for locale en", () => {
    expect(namesInBrowseOrder("en", ["Ельф", "Elf", "Ангел", "Angel"])).toEqual([
      "Angel",
      "Elf",
      "Ангел",
      "Ельф",
    ]);
  });

  it("breaks a tie between identical names by id", () => {
    const ordered = orderSpeciesForBrowse({
      categoryOrder: [BROWSE_FIXTURE.sharedCategory],
      locale: "uk",
      options: [
        option({
          category: BROWSE_FIXTURE.sharedCategory,
          id: "22222222-2222-4222-8222-222222222222",
          name: "Химера",
        }),
        option({
          category: BROWSE_FIXTURE.sharedCategory,
          id: "11111111-1111-4111-8111-111111111111",
          name: "Химера",
        }),
      ],
    });

    expect(ids(ordered)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });
});
