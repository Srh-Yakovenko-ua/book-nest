import { describe, expect, it } from "vitest";

import type { GenresListSnapshot } from "./genres-list-state";

import { genresListState } from "./genres-list-state";
import { makeGenreStats } from "./genres.fixtures";

const FANTASY = makeGenreStats();
const ROMANCE = makeGenreStats({ key: "romance", label: "Романтика" });

const NO_CRITERIA = { filters: false, search: false };

function resolve(list: GenresListSnapshot, flags = NO_CRITERIA) {
  return genresListState({
    hasActiveFilters: flags.filters,
    hasActiveSearch: flags.search,
    list,
  });
}

function snapshot(overrides: Partial<GenresListSnapshot> = {}): GenresListSnapshot {
  return {
    data: { pages: [{ items: [FANTASY, ROMANCE] }] },
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    isPending: false,
    isPlaceholderData: false,
    ...overrides,
  };
}

describe("genresListState", () => {
  it("is loading before the first page arrives", () => {
    expect(resolve(snapshot({ data: undefined, isPending: true }))).toEqual({ kind: "loading" });
  });

  it("is an error when the first page fails", () => {
    expect(resolve(snapshot({ data: undefined }))).toEqual({ kind: "error" });
  });

  it("flattens every loaded page in server order", () => {
    const state = resolve(
      snapshot({
        data: { pages: [{ items: [FANTASY] }, { items: [ROMANCE] }] },
        hasNextPage: true,
      }),
    );

    expect(state).toEqual({
      genres: [FANTASY, ROMANCE],
      isRefreshing: false,
      kind: "ready",
      nextPage: "idle",
    });
  });

  it("keeps previous cards while new criteria load, without a usable Show more", () => {
    expect(resolve(snapshot({ hasNextPage: true, isPlaceholderData: true }))).toMatchObject({
      isRefreshing: true,
      kind: "ready",
      nextPage: "none",
    });
  });

  it("treats empty placeholder data as loading rather than a stale empty state", () => {
    expect(
      resolve(snapshot({ data: { pages: [{ items: [] }] }, isPlaceholderData: true }), {
        filters: true,
        search: false,
      }),
    ).toEqual({ kind: "loading" });
  });

  it("reports the next page as loading, then as failed, while keeping the cards", () => {
    expect(resolve(snapshot({ hasNextPage: true, isFetchingNextPage: true }))).toMatchObject({
      genres: [FANTASY, ROMANCE],
      nextPage: "loading",
    });
    expect(resolve(snapshot({ hasNextPage: true, isFetchNextPageError: true }))).toMatchObject({
      genres: [FANTASY, ROMANCE],
      nextPage: "error",
    });
  });

  it("offers no pagination footer on the last page", () => {
    expect(resolve(snapshot())).toMatchObject({ nextPage: "none" });
  });

  describe("empty reason", () => {
    const empty = snapshot({ data: { pages: [{ items: [] }] } });

    it("is the library when nothing narrows the list", () => {
      expect(resolve(empty)).toEqual({ kind: "empty", reason: "library" });
    });

    it("is the search when a committed search finds nothing, even with filters on", () => {
      expect(resolve(empty, { filters: true, search: true })).toEqual({
        kind: "empty",
        reason: "search",
      });
    });

    it("is the filters when only filters are active", () => {
      expect(resolve(empty, { filters: true, search: false })).toEqual({
        kind: "empty",
        reason: "filters",
      });
    });
  });
});
