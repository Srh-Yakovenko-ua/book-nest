import type { NoteCategory } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  rankEntityCounts,
  toAuthorFacets,
  toCategoryFacets,
  toNoteQuickCounts,
  toValueFacets,
  withoutCategoryDimension,
} from "./note-facets.js";

describe("toNoteQuickCounts", () => {
  it("returns zero for every quick filter when there are no notes", () => {
    expect(toNoteQuickCounts([])).toEqual({
      all: 0,
      favorite: 0,
      no_spoiler: 0,
      pinned: 0,
      with_spoiler: 0,
    });
  });

  it("folds flag groups into every quick filter a note matches", () => {
    expect(
      toNoteQuickCounts([
        { count: 3, isFavorite: false, isPinned: false, isSpoiler: false },
        { count: 2, isFavorite: true, isPinned: true, isSpoiler: false },
        { count: 4, isFavorite: true, isPinned: false, isSpoiler: true },
        { count: 1, isFavorite: false, isPinned: true, isSpoiler: true },
      ]),
    ).toEqual({ all: 10, favorite: 6, no_spoiler: 5, pinned: 3, with_spoiler: 5 });
  });

  it("keeps no_spoiler and with_spoiler summing to all", () => {
    const counts = toNoteQuickCounts([
      { count: 7, isFavorite: false, isPinned: false, isSpoiler: true },
      { count: 5, isFavorite: true, isPinned: true, isSpoiler: false },
    ]);
    expect(counts.no_spoiler + counts.with_spoiler).toBe(counts.all);
  });
});

describe("toCategoryFacets", () => {
  it("splits grouped rows into standard and custom category counts", () => {
    const facets = toCategoryFacets([
      { category: "plot", count: 2, customCategory: null },
      { category: "other", count: 1, customCategory: "Spice" },
      { category: "other", count: 3, customCategory: "Worms" },
      { category: null, count: 1, customCategory: "Spice" },
      { category: "not_a_category", count: 5, customCategory: null },
    ]);

    expect(facets.categories).toEqual([
      { category: "other", count: 4 },
      { category: "plot", count: 2 },
    ]);
    expect(facets.customCategories).toEqual([
      { count: 3, value: "Worms" },
      { count: 2, value: "Spice" },
    ]);
  });
});

describe("toAuthorFacets", () => {
  it("sums entity counts per author id and ranks by count then name", () => {
    const facets = toAuthorFacets({
      entityCounts: [
        { count: 2, entityId: "dune", label: "Dune" },
        { count: 1, entityId: "hyperion", label: "Hyperion" },
      ],
      links: [
        { author: { id: "simmons", name: "Dan Simmons" }, entityId: "hyperion" },
        { author: { id: "herbert", name: "Frank Herbert" }, entityId: "dune" },
        { author: { id: "anderson", name: "Brian Anderson" }, entityId: "dune" },
        { author: { id: "ghost", name: "Ghost" }, entityId: "unknown" },
      ],
    });

    expect(facets).toEqual([
      { count: 2, id: "anderson", name: "Brian Anderson" },
      { count: 2, id: "herbert", name: "Frank Herbert" },
      { count: 1, id: "simmons", name: "Dan Simmons" },
    ]);
  });
});

describe("rankEntityCounts and toValueFacets", () => {
  it("rank by count, then label, and drop empty entries", () => {
    expect(
      rankEntityCounts([
        { count: 1, entityId: "b", label: "Beta" },
        { count: 0, entityId: "z", label: "Zero" },
        { count: 1, entityId: "a", label: "Alpha" },
        { count: 3, entityId: "c", label: "Gamma" },
      ]).map((entry) => entry.entityId),
    ).toEqual(["c", "a", "b"]);

    expect(
      toValueFacets([
        { count: 1, value: "fantasy" },
        { count: 2, value: "sci_fi" },
      ]),
    ).toEqual([
      { count: 2, value: "sci_fi" },
      { count: 1, value: "fantasy" },
    ]);
  });
});

const PLOT_CATEGORY: NoteCategory = "plot";

describe("withoutCategoryDimension", () => {
  it("drops standard and custom categories together and keeps other dimensions", () => {
    expect(
      withoutCategoryDimension({
        authorIds: ["author"],
        categories: [PLOT_CATEGORY],
        customCategories: ["Spice"],
      }),
    ).toEqual({ authorIds: ["author"], categories: undefined, customCategories: undefined });
  });
});
