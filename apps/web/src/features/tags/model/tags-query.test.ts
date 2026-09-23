import { createLoader, createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";

import type { TagsQueryState } from "./tags-query";

import {
  clearAllTagsFiltersPatch,
  committedTagSearch,
  hasActiveTagsFilters,
  TAGS_QUERY_PARSERS,
  toArrayPatch,
  toggleArrayValue,
  toTagsCatalogParams,
  toTagSearchPatch,
  toTagsFacetsParams,
} from "./tags-query";

const loadTagsQuery = createLoader(TAGS_QUERY_PARSERS);
const serializeTagsQuery = createSerializer(TAGS_QUERY_PARSERS);

function stateFrom(search: string): TagsQueryState {
  return loadTagsQuery(new URLSearchParams(search));
}

describe("tags URL state", () => {
  it("falls back to the canonical defaults for an empty URL", () => {
    expect(stateFrom("")).toEqual({
      color: [],
      filter: "all",
      q: "",
      sort: "usage_count_desc",
      type: [],
    });
  });

  it("reads every catalog-identity parameter from the URL", () => {
    expect(
      stateFrom("q=fantasy&filter=unused&type=trope,theme&color=sage&sort=name_asc"),
    ).toMatchObject({
      color: ["sage"],
      filter: "unused",
      q: "fantasy",
      sort: "name_asc",
      type: ["trope", "theme"],
    });
  });

  it("falls back to the defaults for invalid enum values", () => {
    const state = stateFrom("filter=bogus&sort=bogus");
    expect(state.filter).toBe("all");
    expect(state.sort).toBe("usage_count_desc");
  });

  it("drops invalid array members instead of carrying them into live state", () => {
    expect(stateFrom("color=bogus").color).toEqual([]);
    expect(stateFrom("type=bogus").type).toEqual([]);
  });

  it("serializes multi-value arrays deterministically without duplicates", () => {
    const type = toArrayPatch(["trope", "theme", "trope"] as const);
    expect(serializeTagsQuery({ type })).toBe("?type=trope,theme");
  });

  it("removes an emptied array from the URL", () => {
    expect(toArrayPatch([])).toBeNull();
    expect(serializeTagsQuery({ color: toArrayPatch([]), type: toArrayPatch([]) })).toBe("");
  });

  it("never serializes pagination or view state", () => {
    const url = serializeTagsQuery({ filter: "used", q: "war", sort: "name_asc" });
    expect(url).not.toMatch(/pageNumber|pageSize|view/);
  });
});

describe("toggleArrayValue", () => {
  it("adds an absent value and removes a present one", () => {
    expect(toggleArrayValue(["trope"], "theme")).toEqual(["trope", "theme"]);
    expect(toggleArrayValue(["trope", "theme"], "trope")).toEqual(["theme"]);
  });

  it("dedupes the existing selection", () => {
    expect(toggleArrayValue(["trope", "trope"], "theme")).toEqual(["trope", "theme"]);
  });
});

describe("committedTagSearch", () => {
  it("does not commit a single character", () => {
    expect(committedTagSearch("a")).toBe("");
    expect(toTagSearchPatch("a")).toEqual({ q: null });
  });

  it("clears a committed query once it is shortened below two characters", () => {
    expect(toTagSearchPatch("war")).toEqual({ q: "war" });
    expect(toTagSearchPatch("w")).toEqual({ q: null });
    expect(toTagSearchPatch("")).toEqual({ q: null });
  });

  it("trims and collapses whitespace before committing", () => {
    expect(committedTagSearch("  dark   fantasy  ")).toBe("dark fantasy");
    expect(toTagSearchPatch("   a   ")).toEqual({ q: null });
  });
});

describe("clearAllTagsFiltersPatch", () => {
  it("resets q, filter, type and color and leaves sort untouched", () => {
    expect(clearAllTagsFiltersPatch()).toEqual({
      color: null,
      filter: null,
      q: null,
      type: null,
    });
    expect(clearAllTagsFiltersPatch()).not.toHaveProperty("sort");
  });
});

describe("derived params", () => {
  const state = stateFrom(
    "q=%20%20war%20%20&filter=used&type=theme,theme&color=sage&sort=name_asc",
  );

  it("builds catalog params from the committed URL state", () => {
    expect(toTagsCatalogParams(state)).toEqual({
      color: ["sage"],
      filter: "used",
      q: "war",
      sort: "name_asc",
      type: ["theme"],
    });
  });

  it("keys facets on q, type and color only", () => {
    expect(toTagsFacetsParams(state)).toEqual({ color: ["sage"], q: "war", type: ["theme"] });
  });

  it("omits empty dimensions and uncommitted search", () => {
    expect(toTagsFacetsParams(stateFrom("q=a"))).toEqual({});
  });

  it("reports active filters only when a dimension leaves its default", () => {
    expect(hasActiveTagsFilters(stateFrom(""))).toBe(false);
    expect(hasActiveTagsFilters(stateFrom("sort=name_asc"))).toBe(false);
    expect(hasActiveTagsFilters(stateFrom("color=sage"))).toBe(true);
  });
});
