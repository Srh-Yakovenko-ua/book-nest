import { createLoader, createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";

import type { BookQuotesTabState } from "./book-quotes-tab-query";

import {
  BOOK_QUOTES_TAB,
  BOOK_QUOTES_TAB_PARSERS,
  BOOK_QUOTES_TAB_RESET,
  committedBookQuotesSearch,
  hasActiveBookQuotesFilters,
  toBookQuotesFacetsParams,
  toBookQuotesListParams,
  toBookQuotesTabSort,
} from "./book-quotes-tab-query";

const BOOK_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

const OTHER_BOOK_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const loadBookQuotesTab = createLoader(BOOK_QUOTES_TAB_PARSERS);
const serializeBookQuotesTab = createSerializer(BOOK_QUOTES_TAB_PARSERS);

function stateFrom(search: string): BookQuotesTabState {
  return loadBookQuotesTab(new URLSearchParams(search));
}

describe("book quotes tab URL state", () => {
  it("falls back to the defaults for an empty URL", () => {
    expect(stateFrom("")).toEqual({ quoteFilter: "all", quoteQ: "", quoteSort: "page" });
  });

  it("reads every criterion from its namespaced key", () => {
    expect(stateFrom("quoteQ=страх&quoteFilter=favorites&quoteSort=oldest")).toEqual({
      quoteFilter: "favorites",
      quoteQ: "страх",
      quoteSort: "oldest",
    });
  });

  it("ignores the global archive keys", () => {
    expect(stateFrom("q=страх&filter=favorites&sort=oldest&view=list")).toEqual(stateFrom(""));
  });

  it("offers exactly page, newest and oldest", () => {
    expect(BOOK_QUOTES_TAB.sortOptions).toEqual(["page", "newest", "oldest"]);
  });

  it.each(["book_title", "book_author", "favorites_first", "random"])(
    "falls back to page for the %s sort",
    (sort) => {
      expect(stateFrom(`quoteSort=${sort}`).quoteSort).toBe("page");
      expect(toBookQuotesTabSort(sort)).toBe("page");
    },
  );

  it("drops an unknown filter instead of failing", () => {
    expect(stateFrom("quoteFilter=everything").quoteFilter).toBe("all");
  });

  it("keeps defaults out of the URL", () => {
    expect(serializeBookQuotesTab({ quoteFilter: "all", quoteQ: "", quoteSort: "page" })).toBe("");
  });
});

describe("book quotes tab search", () => {
  it.each([
    ["a", "a"],
    ["7", "7"],
    ["   ", ""],
    ["  страх  ", "страх"],
  ])("commits %j as %j", (quoteQ, committed) => {
    expect(committedBookQuotesSearch({ ...stateFrom(""), quoteQ })).toBe(committed);
  });

  it("leaves a blank search out of the facets params", () => {
    expect(toBookQuotesFacetsParams(BOOK_ID, stateFrom("quoteQ=%20%20%20"))).not.toHaveProperty(
      "q",
    );
  });
});

describe("book quotes tab params", () => {
  it("scopes the default list to the book with quote-only search", () => {
    expect(toBookQuotesListParams(BOOK_ID, stateFrom(""))).toEqual({
      book: [BOOK_ID],
      filter: "all",
      pageSize: 20,
      searchIn: "quotes",
      sort: "page",
    });
  });

  it("carries the committed criteria into the list and facets params", () => {
    const state = stateFrom("quoteQ=%20страх%20&quoteFilter=with_comment&quoteSort=newest");

    expect(toBookQuotesListParams(BOOK_ID, state)).toEqual({
      book: [BOOK_ID],
      filter: "with_comment",
      pageSize: 20,
      q: "страх",
      searchIn: "quotes",
      sort: "newest",
    });
    expect(toBookQuotesFacetsParams(BOOK_ID, state)).toEqual({
      book: [BOOK_ID],
      q: "страх",
      searchIn: "quotes",
    });
  });

  it("takes the book from the page, never from the archive's book, bookId or q keys", () => {
    const state = stateFrom(`book=${OTHER_BOOK_ID}&bookId=${OTHER_BOOK_ID}&q=дюна`);

    expect(toBookQuotesListParams(BOOK_ID, state)).toEqual(
      toBookQuotesListParams(BOOK_ID, stateFrom("")),
    );
    expect(toBookQuotesFacetsParams(BOOK_ID, state)).toEqual({
      book: [BOOK_ID],
      searchIn: "quotes",
    });
  });

  it("separates an active filter from an active search or sort", () => {
    expect(hasActiveBookQuotesFilters(stateFrom("quoteQ=страх&quoteSort=newest"))).toBe(false);
    expect(hasActiveBookQuotesFilters(stateFrom("quoteFilter=with_spoiler"))).toBe(true);
  });
});

describe("book quotes tab reset patches", () => {
  it("splits the filter reset from the search reset", () => {
    expect(BOOK_QUOTES_TAB_RESET.filters).toEqual({ quoteFilter: null });
    expect(BOOK_QUOTES_TAB_RESET.search).toEqual({ quoteQ: null });
  });

  it("leaves the tab, note and character keys in the URL when resetting", () => {
    const url = new URLSearchParams(
      "tab=quotes&noteQ=дюна&characterSearch=пол&quoteQ=страх&quoteFilter=favorites&quoteSort=oldest",
    );

    const filtersCleared = new URLSearchParams(
      serializeBookQuotesTab(url, BOOK_QUOTES_TAB_RESET.filters),
    );
    const searchCleared = new URLSearchParams(
      serializeBookQuotesTab(url, BOOK_QUOTES_TAB_RESET.search),
    );

    expect([...filtersCleared.keys()]).toEqual([
      "tab",
      "noteQ",
      "characterSearch",
      "quoteQ",
      "quoteSort",
    ]);
    expect([...searchCleared.keys()]).toEqual([
      "tab",
      "noteQ",
      "characterSearch",
      "quoteFilter",
      "quoteSort",
    ]);
  });
});
