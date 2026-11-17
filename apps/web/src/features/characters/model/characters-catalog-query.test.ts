import { createLoader } from "nuqs/server";
import { describe, expect, it } from "vitest";

import type { CharactersCatalogState } from "./characters-catalog-query";

import {
  CHARACTERS_CATALOG_PAGE_SIZE,
  charactersCatalogParsers,
  countActiveAdvancedFilters,
  hasActiveCatalogFilters,
  toCharactersCatalogFilterParams,
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
  fellowship: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
  human: "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d",
  rangers: "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a",
  romance: "8d9e0f1a-2b3c-4d4e-9f5a-6b7c8d9e0f1a",
  tag: "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
};

const loadCatalogState = createLoader(charactersCatalogParsers);

function stateFrom(search: string): CharactersCatalogState {
  return loadCatalogState(new URLSearchParams(search));
}

describe("characters catalog URL state", () => {
  it("reads a known attitude from the URL", () => {
    expect(stateFrom("attitude=like,hate").attitude).toEqual(["like", "hate"]);
  });

  it("drops a stale favorite attitude so the request asks for no attitude", () => {
    const state = stateFrom("attitude=favorite");

    expect(state.attitude).toEqual([]);
    expect(toCharactersCatalogParams(state)).toEqual({
      pageSize: CHARACTERS_CATALOG_PAGE_SIZE,
      sort: "name",
    });
  });

  it("keeps the valid attitude next to a stale favorite one", () => {
    const state = stateFrom("attitude=favorite,like");

    expect(state.attitude).toEqual(["like"]);
    expect(toCharactersCatalogParams(state)).toEqual({
      attitude: ["like"],
      pageSize: CHARACTERS_CATALOG_PAGE_SIZE,
      sort: "name",
    });
  });

  it("does not count a stale favorite attitude as an active filter", () => {
    const state = stateFrom("attitude=favorite");

    expect(countActiveAdvancedFilters(state)).toBe(0);
    expect(hasActiveCatalogFilters(state)).toBe(false);
  });
});

describe("characters catalog URL validation", () => {
  it("keeps a book id that is a uuid", () => {
    expect(stateFrom(`bookId=${ids.book}`).bookId).toBe(ids.book);
  });

  it("drops a book id that is not a uuid", () => {
    expect(stateFrom("bookId=abc").bookId).toBeNull();
  });

  it("drops a series id that is not a uuid", () => {
    expect(stateFrom("seriesId=abc").seriesId).toBeNull();
  });

  it("keeps the species uuids and drops the rest", () => {
    expect(stateFrom(`speciesId=${ids.elf},abc`).speciesId).toEqual([ids.elf]);
  });

  it("reads a tag list without any uuid as no tags", () => {
    expect(stateFrom("tagId=abc").tagId).toEqual([]);
  });

  it("keeps the group uuids and drops the rest", () => {
    expect(stateFrom(`groupId=abc,${ids.human}`).groupId).toEqual([ids.human]);
  });

  it("keeps a known gender and drops an unknown one", () => {
    expect(stateFrom("gender=female,junk").gender).toEqual(["female"]);
  });

  it("reads an unknown importance as no importance", () => {
    expect(stateFrom("importance=junk").importance).toEqual([]);
  });

  it("keeps a known role and drops an unknown one", () => {
    expect(stateFrom("role=protagonist,nope").role).toEqual(["protagonist"]);
  });

  it("asks the backend for none of the values it dropped", () => {
    expect(
      toCharactersCatalogParams(
        stateFrom("bookId=abc&seriesId=abc&speciesId=abc&tagId=abc&groupId=abc&gender=junk"),
      ),
    ).toEqual({ pageSize: CHARACTERS_CATALOG_PAGE_SIZE, sort: "name" });
  });
});

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

  it("asks for the same params whichever order the species and groups were picked in", () => {
    const pickedInOrder = toCharactersCatalogParams({
      ...base,
      groupId: [ids.fellowship, ids.rangers],
      speciesId: [ids.elf, ids.human],
    });
    const pickedReversed = toCharactersCatalogParams({
      ...base,
      groupId: [ids.rangers, ids.fellowship],
      speciesId: [ids.human, ids.elf],
    });

    expect(pickedReversed).toEqual(pickedInOrder);
    expect(pickedReversed).toEqual({
      groupId: [ids.fellowship, ids.rangers],
      pageSize: CHARACTERS_CATALOG_PAGE_SIZE,
      sort: "name",
      speciesId: [ids.elf, ids.human],
    });
  });
});

describe("toCharactersCatalogFilterParams", () => {
  it("sends every other list filter in one order whichever order it was picked in", () => {
    expect(
      toCharactersCatalogFilterParams({
        ...base,
        attitude: ["unsure", "like"],
        gender: ["male", "female"],
        importance: ["major", "central"],
        role: ["protagonist", "antagonist"],
        tagId: [ids.tag, ids.romance],
      }),
    ).toEqual({
      attitude: ["like", "unsure"],
      gender: ["female", "male"],
      importance: ["central", "major"],
      role: ["antagonist", "protagonist"],
      tagId: [ids.romance, ids.tag],
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
