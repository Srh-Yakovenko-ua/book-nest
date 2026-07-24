import { describe, expect, it } from "vitest";

import {
  ALL_LINES_SORT_OPTIONS,
  createFilterState,
  defaultEventSort,
  hasActiveEventFilters,
  LINE_SORT_OPTIONS,
  normalizeSortForMode,
  sortOptionsForMode,
  type TimelineEventsFilterState,
  toApiParams,
} from "./timeline-events-query";

function state(overrides: Partial<TimelineEventsFilterState> = {}): TimelineEventsFilterState {
  return { ...createFilterState(null), ...overrides };
}

describe("createFilterState", () => {
  it("defaults an all-lines state to book order with empty facets", () => {
    expect(createFilterState(null)).toEqual({
      eventType: [],
      importance: [],
      recap: false,
      search: "",
      sort: "book_order",
      timelineId: null,
      unresolved: false,
    });
  });

  it("defaults a single-line state to the internal timeline order", () => {
    expect(createFilterState("line-1").sort).toBe("timeline_order");
    expect(createFilterState("line-1").timelineId).toBe("line-1");
  });
});

describe("defaultEventSort", () => {
  it("uses book order for all lines", () => {
    expect(defaultEventSort(null)).toBe("book_order");
  });

  it("uses timeline order for a specific line", () => {
    expect(defaultEventSort("line-1")).toBe("timeline_order");
  });
});

describe("sortOptionsForMode", () => {
  it("omits the internal timeline order in all-lines mode", () => {
    expect(sortOptionsForMode(true)).toEqual(ALL_LINES_SORT_OPTIONS);
    expect(sortOptionsForMode(true)).not.toContain("timeline_order");
  });

  it("offers the internal timeline order for a single line", () => {
    expect(sortOptionsForMode(false)).toEqual(LINE_SORT_OPTIONS);
    expect(sortOptionsForMode(false)).toContain("timeline_order");
  });
});

describe("normalizeSortForMode", () => {
  it("keeps a sort that is valid for the target mode", () => {
    expect(normalizeSortForMode("importance", true)).toBe("importance");
    expect(normalizeSortForMode("timeline_order", false)).toBe("timeline_order");
  });

  it("falls back to book order when timeline order is not valid for all lines", () => {
    expect(normalizeSortForMode("timeline_order", true)).toBe("book_order");
  });
});

describe("hasActiveEventFilters", () => {
  it("is false for a freshly created state", () => {
    expect(hasActiveEventFilters(state())).toBe(false);
  });

  it("treats whitespace-only search as inactive", () => {
    expect(hasActiveEventFilters(state({ search: "   " }))).toBe(false);
  });

  it("is active when a search term is present", () => {
    expect(hasActiveEventFilters(state({ search: "meeting" }))).toBe(true);
  });

  it("is active when a type facet is selected", () => {
    expect(hasActiveEventFilters(state({ eventType: ["main"] }))).toBe(true);
  });

  it("is active when an importance facet is selected", () => {
    expect(hasActiveEventFilters(state({ importance: ["key"] }))).toBe(true);
  });

  it("is active when the unresolved toggle is on", () => {
    expect(hasActiveEventFilters(state({ unresolved: true }))).toBe(true);
  });

  it("is active when the recap toggle is on", () => {
    expect(hasActiveEventFilters(state({ recap: true }))).toBe(true);
  });
});

describe("toApiParams", () => {
  it("omits the timeline id and empty facets for all-lines default state", () => {
    expect(toApiParams(state(), 1)).toEqual({ pageNumber: 1, sort: "book_order" });
  });

  it("does not attach a timelineId key in all-lines mode", () => {
    expect(toApiParams(state(), 1)).not.toHaveProperty("timelineId");
  });

  it("passes the page number through", () => {
    expect(toApiParams(state(), 4).pageNumber).toBe(4);
  });

  it("includes the timeline id for a specific line", () => {
    expect(toApiParams(state({ timelineId: "line-9" }), 1).timelineId).toBe("line-9");
  });

  it("trims the search term before sending it", () => {
    expect(toApiParams(state({ search: "  hello  " }), 1).search).toBe("hello");
  });

  it("omits a whitespace-only search term", () => {
    expect(toApiParams(state({ search: "   " }), 1)).not.toHaveProperty("search");
  });

  it("forwards a non-empty event type facet", () => {
    expect(toApiParams(state({ eventType: ["main", "death"] }), 1).eventType).toEqual([
      "main",
      "death",
    ]);
  });

  it("omits an empty event type facet", () => {
    expect(toApiParams(state({ eventType: [] }), 1)).not.toHaveProperty("eventType");
  });

  it("forwards a non-empty importance facet", () => {
    expect(toApiParams(state({ importance: ["key"] }), 1).importance).toEqual(["key"]);
  });

  it("encodes the unresolved toggle as a string flag", () => {
    expect(toApiParams(state({ unresolved: true }), 1).unresolved).toBe("true");
  });

  it("encodes the recap toggle as a string flag", () => {
    expect(toApiParams(state({ recap: true }), 1).recap).toBe("true");
  });
});
