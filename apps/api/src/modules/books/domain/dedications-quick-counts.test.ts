import { describe, expect, it } from "vitest";

import type { DedicationsBaseFilter } from "./dedications-quick-counts.js";

import {
  buildDedicationsBaseFilter,
  buildDedicationsQuickCountFilters,
  DEDICATIONS_QUICK_COUNTS,
} from "./dedications-quick-counts.js";

const USER_ID = "user-1";

const BASE: DedicationsBaseFilter = {
  genreKey: "history",
  search: "mother",
  searchGenreKeys: ["memoir"],
  userId: USER_ID,
};

describe("buildDedicationsBaseFilter", () => {
  it("carries the genre, the resolved search and the owner", () => {
    expect(
      buildDedicationsBaseFilter({
        query: { genre: "history" },
        search: "mother",
        searchGenreKeys: ["memoir"],
        userId: USER_ID,
      }),
    ).toEqual(BASE);
  });

  it("has no quick filter axis", () => {
    const base = buildDedicationsBaseFilter({
      query: {},
      search: undefined,
      searchGenreKeys: undefined,
      userId: USER_ID,
    });

    expect(base).not.toHaveProperty("filter");
  });
});

describe("buildDedicationsQuickCountFilters", () => {
  it("sets each chip as the quick filter over the same base", () => {
    expect(buildDedicationsQuickCountFilters(BASE)).toEqual({
      all: { ...BASE, filter: "all" },
      favorites: { ...BASE, filter: "favorites" },
      finished: { ...BASE, filter: "finished" },
      unfinished: { ...BASE, filter: "unfinished" },
    });
  });

  it("builds one filter per overlay key", () => {
    expect(Object.keys(buildDedicationsQuickCountFilters(BASE)).sort()).toEqual(
      Object.keys(DEDICATIONS_QUICK_COUNTS.overlays).sort(),
    );
  });

  it("leaves the base it was given untouched", () => {
    const original: DedicationsBaseFilter = { ...BASE };

    buildDedicationsQuickCountFilters(original);

    expect(original).toEqual(BASE);
  });
});
