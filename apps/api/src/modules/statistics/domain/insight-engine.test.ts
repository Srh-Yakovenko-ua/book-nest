import { describe, expect, it } from "vitest";

import type { InsightEngineInput } from "./insight-engine.js";

import { buildInsightPool, buildOverviewInsights } from "./insight-engine.js";

function input(overrides: Partial<InsightEngineInput> = {}): InsightEngineInput {
  return {
    comparison: null,
    current: { completedReads: 0, pagesRead: 0 },
    discoveredAuthors: [],
    longestStreak: { days: 0, endDate: null, startDate: null },
    marathon: null,
    mostActiveWeekday: null,
    ratings: { averageRating: null, highRatedReadsCount: 0, ratedReadsCount: 0 },
    topAuthor: null,
    topGenre: null,
    topLanguage: null,
    ...overrides,
  };
}

describe("buildInsightPool", () => {
  it("returns nothing when no candidate clears its sample rule", () => {
    expect(buildInsightPool(input())).toEqual({ featuredInsight: null, items: [] });
  });

  it("features the reading comparison over everything else", () => {
    const pool = buildInsightPool(
      input({
        comparison: { completedReads: 4, pagesRead: 100 },
        current: { completedReads: 10, pagesRead: 400 },
        longestStreak: { days: 5, endDate: "2026-08-05", startDate: "2026-08-01" },
      }),
    );

    expect(pool.featuredInsight?.code).toBe("completed_reads_vs_comparison");
  });

  it("leaves out the pages comparison when the compared history is not reliable", () => {
    const pool = buildInsightPool(
      input({
        comparison: { completedReads: 4, pagesRead: null },
        current: { completedReads: 4, pagesRead: 400 },
      }),
    );

    expect(pool).toEqual({ featuredInsight: null, items: [] });
  });

  it("keeps the featured candidate out of the regular cards", () => {
    const pool = buildInsightPool(
      input({
        comparison: { completedReads: 4, pagesRead: 100 },
        current: { completedReads: 10, pagesRead: 400 },
        longestStreak: { days: 5, endDate: "2026-08-05", startDate: "2026-08-01" },
        topGenre: { completedReadCount: 6, genreKey: "fantasy", share: 0.6 },
      }),
    );

    expect(pool.items.map((insight) => insight.code)).not.toContain(pool.featuredInsight?.code);
  });

  it("shows one insight per category so two reading insights cannot both appear", () => {
    const pool = buildInsightPool(
      input({
        comparison: { completedReads: 4, pagesRead: 100 },
        current: { completedReads: 10, pagesRead: 400 },
      }),
    );

    const categories = [pool.featuredInsight, ...pool.items].map((insight) => insight?.category);
    expect(new Set(categories).size).toBe(categories.length);
  });

  it("marks a drop as negative without judging it", () => {
    const pool = buildInsightPool(
      input({
        comparison: { completedReads: 10, pagesRead: 100 },
        current: { completedReads: 4, pagesRead: 100 },
      }),
    );

    expect(pool.featuredInsight?.tone).toBe("negative");
  });

  it("leaves the percentage unknown when the comparison period was empty", () => {
    const pool = buildInsightPool(
      input({
        comparison: { completedReads: 0, pagesRead: 0 },
        current: { completedReads: 5, pagesRead: 0 },
      }),
    );

    expect(pool.featuredInsight).toMatchObject({
      code: "completed_reads_vs_comparison",
      params: { percentDelta: null },
    });
  });

  it("skips the weekday insight until three active days back it", () => {
    const pool = buildInsightPool(
      input({ mostActiveWeekday: { activeDays: 2, pagesRead: 120, weekday: 1 } }),
    );

    expect(pool.featuredInsight).toBeNull();
  });

  it("produces the same order for the same input", () => {
    const source = input({
      comparison: { completedReads: 4, pagesRead: 100 },
      current: { completedReads: 10, pagesRead: 400 },
      mostActiveWeekday: { activeDays: 5, pagesRead: 120, weekday: 1 },
      topGenre: { completedReadCount: 6, genreKey: "fantasy", share: 0.6 },
    });

    expect(buildInsightPool(source)).toEqual(buildInsightPool(source));
  });
});

describe("buildOverviewInsights", () => {
  const rich = input({
    comparison: { completedReads: 4, pagesRead: 100 },
    current: { completedReads: 10, pagesRead: 400 },
    discoveredAuthors: [
      {
        averageRating: null,
        completedReadsAfterDiscovery: 1,
        firstFinishedAt: "2026-08-01",
        key: "author-1",
        label: "Ле Ґуїн",
      },
    ],
    longestStreak: { days: 5, endDate: "2026-08-05", startDate: "2026-08-01" },
    mostActiveWeekday: { activeDays: 5, pagesRead: 120, weekday: 1 },
    ratings: { averageRating: 8.5, highRatedReadsCount: 3, ratedReadsCount: 4 },
    topGenre: { completedReadCount: 6, genreKey: "fantasy", share: 0.6 },
  });

  it("keeps the pages comparison even when the reads comparison takes the same category", () => {
    const pools = buildOverviewInsights(rich);

    expect(pools.reads[0]?.code).toBe("completed_reads_vs_comparison");
    expect(pools.pages[0]?.code).toBe("pages_read_vs_comparison");
  });

  it("keeps each pool to its own metric, ranked and capped at three", () => {
    const pools = buildOverviewInsights(rich);

    expect(pools.reads.map((insight) => insight.code)).toEqual([
      "completed_reads_vs_comparison",
      "new_authors_discovered",
      "top_genre_share",
    ]);
    expect(pools.pages.map((insight) => insight.code)).toEqual([
      "pages_read_vs_comparison",
      "longest_streak_in_period",
      "most_active_weekday",
    ]);
  });

  it("drops the pages comparison when the compared history is not reliable", () => {
    const pools = buildOverviewInsights(
      input({
        comparison: { completedReads: 4, pagesRead: null },
        current: { completedReads: 4, pagesRead: 400 },
      }),
    );

    expect(pools).toEqual({ pages: [], reads: [] });
  });

  it("keeps the sample rules, so thin evidence leaves a pool empty", () => {
    const pools = buildOverviewInsights(
      input({
        longestStreak: { days: 2, endDate: "2026-08-02", startDate: "2026-08-01" },
        mostActiveWeekday: { activeDays: 2, pagesRead: 120, weekday: 1 },
        topGenre: { completedReadCount: 2, genreKey: "fantasy", share: 1 },
      }),
    );

    expect(pools).toEqual({ pages: [], reads: [] });
  });

  it("reports a drop without colouring it as bad", () => {
    const pools = buildOverviewInsights(
      input({
        comparison: { completedReads: 10, pagesRead: 900 },
        current: { completedReads: 4, pagesRead: 300 },
      }),
    );

    expect(pools.reads[0]).toMatchObject({
      code: "completed_reads_vs_comparison",
      tone: "neutral",
    });
    expect(pools.pages[0]).toMatchObject({ code: "pages_read_vs_comparison", tone: "neutral" });
  });

  it("produces the same pools for the same input", () => {
    expect(buildOverviewInsights(rich)).toEqual(buildOverviewInsights(rich));
  });
});
