import { describe, expect, it } from "vitest";

import type { DedicationsQueryState } from "./dedications-query";

import {
  DEDICATION_CHIP_FILTERS,
  hasActiveDedicationFilters,
  toDedicationsParams,
  toDedicationsQuickCountsParams,
} from "./dedications-query";

function makeState(overrides: Partial<DedicationsQueryState> = {}): DedicationsQueryState {
  return { filter: "all", genre: "", search: "", sort: "newest", view: "grid", ...overrides };
}

describe("toDedicationsParams", () => {
  it("sends the defaults without an empty search or genre", () => {
    expect(toDedicationsParams(makeState())).toEqual({
      filter: "all",
      pageSize: 12,
      sort: "newest",
    });
  });

  it("trims the search before sending it to the server", () => {
    expect(toDedicationsParams(makeState({ search: "  мрія  " }))).toMatchObject({ q: "мрія" });
  });

  it("omits a search that is only whitespace", () => {
    expect(toDedicationsParams(makeState({ search: "   " }))).not.toHaveProperty("q");
  });

  it("forwards the filter, genre and sort to the server", () => {
    expect(
      toDedicationsParams(makeState({ filter: "favorites", genre: "romance", sort: "author_asc" })),
    ).toEqual({
      filter: "favorites",
      genre: "romance",
      pageSize: 12,
      sort: "author_asc",
    });
  });
});

describe("toDedicationsQuickCountsParams", () => {
  it("keeps the trimmed search and the genre the list sends", () => {
    const listParams = toDedicationsParams(makeState({ genre: "romance", search: "  мрія " }));

    expect(toDedicationsQuickCountsParams(listParams)).toEqual({ genre: "romance", q: "мрія" });
  });

  it("drops paging, sort and the selected quick filter", () => {
    const listParams = toDedicationsParams(makeState({ filter: "favorites", sort: "author_asc" }));

    expect(toDedicationsQuickCountsParams(listParams)).toEqual({});
  });
});

describe("hasActiveDedicationFilters", () => {
  it("reports no active filters for the default state", () => {
    expect(hasActiveDedicationFilters(makeState())).toBe(false);
  });

  it.each([
    ["filter", makeState({ filter: "finished" })],
    ["genre", makeState({ genre: "romance" })],
    ["search", makeState({ search: "мрія" })],
    ["sort", makeState({ sort: "favorites_first" })],
  ])("reports an active %s", (_name, state) => {
    expect(hasActiveDedicationFilters(state)).toBe(true);
  });

  it("ignores a whitespace-only search", () => {
    expect(hasActiveDedicationFilters(makeState({ search: "   " }))).toBe(false);
  });
});

describe("DEDICATION_CHIP_FILTERS", () => {
  it("offers exactly the four filters the page documents", () => {
    expect(DEDICATION_CHIP_FILTERS).toEqual(["all", "favorites", "finished", "unfinished"]);
  });
});
