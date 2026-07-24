import type { BookCharacterImportance, CharacterSummaryView } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  buildBookCharacterSummary,
  buildSeriesCharacterSummary,
  isTopImportance,
} from "./character-summary.js";

function summary(overrides: Partial<CharacterSummaryView>): CharacterSummaryView {
  return {
    avatar: null,
    characterId: "character",
    displayName: null,
    entityKind: "individual",
    hiddenFields: [],
    id: "book-character",
    importance: "supporting",
    isFavorite: false,
    name: "Name",
    portrait: null,
    status: "active",
    ...overrides,
  };
}

describe("isTopImportance", () => {
  it("accepts only central and major", () => {
    expect(isTopImportance("central")).toBe(true);
    expect(isTopImportance("major")).toBe(true);
    expect(isTopImportance("supporting")).toBe(false);
    expect(isTopImportance("episodic")).toBe(false);
    expect(isTopImportance("mentioned")).toBe(false);
  });
});

describe("buildBookCharacterSummary", () => {
  it("zero-fills every importance bucket and sums matching entries", () => {
    const view = buildBookCharacterSummary({
      bookId: "book",
      byImportanceEntries: [
        { count: 2, importance: "central" },
        { count: 1, importance: "supporting" },
      ],
      favoritesCount: 1,
      hasHiddenRecords: false,
      povCount: 3,
      topCandidates: [],
      totalVisibleCharacters: 3,
    });

    expect(view.byImportance).toEqual({
      central: 2,
      episodic: 0,
      major: 0,
      mentioned: 0,
      supporting: 1,
    });
    expect(view.bookId).toBe("book");
    expect(view.favoritesCount).toBe(1);
    expect(view.povCount).toBe(3);
    expect(view.totalVisibleCharacters).toBe(3);
  });

  it("keeps only central and major in the top list, ranked then limited", () => {
    const candidates: CharacterSummaryView[] = [
      summary({ id: "1", importance: "major", name: "Bravo" }),
      summary({ id: "2", importance: "supporting", name: "Alpha" }),
      summary({ id: "3", importance: "central", name: "Zulu" }),
      summary({ id: "4", importance: "central", name: "Mike" }),
      summary({ id: "5", importance: "major", name: "Alpha" }),
      summary({ id: "6", importance: "central", name: "Alpha" }),
      summary({ id: "7", importance: "central", name: "Bravo" }),
      summary({ id: "8", importance: "central", name: "Charlie" }),
    ];

    const view = buildBookCharacterSummary({
      bookId: "book",
      byImportanceEntries: [],
      favoritesCount: 0,
      hasHiddenRecords: false,
      povCount: 0,
      topCandidates: candidates,
      totalVisibleCharacters: candidates.length,
    });

    expect(view.top.map((entry) => entry.id)).toEqual(["6", "7", "8", "4", "3"]);
    expect(view.top.every((entry) => isTopImportance(entry.importance))).toBe(true);
  });

  it("passes hasHiddenRecords through untouched", () => {
    const view = buildBookCharacterSummary({
      bookId: "book",
      byImportanceEntries: [],
      favoritesCount: 0,
      hasHiddenRecords: true,
      povCount: 0,
      topCandidates: [],
      totalVisibleCharacters: 0,
    });

    expect(view.hasHiddenRecords).toBe(true);
  });
});

describe("buildSeriesCharacterSummary", () => {
  it("carries the series identity and resolved context", () => {
    const importances: BookCharacterImportance[] = ["central", "major", "mentioned"];
    const view = buildSeriesCharacterSummary({
      byImportanceEntries: importances.map((importance) => ({ count: 1, importance })),
      contextBookId: "context-book",
      favoritesCount: 2,
      hasHiddenRecords: true,
      povCount: 1,
      seriesId: "series",
      topCandidates: [summary({ id: "top", importance: "central", name: "Lead" })],
      totalVisibleCharacters: 3,
    });

    expect(view.seriesId).toBe("series");
    expect(view.contextBookId).toBe("context-book");
    expect(view.byImportance).toEqual({
      central: 1,
      episodic: 0,
      major: 1,
      mentioned: 1,
      supporting: 0,
    });
    expect(view.top.map((entry) => entry.id)).toEqual(["top"]);
    expect(view.hasHiddenRecords).toBe(true);
  });
});
