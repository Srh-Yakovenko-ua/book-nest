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
  bookId: null,
  filter: "all",
  gender: [],
  groupId: [],
  importance: [],
  q: "",
  role: [],
  seriesId: null,
  sort: "name",
  speciesId: [],
  spoilers: "all",
  tagId: [],
  view: "grid",
};

const ids = {
  book: "0b6f3c1e-2d4a-4f8b-9c7e-1a2b3c4d5e6f",
  elf: "5d7e9f1a-3b5c-4d6e-8f9a-0b1c2d3e4f5a",
  human: "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d",
  tag: "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
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

  it("asks for characters with or without spoilers through the backend flag", () => {
    expect(toCharactersCatalogParams({ ...base, spoilers: "with" })).toMatchObject({
      hasSpoilers: "true",
    });
    expect(toCharactersCatalogParams({ ...base, spoilers: "without" })).toMatchObject({
      hasSpoilers: "false",
    });
  });

  it("sends no spoiler flag while every character is shown", () => {
    expect(toCharactersCatalogParams({ ...base, spoilers: "all" })).not.toHaveProperty(
      "hasSpoilers",
    );
  });

  it("sends the chosen book, species and tags", () => {
    expect(
      toCharactersCatalogParams({
        ...base,
        bookId: ids.book,
        speciesId: [ids.elf, ids.human],
        tagId: [ids.tag],
      }),
    ).toEqual({
      bookId: ids.book,
      pageSize: CHARACTERS_CATALOG_PAGE_SIZE,
      sort: "name",
      speciesId: [ids.elf, ids.human],
      tagId: [ids.tag],
    });
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

  it("counts the book, the species, the tags and a spoiler choice once each", () => {
    expect(
      countActiveAdvancedFilters({
        ...base,
        bookId: ids.book,
        speciesId: [ids.elf, ids.human],
        spoilers: "without",
        tagId: [ids.tag],
      }),
    ).toBe(4);
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

  it("sees a spoiler choice as an active filter", () => {
    expect(hasActiveCatalogFilters({ ...base, spoilers: "with" })).toBe(true);
  });
});
