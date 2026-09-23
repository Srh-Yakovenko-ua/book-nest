import type { TagsSummaryView } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  formatTagShare,
  mostUsedTagFact,
  shareOf,
  tagAttentionState,
  tagColorRows,
  tagTypeRows,
  tagUsageRows,
} from "./tags-summary";

const SUMMARY: TagsSummaryView = {
  colorCounts: {
    forest: 0,
    honey: 1,
    lavender: 0,
    parchment: 2,
    rose: 1,
    sage: 0,
    sky: 0,
    terracotta: 0,
  },
  mostUsed: {
    leaders: [
      { booksCount: 3, charactersCount: 2, id: "tag-a", name: "slow burn" },
      { booksCount: 5, charactersCount: 0, id: "tag-b", name: "found family" },
    ],
    leadersCount: 3,
    usageCount: 5,
  },
  taggedBooksCount: 4,
  taggedCharactersCount: 2,
  totalBooksCount: 10,
  totalCharactersCount: 8,
  totalTagsCount: 4,
  typeCounts: { atmosphere: 1, character: 0, custom: 0, format: 0, theme: 0, trope: 3 },
  usageDistribution: { booksOnly: 2, both: 1, charactersOnly: 0, unused: 1 },
};

const EMPTY_SUMMARY: TagsSummaryView = {
  ...SUMMARY,
  colorCounts: {
    forest: 0,
    honey: 0,
    lavender: 0,
    parchment: 0,
    rose: 0,
    sage: 0,
    sky: 0,
    terracotta: 0,
  },
  mostUsed: null,
  taggedBooksCount: 0,
  taggedCharactersCount: 0,
  totalBooksCount: 0,
  totalCharactersCount: 0,
  totalTagsCount: 0,
  typeCounts: { atmosphere: 0, character: 0, custom: 0, format: 0, theme: 0, trope: 0 },
  usageDistribution: { booksOnly: 0, both: 0, charactersOnly: 0, unused: 0 },
};

describe("shareOf", () => {
  it("returns the ratio of part to whole", () => {
    expect(shareOf(4, 10)).toBe(0.4);
  });

  it.each([
    [0, 0],
    [5, 0],
    [3, -1],
    [Number.NaN, 4],
    [2, Number.POSITIVE_INFINITY],
  ])("returns a finite zero for part %s and whole %s", (part, whole) => {
    const share = shareOf(part, whole);
    expect(share).toBe(0);
    expect(Number.isFinite(share)).toBe(true);
  });

  it("never exceeds the whole", () => {
    expect(shareOf(12, 10)).toBe(1);
  });
});

describe("formatTagShare", () => {
  it("formats a zero share as a plain zero percent", () => {
    expect(formatTagShare(shareOf(3, 0), "en")).toBe("0%");
  });

  it("rounds to whole percents", () => {
    expect(formatTagShare(shareOf(1, 3), "en")).toBe("33%");
  });
});

describe("mostUsedTagFact", () => {
  it("picks the first leader and counts the other tied leaders", () => {
    expect(mostUsedTagFact(SUMMARY)).toEqual({
      hiddenLeadersCount: 2,
      kind: "leader",
      leader: { booksCount: 3, charactersCount: 2, id: "tag-a", name: "slow burn" },
    });
  });

  it("reports no hidden leaders for a single leader", () => {
    const fact = mostUsedTagFact({
      ...SUMMARY,
      mostUsed: {
        leaders: [{ booksCount: 1, charactersCount: 0, id: "tag-a", name: "cozy" }],
        leadersCount: 1,
        usageCount: 1,
      },
    });
    expect(fact).toMatchObject({ hiddenLeadersCount: 0, kind: "leader" });
  });

  it("is empty when no tag is used", () => {
    expect(mostUsedTagFact(EMPTY_SUMMARY)).toEqual({ kind: "none" });
  });
});

describe("tagAttentionState", () => {
  it("carries the global unused count", () => {
    expect(tagAttentionState(SUMMARY)).toEqual({ count: 1, kind: "unused" });
  });

  it("is all used when nothing is unused", () => {
    expect(tagAttentionState(EMPTY_SUMMARY)).toEqual({ kind: "allUsed" });
  });
});

describe("tagTypeRows", () => {
  it("lists all six types in canonical order, including zero counts", () => {
    const rows = tagTypeRows(SUMMARY, ["trope"]);
    expect(rows.map((row) => row.type)).toEqual([
      "trope",
      "atmosphere",
      "theme",
      "character",
      "format",
      "custom",
    ]);
    expect(rows[0]).toEqual({
      count: 3,
      isEmpty: false,
      isSelected: true,
      share: 0.75,
      type: "trope",
    });
    expect(rows[2]).toMatchObject({ count: 0, isEmpty: true, isSelected: false, share: 0 });
  });

  it("keeps shares finite without tags", () => {
    expect(tagTypeRows(EMPTY_SUMMARY, []).every((row) => row.share === 0)).toBe(true);
  });
});

describe("tagColorRows", () => {
  it("lists all eight colors with counts and selection", () => {
    const rows = tagColorRows(SUMMARY, ["rose"]);
    expect(rows).toHaveLength(8);
    expect(rows.find((row) => row.color === "rose")).toEqual({
      color: "rose",
      count: 1,
      isSelected: true,
    });
    expect(rows.filter((row) => row.isSelected)).toHaveLength(1);
  });
});

describe("tagUsageRows", () => {
  it("orders the exclusive distribution and shares it over all tags", () => {
    expect(tagUsageRows(SUMMARY)).toEqual([
      { count: 2, key: "booksOnly", share: 0.5 },
      { count: 0, key: "charactersOnly", share: 0 },
      { count: 1, key: "both", share: 0.25 },
      { count: 1, key: "unused", share: 0.25 },
    ]);
  });
});
