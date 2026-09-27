import type { TagCatalogListItem } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { TagsCatalogSnapshot, TagsCriteria, TagsGlobalCounts } from "./tags-list-state";

import { tagsListState } from "./tags-list-state";

const SLOW_BURN: TagCatalogListItem = {
  booksCount: 3,
  charactersCount: 1,
  color: "rose",
  description: null,
  id: "tag-slow-burn",
  name: "slow burn",
  type: "trope",
  usageCount: 4,
};

const COZY: TagCatalogListItem = {
  ...SLOW_BURN,
  booksCount: 0,
  charactersCount: 0,
  id: "tag-cozy",
  name: "cozy",
  usageCount: 0,
};

const NO_CRITERIA: TagsCriteria = {
  filter: "all",
  hasContextualCriteria: false,
  hasSearch: false,
};

const COUNTS: TagsGlobalCounts = { totalTagsCount: 5, unusedCount: 2 };

const EMPTY_PAGE = { pages: [{ items: [], totalCount: 0 }] };

function resolve({
  catalog = snapshot(),
  criteria = NO_CRITERIA,
  globalCounts = COUNTS,
}: {
  catalog?: TagsCatalogSnapshot;
  criteria?: TagsCriteria;
  globalCounts?: TagsGlobalCounts;
}) {
  return tagsListState({ catalog, criteria, globalCounts });
}

function snapshot(overrides: Partial<TagsCatalogSnapshot> = {}): TagsCatalogSnapshot {
  return {
    data: { pages: [{ items: [SLOW_BURN, COZY], totalCount: 2 }] },
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    isPending: false,
    isPlaceholderData: false,
    ...overrides,
  };
}

describe("tagsListState", () => {
  it("is loading before the first page arrives", () => {
    expect(resolve({ catalog: snapshot({ data: undefined, isPending: true }) })).toEqual({
      kind: "loading",
    });
  });

  it("is an error when the first page fails", () => {
    expect(resolve({ catalog: snapshot({ data: undefined }) })).toEqual({ kind: "error" });
  });

  it("accumulates every loaded page in server order and takes the total from the last page", () => {
    const state = resolve({
      catalog: snapshot({
        data: {
          pages: [
            { items: [SLOW_BURN], totalCount: 41 },
            { items: [COZY], totalCount: 42 },
          ],
        },
        hasNextPage: true,
      }),
    });

    expect(state).toEqual({
      isRefreshing: false,
      items: [SLOW_BURN, COZY],
      kind: "list",
      nextPage: "idle",
      total: 42,
    });
  });

  it("keeps the rows while new criteria load, without a usable load-more", () => {
    expect(
      resolve({ catalog: snapshot({ hasNextPage: true, isPlaceholderData: true }) }),
    ).toMatchObject({ isRefreshing: true, kind: "list", nextPage: "none" });
  });

  it("treats empty placeholder data as loading rather than a stale empty state", () => {
    expect(resolve({ catalog: snapshot({ data: EMPTY_PAGE, isPlaceholderData: true }) })).toEqual({
      kind: "loading",
    });
  });

  it("keeps loaded rows while the next page loads and after it fails", () => {
    expect(
      resolve({ catalog: snapshot({ hasNextPage: true, isFetchingNextPage: true }) }),
    ).toMatchObject({ items: [SLOW_BURN, COZY], nextPage: "loading" });
    expect(
      resolve({ catalog: snapshot({ hasNextPage: true, isFetchNextPageError: true }) }),
    ).toMatchObject({ items: [SLOW_BURN, COZY], nextPage: "error" });
  });

  it("hides load-more on the last page", () => {
    expect(resolve({})).toMatchObject({ nextPage: "none" });
  });

  describe("empty catalog", () => {
    const catalog = snapshot({ data: EMPTY_PAGE });

    it("is first use when nothing narrows the query", () => {
      expect(resolve({ catalog })).toEqual({ kind: "first-use" });
    });

    it("is first use when the summary reports no tags at all, whatever the criteria", () => {
      expect(
        resolve({
          catalog,
          criteria: { filter: "used", hasContextualCriteria: true, hasSearch: true },
          globalCounts: { totalTagsCount: 0, unusedCount: 0 },
        }),
      ).toEqual({ kind: "first-use" });
    });

    it("is the positive all-used state for filter=unused with no q/type/color and no unused tags", () => {
      expect(
        resolve({
          catalog,
          criteria: { ...NO_CRITERIA, filter: "unused" },
          globalCounts: { totalTagsCount: 5, unusedCount: 0 },
        }),
      ).toEqual({ kind: "all-used" });
    });

    it("is contextual for filter=unused once q/type/color narrow the query", () => {
      expect(
        resolve({
          catalog,
          criteria: { filter: "unused", hasContextualCriteria: true, hasSearch: false },
          globalCounts: { totalTagsCount: 5, unusedCount: 0 },
        }),
      ).toEqual({ hasSearch: false, kind: "contextual-empty" });
    });

    it("stays contextual for filter=unused while the summary is unknown", () => {
      expect(
        resolve({
          catalog,
          criteria: { ...NO_CRITERIA, filter: "unused" },
          globalCounts: undefined,
        }),
      ).toEqual({ hasSearch: false, kind: "contextual-empty" });
    });

    it("reports whether a committed search is part of the contextual empty state", () => {
      expect(
        resolve({
          catalog,
          criteria: { filter: "all", hasContextualCriteria: true, hasSearch: true },
        }),
      ).toEqual({ hasSearch: true, kind: "contextual-empty" });
    });
  });
});
