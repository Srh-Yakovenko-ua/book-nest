import { describe, expect, it } from "vitest";

import type { QuoteBookCount } from "./quotes-summary.js";

import { buildQuotesSummary } from "./quotes-summary.js";

function count(overrides: Partial<QuoteBookCount> = {}): QuoteBookCount {
  return {
    bookId: "book-1",
    count: 1,
    firstAuthorName: "Frank Herbert",
    title: "Dune",
    ...overrides,
  };
}

describe("buildQuotesSummary", () => {
  it("returns zeros and null tops when there are no quotes", () => {
    const summary = buildQuotesSummary({
      bookCounts: [],
      favorites: 0,
      spoiler: 0,
      total: 0,
      withComment: 0,
    });

    expect(summary).toEqual({
      favoritesCount: 0,
      spoilerCount: 0,
      topAuthor: null,
      topBook: null,
      totalCount: 0,
      withCommentCount: 0,
      withoutSpoilerCount: 0,
    });
  });

  it("derives withoutSpoilerCount from total minus spoiler", () => {
    const summary = buildQuotesSummary({
      bookCounts: [count({ count: 10 })],
      favorites: 4,
      spoiler: 3,
      total: 10,
      withComment: 5,
    });

    expect(summary.totalCount).toBe(10);
    expect(summary.spoilerCount).toBe(3);
    expect(summary.withoutSpoilerCount).toBe(7);
    expect(summary.favoritesCount).toBe(4);
    expect(summary.withCommentCount).toBe(5);
  });

  it("picks the most quoted book as topBook", () => {
    const summary = buildQuotesSummary({
      bookCounts: [
        count({ bookId: "a", count: 2, title: "Alpha" }),
        count({ bookId: "b", count: 5, title: "Beta" }),
        count({ bookId: "c", count: 3, title: "Gamma" }),
      ],
      favorites: 0,
      spoiler: 0,
      total: 10,
      withComment: 0,
    });

    expect(summary.topBook).toEqual({ id: "b", quotesCount: 5, title: "Beta" });
  });

  it("breaks a topBook tie by title ascending", () => {
    const summary = buildQuotesSummary({
      bookCounts: [
        count({ bookId: "z", count: 4, title: "Zephyr" }),
        count({ bookId: "a", count: 4, title: "Anchor" }),
      ],
      favorites: 0,
      spoiler: 0,
      total: 8,
      withComment: 0,
    });

    expect(summary.topBook).toEqual({ id: "a", quotesCount: 4, title: "Anchor" });
  });

  it("aggregates author counts across books and skips empty author names", () => {
    const summary = buildQuotesSummary({
      bookCounts: [
        count({ bookId: "a", count: 2, firstAuthorName: "Ursula Le Guin", title: "A" }),
        count({ bookId: "b", count: 3, firstAuthorName: "Ursula Le Guin", title: "B" }),
        count({ bookId: "c", count: 4, firstAuthorName: "Frank Herbert", title: "C" }),
        count({ bookId: "d", count: 9, firstAuthorName: "", title: "D" }),
      ],
      favorites: 0,
      spoiler: 0,
      total: 18,
      withComment: 0,
    });

    expect(summary.topAuthor).toEqual({ name: "Ursula Le Guin", quotesCount: 5 });
  });

  it("breaks a topAuthor tie by name ascending", () => {
    const summary = buildQuotesSummary({
      bookCounts: [
        count({ bookId: "a", count: 3, firstAuthorName: "Zed", title: "A" }),
        count({ bookId: "b", count: 3, firstAuthorName: "Ann", title: "B" }),
      ],
      favorites: 0,
      spoiler: 0,
      total: 6,
      withComment: 0,
    });

    expect(summary.topAuthor).toEqual({ name: "Ann", quotesCount: 3 });
  });
});
