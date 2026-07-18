import { describe, expect, it } from "vitest";

import { buildNotesSummary } from "./note-summary.js";

describe("buildNotesSummary", () => {
  it("derives series and non-spoiler counts from totals", () => {
    const summary = buildNotesSummary({
      availableCustomCategories: ["finale", "romance arc"],
      bookNotesCount: 7,
      booksWithNotesCount: 3,
      favoriteCount: 4,
      pinnedCount: 2,
      seriesWithNotesCount: 1,
      total: 10,
      withSpoilerCount: 6,
    });

    expect(summary).toStrictEqual({
      availableCustomCategories: ["finale", "romance arc"],
      bookNotesCount: 7,
      booksWithNotesCount: 3,
      favoriteCount: 4,
      pinnedCount: 2,
      seriesNotesCount: 3,
      seriesWithNotesCount: 1,
      total: 10,
      withoutSpoilerCount: 4,
      withSpoilerCount: 6,
    });
  });

  it("returns all zeroes for an empty archive", () => {
    const summary = buildNotesSummary({
      availableCustomCategories: [],
      bookNotesCount: 0,
      booksWithNotesCount: 0,
      favoriteCount: 0,
      pinnedCount: 0,
      seriesWithNotesCount: 0,
      total: 0,
      withSpoilerCount: 0,
    });

    expect(summary.seriesNotesCount).toBe(0);
    expect(summary.withoutSpoilerCount).toBe(0);
    expect(summary.availableCustomCategories).toEqual([]);
  });
});
