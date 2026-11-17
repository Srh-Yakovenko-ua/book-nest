import type { BookView, Nullable, ReadingStatus } from "@app/shared";

import { createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";

import type { CharactersRosterState } from "./characters-roster-query";

import {
  canonicalRosterImportance,
  CHARACTERS_ROSTER_PAGE_SIZE,
  CHARACTERS_ROSTER_RESET,
  charactersRosterParsers,
  hasActiveRosterFilters,
  toBookCharactersListParams,
  toCharacterBookContext,
} from "./characters-roster-query";

const rosterState: CharactersRosterState = {
  characterFilter: "all",
  characterImportance: [],
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
    characterFilter: charactersRosterParsers.characterFilter.parseServerSide(
      params.get("characterFilter") ?? undefined,
    ),
    characterImportance: charactersRosterParsers.characterImportance.parseServerSide(
      params.get("characterImportance") ?? undefined,
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
          characterFilter: "favorites",
          characterImportance: ["not_specified", "major", "central", "major"],
        },
        {},
      ),
    ).toEqual({
      favoritesOnly: "true",
      importance: ["central", "major", "not_specified"],
      pageSize: CHARACTERS_ROSTER_PAGE_SIZE,
      sort: "importance",
    });
    const unfiltered = toBookCharactersListParams(rosterState, {});
    for (const key of ["favoritesOnly", "importance", "povOnly"]) {
      expect(unfiltered).not.toHaveProperty(key);
    }
  });

  it("sends the POV quick filter as the POV-only flag and nothing for favorites", () => {
    expect(toBookCharactersListParams({ ...rosterState, characterFilter: "pov" }, {})).toEqual({
      pageSize: CHARACTERS_ROSTER_PAGE_SIZE,
      povOnly: "true",
      sort: "importance",
    });
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
      characterFilter: "pov",
      characterImportance: canonicalRosterImportance(["not_specified", "central"]),
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
        "?characterImportance=heroic,major&characterFilter=maybe&characterSort=random",
      ),
    ).toEqual({ ...rosterState, characterImportance: ["major"] });
  });

  it("reports active filters independently of search and sort", () => {
    expect(hasActiveRosterFilters({ ...rosterState, characterSearch: "Ге" })).toBe(false);
    expect(hasActiveRosterFilters({ ...rosterState, characterSort: "name" })).toBe(false);
    expect(hasActiveRosterFilters({ ...rosterState, characterImportance: ["episodic"] })).toBe(
      true,
    );
    expect(hasActiveRosterFilters({ ...rosterState, characterFilter: "favorites" })).toBe(true);
    expect(hasActiveRosterFilters({ ...rosterState, characterFilter: "pov" })).toBe(true);
  });

  it("drops the quick filter and importance on a filter reset but keeps search and sort", () => {
    const url = serializeRoster(
      "?characterSearch=Ге&characterFilter=pov&characterImportance=major&characterSort=name",
      CHARACTERS_ROSTER_RESET.filters,
    );

    expect(Object.fromEntries(new URLSearchParams(url))).toEqual({
      characterSearch: "Ге",
      characterSort: "name",
    });
  });
});
