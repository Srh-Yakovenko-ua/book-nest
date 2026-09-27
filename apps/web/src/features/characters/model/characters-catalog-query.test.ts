import { describe, expect, it } from "vitest";

import type { CharactersCatalogState } from "./characters-catalog-query";

import {
  CHARACTERS_CATALOG_PAGE_SIZE,
  countActiveAdvancedFilters,
  hasActiveCatalogFilters,
  toCharactersCatalogParams,
} from "./characters-catalog-query";

const base: CharactersCatalogState = {
  attitude: [],
  filter: "all",
  gender: [],
  groupId: [],
  importance: [],
  q: "",
  role: [],
  seriesId: null,
  sort: "name",
  view: "grid",
};

describe("toCharactersCatalogParams", () => {
  it("asks for the default page size and sort and nothing else", () => {
    expect(toCharactersCatalogParams(base)).toEqual({
      pageSize: CHARACTERS_CATALOG_PAGE_SIZE,
      sort: "name",
    });
  });

  it("maps every quick filter to its own backend predicate", () => {
    expect(toCharactersCatalogParams({ ...base, filter: "favorites" })).toMatchObject({
      favorite: "true",
    });
    expect(toCharactersCatalogParams({ ...base, filter: "multiple_books" })).toMatchObject({
      multipleBooks: "true",
    });
    expect(toCharactersCatalogParams({ ...base, filter: "with_impression" })).toMatchObject({
      hasPersonalImpression: "true",
    });
  });

  it("omits a blank search and trims a filled one", () => {
    expect(toCharactersCatalogParams({ ...base, q: "   " })).not.toHaveProperty("q");
    expect(toCharactersCatalogParams({ ...base, q: "  Ґеральт " })).toMatchObject({
      q: "Ґеральт",
    });
  });

  it("sends only the advanced filters that are set", () => {
    const params = toCharactersCatalogParams({
      ...base,
      importance: ["central"],
      seriesId: "series-1",
    });

    expect(params).toMatchObject({ importance: ["central"], seriesId: "series-1" });
    expect(params).not.toHaveProperty("gender");
    expect(params).not.toHaveProperty("groupId");
  });

  it("never sends the view, which is presentation only", () => {
    expect(toCharactersCatalogParams({ ...base, view: "list" })).not.toHaveProperty("view");
  });
});

describe("countActiveAdvancedFilters", () => {
  it("counts each non-empty group once", () => {
    expect(countActiveAdvancedFilters(base)).toBe(0);
    expect(
      countActiveAdvancedFilters({
        ...base,
        gender: ["male", "female"],
        importance: ["central"],
        seriesId: "series-1",
      }),
    ).toBe(3);
  });
});

describe("hasActiveCatalogFilters", () => {
  it("ignores the sort and the view", () => {
    expect(hasActiveCatalogFilters({ ...base, sort: "recently_added", view: "list" })).toBe(false);
  });

  it("sees a search, a quick filter and an advanced filter", () => {
    expect(hasActiveCatalogFilters({ ...base, q: "Ґ" })).toBe(true);
    expect(hasActiveCatalogFilters({ ...base, filter: "favorites" })).toBe(true);
    expect(hasActiveCatalogFilters({ ...base, role: ["protagonist"] })).toBe(true);
  });
});
