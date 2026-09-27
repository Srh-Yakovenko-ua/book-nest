import { describe, expect, it } from "vitest";

import { resolvePublishersArchiveState } from "./publisher-archive-state";
import { makePublisherListItem } from "./publisher.fixtures";

const BASE = {
  hasActiveFilters: false,
  hasActiveSearch: false,
  list: { items: [], totalCount: 0 },
  listFailed: false,
  summaryPending: false,
  summaryPublishersCount: 4,
};

describe("resolvePublishersArchiveState", () => {
  it("reports an initial error before anything else", () => {
    expect(resolvePublishersArchiveState({ ...BASE, list: null, listFailed: true })).toEqual({
      kind: "error",
    });
  });

  it("reports loading while the first page is pending", () => {
    expect(resolvePublishersArchiveState({ ...BASE, list: null })).toEqual({ kind: "loading" });
  });

  it("reports a true empty library when the summary confirms zero publishers", () => {
    expect(
      resolvePublishersArchiveState({
        ...BASE,
        hasActiveFilters: true,
        hasActiveSearch: true,
        summaryPublishersCount: 0,
      }),
    ).toEqual({ kind: "empty" });
  });

  it("reports a search-only zero when only q is active", () => {
    expect(resolvePublishersArchiveState({ ...BASE, hasActiveSearch: true })).toEqual({
      kind: "noSearchResults",
    });
  });

  it("reports a filtered zero when filters are active, with or without q", () => {
    expect(resolvePublishersArchiveState({ ...BASE, hasActiveFilters: true })).toEqual({
      kind: "noFilteredResults",
    });
    expect(
      resolvePublishersArchiveState({ ...BASE, hasActiveFilters: true, hasActiveSearch: true }),
    ).toEqual({ kind: "noFilteredResults" });
  });

  it("waits for the summary before calling an empty narrowed list a search or filter zero", () => {
    const pending = { ...BASE, summaryPending: true, summaryPublishersCount: null };
    expect(resolvePublishersArchiveState({ ...pending, hasActiveSearch: true })).toEqual({
      kind: "loading",
    });
    expect(resolvePublishersArchiveState({ ...pending, hasActiveFilters: true })).toEqual({
      kind: "loading",
    });
  });

  it("falls back to the search and filter zeros when the summary failed", () => {
    const failed = { ...BASE, summaryPublishersCount: null };
    expect(resolvePublishersArchiveState({ ...failed, hasActiveSearch: true })).toEqual({
      kind: "noSearchResults",
    });
    expect(resolvePublishersArchiveState({ ...failed, hasActiveFilters: true })).toEqual({
      kind: "noFilteredResults",
    });
  });

  it("keeps showing loaded results even when a later request failed", () => {
    const items = [makePublisherListItem()];
    expect(
      resolvePublishersArchiveState({ ...BASE, list: { items, totalCount: 30 }, listFailed: true }),
    ).toEqual({ items, kind: "results", totalCount: 30 });
  });
});
