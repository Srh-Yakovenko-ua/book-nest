import { createLoader, createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";

import type { BookNotesTabState } from "./book-notes-tab-query";

import {
  BOOK_NOTES_TAB,
  BOOK_NOTES_TAB_PARSERS,
  BOOK_NOTES_TAB_RESET,
  bookNotesCategoryPatch,
  committedBookNotesSearch,
  hasActiveBookNotesFilters,
  toBookNotesFacetsParams,
  toBookNotesListParams,
  toBookNotesTabSort,
} from "./book-notes-tab-query";

const BOOK_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

const loadBookNotesTab = createLoader(BOOK_NOTES_TAB_PARSERS);
const serializeBookNotesTab = createSerializer(BOOK_NOTES_TAB_PARSERS);

function stateFrom(search: string): BookNotesTabState {
  return loadBookNotesTab(new URLSearchParams(search));
}

describe("book notes tab URL state", () => {
  it("falls back to the defaults for an empty URL", () => {
    expect(stateFrom("")).toEqual({
      noteCategory: [],
      noteCustomCategory: [],
      noteFilter: "all",
      noteQ: "",
      noteSort: "page",
    });
  });

  it("reads every criterion from its namespaced key", () => {
    expect(
      stateFrom(
        "noteQ=dune&noteFilter=pinned&noteSort=oldest&noteCategory=plot,question&noteCustomCategory=Lore",
      ),
    ).toEqual({
      noteCategory: ["plot", "question"],
      noteCustomCategory: ["Lore"],
      noteFilter: "pinned",
      noteQ: "dune",
      noteSort: "oldest",
    });
  });

  it("ignores the global archive keys", () => {
    expect(stateFrom("q=dune&filter=pinned&sort=oldest&category=plot")).toEqual(stateFrom(""));
  });

  it("offers exactly the five book sorts", () => {
    expect(BOOK_NOTES_TAB.sortOptions).toEqual([
      "page",
      "newest",
      "oldest",
      "recently_updated",
      "pinned_first",
    ]);
  });

  it.each(["title", "author", "random"])("falls back to page for the %s sort", (sort) => {
    expect(stateFrom(`noteSort=${sort}`).noteSort).toBe("page");
    expect(toBookNotesTabSort(sort)).toBe("page");
  });

  it("drops an unknown filter and category instead of failing", () => {
    expect(stateFrom("noteFilter=everything&noteCategory=plot,nonsense")).toMatchObject({
      noteCategory: ["plot"],
      noteFilter: "all",
    });
  });

  it("keeps defaults out of the URL", () => {
    expect(serializeBookNotesTab({ noteFilter: "all", noteQ: "", noteSort: "page" })).toBe("");
  });
});

describe("book notes tab search", () => {
  it.each([
    ["a", ""],
    ["7", "7"],
    ["ab", "ab"],
    ["  dune  ", "dune"],
  ])("commits %j as %j", (noteQ, committed) => {
    expect(committedBookNotesSearch({ ...stateFrom(""), noteQ })).toBe(committed);
  });
});

describe("book notes tab params", () => {
  it("scopes the default list to the book with notes-only search", () => {
    expect(toBookNotesListParams(BOOK_ID, stateFrom(""))).toEqual({
      book: [BOOK_ID],
      filter: "all",
      pageSize: 20,
      scope: "books",
      searchIn: "notes",
      sort: "page",
    });
  });

  it("carries the committed criteria into the list and facets params", () => {
    const state = stateFrom(
      "noteQ=dune&noteFilter=favorite&noteSort=newest&noteCategory=plot&noteCustomCategory=Lore",
    );

    expect(toBookNotesListParams(BOOK_ID, state)).toEqual({
      book: [BOOK_ID],
      category: ["plot"],
      customCategory: ["Lore"],
      filter: "favorite",
      pageSize: 20,
      scope: "books",
      search: "dune",
      searchIn: "notes",
      sort: "newest",
    });
    expect(toBookNotesFacetsParams(BOOK_ID, state)).toEqual({
      book: [BOOK_ID],
      category: ["plot"],
      customCategory: ["Lore"],
      search: "dune",
      searchIn: "notes",
    });
  });

  it("leaves an uncommitted search out of the params", () => {
    expect(toBookNotesFacetsParams(BOOK_ID, stateFrom("noteQ=a"))).not.toHaveProperty("search");
  });

  it("separates active filters from an active search", () => {
    expect(hasActiveBookNotesFilters(stateFrom("noteQ=dune&noteSort=newest"))).toBe(false);
    expect(hasActiveBookNotesFilters(stateFrom("noteFilter=pinned"))).toBe(true);
    expect(hasActiveBookNotesFilters(stateFrom("noteCustomCategory=Lore"))).toBe(true);
  });
});

describe("book notes tab reset patches", () => {
  it("splits the filter reset from the search reset", () => {
    expect(BOOK_NOTES_TAB_RESET.filters).toEqual({
      noteCategory: null,
      noteCustomCategory: null,
      noteFilter: null,
    });
    expect(BOOK_NOTES_TAB_RESET.search).toEqual({ noteQ: null });
  });

  it("leaves the tab, character, search and sort keys in the URL when clearing the filters", () => {
    const url = new URLSearchParams(
      "tab=notes&characterSearch=paul&noteQ=dune&noteFilter=pinned&noteSort=oldest&noteCategory=plot",
    );

    const cleared = new URLSearchParams(serializeBookNotesTab(url, BOOK_NOTES_TAB_RESET.filters));

    expect([...cleared.keys()]).toEqual(["tab", "characterSearch", "noteQ", "noteSort"]);
  });

  it("writes only the category keys when the categories change", () => {
    expect(bookNotesCategoryPatch({ category: [], customCategory: [] })).toEqual({
      noteCategory: [],
      noteCustomCategory: [],
    });
  });
});
