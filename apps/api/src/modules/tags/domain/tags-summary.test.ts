import { describe, expect, it } from "vitest";

import type { TaggedEntityCounts, TagsSummaryAggregate } from "./tag-usage.js";

import { buildTagsSummary } from "./tags-summary.js";

const ENTITY_COUNTS: TaggedEntityCounts = {
  taggedBooksCount: 3,
  taggedCharactersCount: 2,
  totalBooksCount: 10,
  totalCharactersCount: 4,
};

const EMPTY_AGGREGATE: TagsSummaryAggregate = {
  colorCounts: {},
  leaders: [],
  leadersCount: 0,
  topUsageCount: 0,
  totalTagsCount: 0,
  typeCounts: {},
  usageDistribution: { booksOnly: 0, both: 0, charactersOnly: 0, unused: 0 },
};

function sumValues(record: Record<string, number>): number {
  return Object.values(record).reduce((total, value) => total + value, 0);
}

describe("buildTagsSummary", () => {
  it("zero-fills every type and color and returns no leader for an empty catalog", () => {
    const summary = buildTagsSummary({ aggregate: EMPTY_AGGREGATE, entityCounts: ENTITY_COUNTS });

    expect(summary).toEqual({
      ...ENTITY_COUNTS,
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
      totalTagsCount: 0,
      typeCounts: { atmosphere: 0, character: 0, custom: 0, format: 0, theme: 0, trope: 0 },
      usageDistribution: { booksOnly: 0, both: 0, charactersOnly: 0, unused: 0 },
    });
  });

  it("returns no leader when every tag is unused", () => {
    const summary = buildTagsSummary({
      aggregate: {
        ...EMPTY_AGGREGATE,
        colorCounts: { parchment: 2 },
        totalTagsCount: 2,
        typeCounts: { custom: 2 },
        usageDistribution: { booksOnly: 0, both: 0, charactersOnly: 0, unused: 2 },
      },
      entityCounts: ENTITY_COUNTS,
    });

    expect(summary.mostUsed).toBeNull();
    expect(summary.usageDistribution.unused).toBe(2);
  });

  it("keeps the aggregated counts and zero-fills only the missing types and colors", () => {
    const summary = buildTagsSummary({
      aggregate: {
        ...EMPTY_AGGREGATE,
        colorCounts: { parchment: 1, sage: 1, sky: 2 },
        leaders: [{ booksCount: 1, charactersCount: 3, id: "both", name: "both" }],
        leadersCount: 1,
        topUsageCount: 4,
        totalTagsCount: 4,
        typeCounts: { format: 1, theme: 1, trope: 2 },
        usageDistribution: { booksOnly: 1, both: 1, charactersOnly: 1, unused: 1 },
      },
      entityCounts: ENTITY_COUNTS,
    });

    expect(summary.typeCounts).toEqual({
      atmosphere: 0,
      character: 0,
      custom: 0,
      format: 1,
      theme: 1,
      trope: 2,
    });
    expect(summary.colorCounts).toMatchObject({ forest: 0, parchment: 1, sage: 1, sky: 2 });
    expect(sumValues(summary.typeCounts)).toBe(summary.totalTagsCount);
    expect(sumValues(summary.colorCounts)).toBe(summary.totalTagsCount);
    expect(sumValues(summary.usageDistribution)).toBe(summary.totalTagsCount);
  });

  it("passes the tagged entity counts through untouched", () => {
    const summary = buildTagsSummary({ aggregate: EMPTY_AGGREGATE, entityCounts: ENTITY_COUNTS });

    expect(summary).toMatchObject(ENTITY_COUNTS);
  });

  it("shapes the leaders, the full tie size and the top usage into mostUsed", () => {
    const leaders = [
      { booksCount: 0, charactersCount: 3, id: "id-1", name: "Бурхливий" },
      { booksCount: 1, charactersCount: 2, id: "id-2", name: "Бурхливий" },
    ];

    const summary = buildTagsSummary({
      aggregate: {
        ...EMPTY_AGGREGATE,
        leaders,
        leadersCount: 3,
        topUsageCount: 3,
        totalTagsCount: 4,
      },
      entityCounts: ENTITY_COUNTS,
    });

    expect(summary.mostUsed).toEqual({ leaders, leadersCount: 3, usageCount: 3 });
  });
});
