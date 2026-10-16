import type { BookView, Nullable, ReadingStatus } from "@app/shared";

import { createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";

import type { CharactersRosterState } from "./characters-roster-query";

import {
  canonicalRosterImportance,
  CHARACTERS_ROSTER_PAGE_SIZE,
  charactersRosterParsers,
  hasActiveRosterFilters,
  toBookCharactersListParams,
  toCharacterBookContext,
} from "./characters-roster-query";

const rosterState: CharactersRosterState = {
  characterFavoritesOnly: false,
  characterImportance: [],
  characterPovOnly: false,
  characterSearch: "",
  characterSort: "importance",
};

const serializeRoster = createSerializer(charactersRosterParsers);

function makeBookAt(currentPage: Nullable<number>, readingStatus: ReadingStatus): BookView {
  return makeBookView({
    id: "book-1",
    readingProgress: {
      abandonedAt: null,
      currentPage,
      finishedAt: null,
      impression: null,
      lastProgressUpdateAt: null,
      note: null,
      pausedAt: null,
      rating: null,
      startedAt: null,
    },
    readingStatus,
  });
}

function parseRosterUrl(search: string): CharactersRosterState {
  const params = new URLSearchParams(search);
  return {
    characterFavoritesOnly: charactersRosterParsers.characterFavoritesOnly.parseServerSide(
      params.get("characterFavoritesOnly") ?? undefined,
    ),
    characterImportance: charactersRosterParsers.characterImportance.parseServerSide(
      params.get("characterImportance") ?? undefined,
    ),
    characterPovOnly: charactersRosterParsers.characterPovOnly.parseServerSide(
      params.get("characterPovOnly") ?? undefined,
    ),
    characterSearch: charactersRosterParsers.characterSearch.parseServerSide(
      params.get("characterSearch") ?? undefined,
    ),
    characterSort: charactersRosterParsers.characterSort.parseServerSide(
      params.get("characterSort") ?? undefined,
    ),
  };
}

describe("toBookCharactersListParams", () => {
  it("always asks the backend for the selected sort", () => {
    expect(toBookCharactersListParams({ ...rosterState, characterSort: "name" }, {})).toEqual({
      pageSize: CHARACTERS_ROSTER_PAGE_SIZE,
      sort: "name",
    });
  });

  it("leaves the page number to the infinite query", () => {
    expect(toBookCharactersListParams(rosterState, {})).not.toHaveProperty("pageNumber");
  });

  it("omits an empty search and trims a filled one", () => {
    expect(toBookCharactersListParams(rosterState, {})).not.toHaveProperty("search");
    expect(
      toBookCharactersListParams({ ...rosterState, characterSearch: "  Ґеральт  " }, {}),
    ).toMatchObject({ search: "Ґеральт" });
  });

  it("sends only active filters, with importance in canonical order", () => {
    expect(
      toBookCharactersListParams(
        {
          ...rosterState,
          characterFavoritesOnly: true,
          characterImportance: ["not_specified", "major", "central", "major"],
          characterPovOnly: true,
        },
        {},
      ),
    ).toEqual({
      favoritesOnly: "true",
      importance: ["central", "major", "not_specified"],
      pageSize: CHARACTERS_ROSTER_PAGE_SIZE,
      povOnly: "true",
      sort: "importance",
    });
    const unfiltered = toBookCharactersListParams(rosterState, {});
    for (const key of ["favoritesOnly", "importance", "povOnly"]) {
      expect(unfiltered).not.toHaveProperty(key);
    }
  });

  it("forwards the context book to the backend", () => {
    expect(toBookCharactersListParams(rosterState, { contextBookId: "book-1" })).toEqual({
      contextBookId: "book-1",
      pageSize: CHARACTERS_ROSTER_PAGE_SIZE,
      sort: "importance",
    });
  });
});

describe("toCharacterBookContext", () => {
  it("names only the book while it is still being read", () => {
    expect(toCharacterBookContext(makeBookAt(42, "reading"))).toEqual({
      contextBookId: "book-1",
    });
  });

  it("reveals everything once the book is finished", () => {
    expect(toCharacterBookContext(makeBookAt(42, "finished"))).toEqual({});
  });

  it("reveals everything once the book is abandoned", () => {
    expect(toCharacterBookContext(makeBookAt(42, "dnf"))).toEqual({});
  });

  it("sends nothing when the book has no reading progress", () => {
    expect(toCharacterBookContext(makeBookView({ id: "book-1", readingProgress: null }))).toEqual(
      {},
    );
  });

  it("sends nothing when the current page is missing", () => {
    expect(toCharacterBookContext(makeBookAt(null, "reading"))).toEqual({});
  });

  it("sends nothing when the current page is not a positive whole page", () => {
    expect(toCharacterBookContext(makeBookAt(0, "reading"))).toEqual({});
    expect(toCharacterBookContext(makeBookAt(-3, "reading"))).toEqual({});
    expect(toCharacterBookContext(makeBookAt(4.5, "reading"))).toEqual({});
  });
});

describe("roster URL state", () => {
  it("round-trips every criterion and omits defaults", () => {
    const state: CharactersRosterState = {
      characterFavoritesOnly: true,
      characterImportance: canonicalRosterImportance(["not_specified", "central"]),
      characterPovOnly: true,
      characterSearch: "Ґеральт",
      characterSort: "name",
    };
    const url = serializeRoster(state);

    expect(parseRosterUrl(url)).toEqual(state);
    expect(serializeRoster(rosterState)).toBe("");
  });

  it("falls back to safe defaults for malformed values", () => {
    expect(
      parseRosterUrl(
        "?characterImportance=heroic,major&characterFavoritesOnly=maybe&characterSort=random",
      ),
    ).toEqual({ ...rosterState, characterImportance: ["major"] });
  });

  it("reports active filters independently of search and sort", () => {
    expect(hasActiveRosterFilters({ ...rosterState, characterSearch: "Ге" })).toBe(false);
    expect(hasActiveRosterFilters({ ...rosterState, characterSort: "name" })).toBe(false);
    expect(hasActiveRosterFilters({ ...rosterState, characterImportance: ["episodic"] })).toBe(
      true,
    );
    expect(hasActiveRosterFilters({ ...rosterState, characterPovOnly: true })).toBe(true);
  });
});
