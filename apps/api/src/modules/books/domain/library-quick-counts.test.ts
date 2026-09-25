import { describe, expect, it } from "vitest";

import type { LibraryFilter } from "../infrastructure/book-where.js";

import {
  buildLibraryQuickCountFilters,
  clearLibraryQuickFilterAxes,
} from "./library-quick-counts.js";

const USER_ID = "user-1";

const FILTER_WITH_QUICK_AXES: LibraryFilter = {
  bookType: "solo",
  genreKeys: ["fantasy"],
  isFavorite: false,
  languages: ["english"],
  ownershipStatuses: ["owned"],
  publisherIds: ["publisher-1"],
  readingStatuses: ["finished"],
  search: "dune",
  userId: USER_ID,
};

const FILTER_WITHOUT_QUICK_AXES: LibraryFilter = {
  genreKeys: ["fantasy"],
  languages: ["english"],
  publisherIds: ["publisher-1"],
  search: "dune",
  userId: USER_ID,
};

describe("clearLibraryQuickFilterAxes", () => {
  it("drops every axis a quick filter chip sets", () => {
    expect(clearLibraryQuickFilterAxes(FILTER_WITH_QUICK_AXES)).toEqual(FILTER_WITHOUT_QUICK_AXES);
  });

  it("keeps the search and the advanced filters", () => {
    const cleared = clearLibraryQuickFilterAxes(FILTER_WITH_QUICK_AXES);

    expect(cleared.search).toBe("dune");
    expect(cleared.genreKeys).toEqual(["fantasy"]);
    expect(cleared.publisherIds).toEqual(["publisher-1"]);
  });

  it("leaves the filter it was given untouched", () => {
    const original: LibraryFilter = { ...FILTER_WITH_QUICK_AXES };

    clearLibraryQuickFilterAxes(original);

    expect(original).toEqual(FILTER_WITH_QUICK_AXES);
  });
});

describe("buildLibraryQuickCountFilters", () => {
  it("counts all over the filter with the selected quick filter cleared", () => {
    const filters = buildLibraryQuickCountFilters({ filter: FILTER_WITH_QUICK_AXES, scope: "all" });

    expect(filters.all).toEqual(FILTER_WITHOUT_QUICK_AXES);
  });

  it("overlays each chip on top of the cleared filter", () => {
    const filters = buildLibraryQuickCountFilters({ filter: FILTER_WITH_QUICK_AXES, scope: "all" });

    expect(filters.reading).toEqual({
      ...FILTER_WITHOUT_QUICK_AXES,
      readingStatuses: ["reading", "rereading"],
    });
    expect(filters.want_to_read).toEqual({
      ...FILTER_WITHOUT_QUICK_AXES,
      readingStatuses: ["want_to_read"],
    });
    expect(filters.finished).toEqual({
      ...FILTER_WITHOUT_QUICK_AXES,
      readingStatuses: ["finished"],
    });
    expect(filters.favorites).toEqual({ ...FILTER_WITHOUT_QUICK_AXES, isFavorite: true });
    expect(filters.want_to_buy).toEqual({
      ...FILTER_WITHOUT_QUICK_AXES,
      ownershipStatuses: ["want_to_buy"],
    });
    expect(filters.in_transit).toEqual({
      ...FILTER_WITHOUT_QUICK_AXES,
      ownershipStatuses: ["in_transit"],
    });
    expect(filters.borrowed).toEqual({
      ...FILTER_WITHOUT_QUICK_AXES,
      ownershipStatuses: ["borrowed_from_someone", "lent_to_someone"],
    });
    expect(filters.series).toEqual({ ...FILTER_WITHOUT_QUICK_AXES, bookType: "series_part" });
    expect(filters.solo).toEqual({ ...FILTER_WITHOUT_QUICK_AXES, bookType: "solo" });
  });

  it("gives the same filters whichever quick filter is selected", () => {
    const selectedReading = buildLibraryQuickCountFilters({
      filter: { ...FILTER_WITHOUT_QUICK_AXES, readingStatuses: ["reading", "rereading"] },
      scope: "all",
    });
    const selectedNothing = buildLibraryQuickCountFilters({
      filter: FILTER_WITHOUT_QUICK_AXES,
      scope: "all",
    });

    expect(selectedReading).toEqual(selectedNothing);
  });

  it("keeps every chip inside the physical library in the my scope", () => {
    const filters = buildLibraryQuickCountFilters({ filter: FILTER_WITH_QUICK_AXES, scope: "my" });

    expect(filters.all.ownershipStatuses).toEqual([
      "owned",
      "borrowed_from_someone",
      "lent_to_someone",
    ]);
    expect(filters.finished.ownershipStatuses).toEqual([
      "owned",
      "borrowed_from_someone",
      "lent_to_someone",
    ]);
    expect(filters.borrowed.ownershipStatuses).toEqual([
      "borrowed_from_someone",
      "lent_to_someone",
    ]);
  });

  it("finds nothing for chips outside the physical library in the my scope", () => {
    const filters = buildLibraryQuickCountFilters({ filter: FILTER_WITH_QUICK_AXES, scope: "my" });

    expect(filters.want_to_buy.ownershipStatuses).toEqual([]);
    expect(filters.in_transit.ownershipStatuses).toEqual([]);
  });

  it("restricts every chip to favorite books in the favorites scope", () => {
    const filters = buildLibraryQuickCountFilters({
      filter: FILTER_WITH_QUICK_AXES,
      scope: "favorites",
    });

    for (const filter of Object.values(filters)) {
      expect(filter.isFavorite).toBe(true);
    }
    expect(filters.favorites).toEqual(filters.all);
  });
});
