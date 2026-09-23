import { createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";

import type { PublisherQueryState, PublishersSort } from "./publisher-query";

import {
  countActivePublisherAdvancedFilters,
  EMPTY_PUBLISHERS_ADVANCED_FILTERS,
  hasActivePublisherFilters,
  hasActivePublisherSearch,
  publisherQueryParsers,
  PUBLISHERS_CLEAR_ALL,
  PUBLISHERS_FILTERS_RESET,
  PUBLISHERS_PAGE_SIZE,
  toBackendPublishersSort,
  toPublishersAdvancedFilters,
  toPublishersAdvancedPatch,
  toPublishersListQuery,
} from "./publisher-query";

function makeState(overrides: Partial<PublisherQueryState> = {}): PublisherQueryState {
  return {
    filter: "all",
    geography: "all",
    hasQueue: null,
    hasRatedBooks: null,
    hasWantToRead: null,
    q: "",
    sort: "books_desc",
    source: "all",
    view: "grid",
    ...overrides,
  };
}

const serialize = createSerializer(publisherQueryParsers);

describe("toBackendPublishersSort", () => {
  it.each<[PublishersSort, string, "asc" | "desc"]>([
    ["books_desc", "booksCount", "desc"],
    ["books_asc", "booksCount", "asc"],
    ["read_desc", "readCount", "desc"],
    ["read_asc", "readCount", "asc"],
    ["to_buy_desc", "wantToBuyCount", "desc"],
    ["to_buy_asc", "wantToBuyCount", "asc"],
    ["rating_desc", "averageRating", "desc"],
    ["rating_asc", "averageRating", "asc"],
    ["recent_desc", "lastBookAddedAt", "desc"],
    ["recent_asc", "lastBookAddedAt", "asc"],
    ["name_asc", "name", "asc"],
    ["name_desc", "name", "desc"],
  ])("maps %s to %s %s", (semantic, sort, order) => {
    expect(toBackendPublishersSort(semantic)).toEqual({ order, sort });
  });
});

describe("publisherQueryParsers", () => {
  it("falls back to books_desc for an unknown sort", () => {
    expect(publisherQueryParsers.sort.parseServerSide("booksCount")).toBe("books_desc");
    expect(publisherQueryParsers.sort.parseServerSide(undefined)).toBe("books_desc");
  });

  it("parses only the approved quick filters", () => {
    expect(publisherQueryParsers.filter.parseServerSide("to_buy")).toBe("to_buy");
    expect(publisherQueryParsers.filter.parseServerSide("hasSeries")).toBe("all");
  });

  it("has no page, order, search or legacy boolean keys", () => {
    expect(Object.keys(publisherQueryParsers).sort()).toEqual([
      "filter",
      "geography",
      "hasQueue",
      "hasRatedBooks",
      "hasWantToRead",
      "q",
      "sort",
      "source",
      "view",
    ]);
  });

  it("omits every default from the URL", () => {
    expect(serialize(makeState())).toBe("");
  });

  it("writes booleans only as true", () => {
    const url = serialize(
      toPublishersAdvancedPatch({ ...EMPTY_PUBLISHERS_ADVANCED_FILTERS, hasQueue: true }),
    );
    expect(url).toBe("?hasQueue=true");
  });
});

describe("toPublishersListQuery", () => {
  it("sends the default sort and page size without view, filter or empty search", () => {
    expect(toPublishersListQuery(makeState({ view: "list" }))).toEqual({
      order: "desc",
      pageSize: PUBLISHERS_PAGE_SIZE,
      sort: "booksCount",
    });
  });

  it("sends q as the backend search, trimmed", () => {
    expect(toPublishersListQuery(makeState({ q: "  видав  " }))).toMatchObject({
      search: "видав",
    });
  });

  it("forwards the quick filter, advanced filters and mapped sort", () => {
    expect(
      toPublishersListQuery(
        makeState({
          filter: "reading",
          geography: "foreign",
          hasQueue: true,
          hasRatedBooks: true,
          hasWantToRead: true,
          sort: "name_asc",
          source: "custom",
        }),
      ),
    ).toEqual({
      filter: "reading",
      geography: "foreign",
      hasQueue: "true",
      hasRatedBooks: "true",
      hasWantToRead: "true",
      order: "asc",
      pageSize: PUBLISHERS_PAGE_SIZE,
      sort: "name",
      source: "custom",
    });
  });

  it("ignores a boolean that is false in the URL", () => {
    expect(toPublishersListQuery(makeState({ hasQueue: false }))).not.toHaveProperty("hasQueue");
  });
});

describe("advanced filters", () => {
  it("counts non-default geography, source and each true boolean", () => {
    expect(countActivePublisherAdvancedFilters(EMPTY_PUBLISHERS_ADVANCED_FILTERS)).toBe(0);
    expect(
      countActivePublisherAdvancedFilters({
        geography: "ua",
        hasQueue: true,
        hasRatedBooks: false,
        hasWantToRead: true,
        source: "global",
      }),
    ).toBe(4);
  });

  it("does not count q or the quick filter", () => {
    const state = makeState({ filter: "series", q: "видав" });
    expect(countActivePublisherAdvancedFilters(toPublishersAdvancedFilters(state))).toBe(0);
  });

  it("clears defaults and false booleans from the URL on apply", () => {
    expect(toPublishersAdvancedPatch(EMPTY_PUBLISHERS_ADVANCED_FILTERS)).toEqual({
      geography: null,
      hasQueue: null,
      hasRatedBooks: null,
      hasWantToRead: null,
      source: null,
    });
  });
});

describe("hasActivePublisherFilters", () => {
  it("reports no active filters for the default state", () => {
    expect(hasActivePublisherFilters(makeState())).toBe(false);
  });

  it.each([
    ["quick filter", makeState({ filter: "read" })],
    ["geography", makeState({ geography: "unknown" })],
    ["source", makeState({ source: "custom" })],
    ["hasRatedBooks", makeState({ hasRatedBooks: true })],
    ["hasWantToRead", makeState({ hasWantToRead: true })],
    ["hasQueue", makeState({ hasQueue: true })],
  ])("reports an active %s", (_name, state) => {
    expect(hasActivePublisherFilters(state)).toBe(true);
  });

  it("does not treat q, sort or view as a filter", () => {
    expect(
      hasActivePublisherFilters(makeState({ q: "видав", sort: "name_asc", view: "list" })),
    ).toBe(false);
  });
});

describe("hasActivePublisherSearch", () => {
  it("ignores a whitespace-only q", () => {
    expect(hasActivePublisherSearch(makeState({ q: "   " }))).toBe(false);
  });

  it("detects a real q", () => {
    expect(hasActivePublisherSearch(makeState({ q: "видав" }))).toBe(true);
  });
});

describe("resets", () => {
  it("resetFilters clears the quick filter and Advanced but keeps q, sort and view", () => {
    expect(Object.keys(PUBLISHERS_FILTERS_RESET).sort()).toEqual([
      "filter",
      "geography",
      "hasQueue",
      "hasRatedBooks",
      "hasWantToRead",
      "source",
    ]);
  });

  it("clearAll also clears q but keeps sort and view", () => {
    expect(PUBLISHERS_CLEAR_ALL).toHaveProperty("q", null);
    expect(PUBLISHERS_CLEAR_ALL).not.toHaveProperty("sort");
    expect(PUBLISHERS_CLEAR_ALL).not.toHaveProperty("view");
  });
});
