import { describe, expect, it } from "vitest";

import type { PublisherQueryState } from "./publisher-query";

import {
  hasActivePublisherFilters,
  hasActivePublisherSearch,
  PUBLISHERS_BOOLEAN_FILTERS,
  PUBLISHERS_FILTERS_RESET,
  PUBLISHERS_PAGE_SIZE,
  toLibraryPublishersParams,
} from "./publisher-query";

function makeState(overrides: Partial<PublisherQueryState> = {}): PublisherQueryState {
  return {
    geography: "all",
    hasBooksToBuy: null,
    hasRatedBooks: null,
    hasSeries: null,
    order: "desc",
    page: 1,
    search: "",
    sort: "booksCount",
    source: "all",
    view: "grid",
    ...overrides,
  };
}

describe("toLibraryPublishersParams", () => {
  it("sends the defaults without an empty search or boolean filters", () => {
    expect(toLibraryPublishersParams(makeState())).toEqual({
      geography: "all",
      order: "desc",
      pageNumber: 1,
      pageSize: PUBLISHERS_PAGE_SIZE,
      sort: "booksCount",
      source: "all",
    });
  });

  it("trims the search before sending it to the server", () => {
    expect(toLibraryPublishersParams(makeState({ search: "  видав  " }))).toMatchObject({
      search: "видав",
    });
  });

  it("omits a search that is only whitespace", () => {
    expect(toLibraryPublishersParams(makeState({ search: "   " }))).not.toHaveProperty("search");
  });

  it("serializes boolean filters as strings", () => {
    expect(
      toLibraryPublishersParams(
        makeState({ hasBooksToBuy: true, hasRatedBooks: false, hasSeries: true }),
      ),
    ).toMatchObject({
      hasBooksToBuy: "true",
      hasRatedBooks: "false",
      hasSeries: "true",
    });
  });

  it("maps the page number and forwards sort and order", () => {
    expect(
      toLibraryPublishersParams(makeState({ order: "asc", page: 4, sort: "name" })),
    ).toMatchObject({
      order: "asc",
      pageNumber: 4,
      sort: "name",
    });
  });
});

describe("hasActivePublisherFilters", () => {
  it("reports no active filters for the default state", () => {
    expect(hasActivePublisherFilters(makeState())).toBe(false);
  });

  it.each([
    ["geography", makeState({ geography: "ua" })],
    ["source", makeState({ source: "custom" })],
    ["hasBooksToBuy", makeState({ hasBooksToBuy: true })],
    ["hasRatedBooks", makeState({ hasRatedBooks: true })],
    ["hasSeries", makeState({ hasSeries: true })],
  ])("reports an active %s filter", (_name, state) => {
    expect(hasActivePublisherFilters(state)).toBe(true);
  });

  it("does not treat sort or search as a filter", () => {
    expect(hasActivePublisherFilters(makeState({ search: "видав", sort: "name" }))).toBe(false);
  });
});

describe("hasActivePublisherSearch", () => {
  it("ignores a whitespace-only search", () => {
    expect(hasActivePublisherSearch(makeState({ search: "   " }))).toBe(false);
  });

  it("detects a real search", () => {
    expect(hasActivePublisherSearch(makeState({ search: "видав" }))).toBe(true);
  });
});

describe("PUBLISHERS_BOOLEAN_FILTERS", () => {
  it("offers exactly the three documented boolean filters", () => {
    expect(PUBLISHERS_BOOLEAN_FILTERS).toEqual(["hasBooksToBuy", "hasRatedBooks", "hasSeries"]);
  });
});

describe("PUBLISHERS_FILTERS_RESET", () => {
  it("clears every filter and the page number", () => {
    expect(PUBLISHERS_FILTERS_RESET).toEqual({
      geography: null,
      hasBooksToBuy: null,
      hasRatedBooks: null,
      hasSeries: null,
      page: null,
      source: null,
    });
  });

  it("leaves the search, sort, order and view untouched", () => {
    expect(PUBLISHERS_FILTERS_RESET).not.toHaveProperty("search");
    expect(PUBLISHERS_FILTERS_RESET).not.toHaveProperty("sort");
    expect(PUBLISHERS_FILTERS_RESET).not.toHaveProperty("order");
    expect(PUBLISHERS_FILTERS_RESET).not.toHaveProperty("view");
  });
});
