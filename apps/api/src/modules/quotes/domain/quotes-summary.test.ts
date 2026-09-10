import { describe, expect, it } from "vitest";

import type {
  QuoteAuthorLink,
  QuoteBookCount,
  QuotesSummaryData,
} from "../infrastructure/quotes.repository.js";

import { buildQuotesSummary } from "./quotes-summary.js";

function authorLink(bookId: string, id: string, name: string): QuoteAuthorLink {
  return { author: { id, name }, bookId };
}

function count(overrides: Partial<QuoteBookCount> = {}): QuoteBookCount {
  return {
    bookId: "book-1",
    count: 1,
    title: "Dune",
    ...overrides,
  };
}

function summaryData(overrides: Partial<QuotesSummaryData> = {}): QuotesSummaryData {
  return {
    authorLinks: [],
    bookCounts: [],
    favorites: 0,
    spoiler: 0,
    total: 0,
    withComment: 0,
    ...overrides,
  };
}

describe("buildQuotesSummary", () => {
  it("returns zeros and null tops when there are no quotes", () => {
    const summary = buildQuotesSummary(summaryData());

    expect(summary).toEqual({
      averageQuotesPerQuotedBook: null,
      favoritesCount: 0,
      quotedBooksCount: 0,
      spoilerCount: 0,
      topAuthor: null,
      topBook: null,
      totalCount: 0,
      withCommentCount: 0,
      withoutSpoilerCount: 0,
    });
  });

  it("derives withoutSpoilerCount from total minus spoiler", () => {
    const summary = buildQuotesSummary(
      summaryData({
        bookCounts: [count({ count: 10 })],
        favorites: 4,
        spoiler: 3,
        total: 10,
        withComment: 5,
      }),
    );

    expect(summary.totalCount).toBe(10);
    expect(summary.spoilerCount).toBe(3);
    expect(summary.withoutSpoilerCount).toBe(7);
    expect(summary.favoritesCount).toBe(4);
    expect(summary.withCommentCount).toBe(5);
  });
});

describe("buildQuotesSummary quotedBooksCount", () => {
  it("counts no quoted book when there are no quotes", () => {
    expect(buildQuotesSummary(summaryData()).quotedBooksCount).toBe(0);
  });

  it("counts one quoted book for a single quote", () => {
    const summary = buildQuotesSummary(
      summaryData({ bookCounts: [count({ bookId: "a", count: 1 })], total: 1 }),
    );

    expect(summary.quotedBooksCount).toBe(1);
  });

  it("counts a book once no matter how many quotes it carries", () => {
    const summary = buildQuotesSummary(
      summaryData({ bookCounts: [count({ bookId: "a", count: 12 })], total: 12 }),
    );

    expect(summary.quotedBooksCount).toBe(1);
  });

  it("counts every distinct book holding a quote", () => {
    const summary = buildQuotesSummary(
      summaryData({
        bookCounts: [
          count({ bookId: "a", count: 3, title: "Alpha" }),
          count({ bookId: "b", count: 1, title: "Beta" }),
          count({ bookId: "c", count: 2, title: "Gamma" }),
        ],
        total: 6,
      }),
    );

    expect(summary.quotedBooksCount).toBe(3);
  });
});

describe("buildQuotesSummary averageQuotesPerQuotedBook", () => {
  it("returns null instead of dividing by zero when no book is quoted", () => {
    expect(buildQuotesSummary(summaryData({ total: 0 })).averageQuotesPerQuotedBook).toBeNull();
  });

  it("returns the whole total for a single quoted book", () => {
    const summary = buildQuotesSummary(
      summaryData({ bookCounts: [count({ bookId: "a", count: 4 })], total: 4 }),
    );

    expect(summary.averageQuotesPerQuotedBook).toBe(4);
  });

  it("averages the total over the quoted books", () => {
    const summary = buildQuotesSummary(
      summaryData({
        bookCounts: [
          count({ bookId: "a", count: 4, title: "Alpha" }),
          count({ bookId: "b", count: 2, title: "Beta" }),
        ],
        total: 6,
      }),
    );

    expect(summary.averageQuotesPerQuotedBook).toBe(3);
  });

  it("keeps a fractional average unrounded", () => {
    const summary = buildQuotesSummary(
      summaryData({
        bookCounts: [
          count({ bookId: "a", count: 3, title: "Alpha" }),
          count({ bookId: "b", count: 2, title: "Beta" }),
          count({ bookId: "c", count: 2, title: "Gamma" }),
        ],
        total: 7,
      }),
    );

    expect(summary.averageQuotesPerQuotedBook).toBeCloseTo(7 / 3, 10);
  });
});

describe("buildQuotesSummary topBook", () => {
  it("returns null when there are no quotes", () => {
    expect(buildQuotesSummary(summaryData()).topBook).toBeNull();
  });

  it("returns the only quoted book with no ties", () => {
    const summary = buildQuotesSummary(
      summaryData({ bookCounts: [count({ bookId: "a", count: 2, title: "Alpha" })], total: 2 }),
    );

    expect(summary.topBook).toEqual({ id: "a", quotesCount: 2, tiedCount: 0, title: "Alpha" });
  });

  it("picks the most quoted book", () => {
    const summary = buildQuotesSummary(
      summaryData({
        bookCounts: [
          count({ bookId: "a", count: 2, title: "Alpha" }),
          count({ bookId: "b", count: 5, title: "Beta" }),
          count({ bookId: "c", count: 3, title: "Gamma" }),
        ],
        total: 10,
      }),
    );

    expect(summary.topBook).toEqual({ id: "b", quotesCount: 5, tiedCount: 0, title: "Beta" });
  });

  it("breaks a tie by title ascending and reports the other tied books", () => {
    const summary = buildQuotesSummary(
      summaryData({
        bookCounts: [
          count({ bookId: "z", count: 4, title: "Zephyr" }),
          count({ bookId: "a", count: 4, title: "Anchor" }),
          count({ bookId: "m", count: 4, title: "Meridian" }),
          count({ bookId: "s", count: 1, title: "Solo" }),
        ],
        total: 13,
      }),
    );

    expect(summary.topBook).toEqual({ id: "a", quotesCount: 4, tiedCount: 2, title: "Anchor" });
  });

  it("settles a tie on identical titles by the lower id, whatever the input order", () => {
    const twins = [
      count({ bookId: "book-b", count: 3, title: "Dune" }),
      count({ bookId: "book-a", count: 3, title: "Dune" }),
    ];
    const expected = { id: "book-a", quotesCount: 3, tiedCount: 1, title: "Dune" };

    expect(buildQuotesSummary(summaryData({ bookCounts: twins, total: 6 })).topBook).toEqual(
      expected,
    );
    expect(
      buildQuotesSummary(summaryData({ bookCounts: [...twins].reverse(), total: 6 })).topBook,
    ).toEqual(expected);
  });

  it("orders a Ukrainian tie by the Ukrainian collation", () => {
    const summary = buildQuotesSummary(
      summaryData({
        bookCounts: [
          count({ bookId: "b", count: 2, title: "Ялинка" }),
          count({ bookId: "a", count: 2, title: "Їжак" }),
        ],
        total: 4,
      }),
    );

    expect(summary.topBook).toEqual({ id: "a", quotesCount: 2, tiedCount: 1, title: "Їжак" });
  });
});

describe("buildQuotesSummary topAuthor", () => {
  it("returns null when there are no quotes", () => {
    expect(buildQuotesSummary(summaryData()).topAuthor).toBeNull();
  });

  it("returns null when no quoted book has an author relation", () => {
    const summary = buildQuotesSummary(
      summaryData({ bookCounts: [count({ bookId: "a", count: 3 })], total: 3 }),
    );

    expect(summary.topAuthor).toBeNull();
  });

  it("returns the only author with no ties", () => {
    const summary = buildQuotesSummary(
      summaryData({
        authorLinks: [authorLink("a", "author-1", "Frank Herbert")],
        bookCounts: [count({ bookId: "a", count: 3 })],
        total: 3,
      }),
    );

    expect(summary.topAuthor).toEqual({
      id: "author-1",
      name: "Frank Herbert",
      quotesCount: 3,
      tiedCount: 0,
    });
  });

  it("aggregates an author's quotes across their books", () => {
    const summary = buildQuotesSummary(
      summaryData({
        authorLinks: [
          authorLink("a", "le-guin", "Ursula Le Guin"),
          authorLink("b", "le-guin", "Ursula Le Guin"),
          authorLink("c", "herbert", "Frank Herbert"),
        ],
        bookCounts: [
          count({ bookId: "a", count: 2, title: "A" }),
          count({ bookId: "b", count: 3, title: "B" }),
          count({ bookId: "c", count: 4, title: "C" }),
        ],
        total: 9,
      }),
    );

    expect(summary.topAuthor).toEqual({
      id: "le-guin",
      name: "Ursula Le Guin",
      quotesCount: 5,
      tiedCount: 0,
    });
  });

  it("counts a quote of a multi-author book for every linked author", () => {
    const summary = buildQuotesSummary(
      summaryData({
        authorLinks: [
          authorLink("a", "gaiman", "Neil Gaiman"),
          authorLink("a", "pratchett", "Terry Pratchett"),
          authorLink("b", "pratchett", "Terry Pratchett"),
        ],
        bookCounts: [
          count({ bookId: "a", count: 4, title: "Good Omens" }),
          count({ bookId: "b", count: 1, title: "Mort" }),
        ],
        total: 5,
      }),
    );

    expect(summary.topAuthor).toEqual({
      id: "pratchett",
      name: "Terry Pratchett",
      quotesCount: 5,
      tiedCount: 0,
    });
  });

  it("breaks a tie by name ascending and reports the other tied authors", () => {
    const summary = buildQuotesSummary(
      summaryData({
        authorLinks: [
          authorLink("a", "zed", "Zed"),
          authorLink("b", "ann", "Ann"),
          authorLink("c", "mia", "Mia"),
        ],
        bookCounts: [
          count({ bookId: "a", count: 3, title: "A" }),
          count({ bookId: "b", count: 3, title: "B" }),
          count({ bookId: "c", count: 3, title: "C" }),
        ],
        total: 9,
      }),
    );

    expect(summary.topAuthor).toEqual({ id: "ann", name: "Ann", quotesCount: 3, tiedCount: 2 });
  });

  it("settles a tie on identical names by the lower id, whatever the input order", () => {
    const links = [
      authorLink("a", "author-b", "Ivan Franko"),
      authorLink("b", "author-a", "Ivan Franko"),
    ];
    const bookCounts = [
      count({ bookId: "a", count: 2, title: "A" }),
      count({ bookId: "b", count: 2, title: "B" }),
    ];
    const expected = { id: "author-a", name: "Ivan Franko", quotesCount: 2, tiedCount: 1 };

    expect(
      buildQuotesSummary(summaryData({ authorLinks: links, bookCounts, total: 4 })).topAuthor,
    ).toEqual(expected);
    expect(
      buildQuotesSummary(summaryData({ authorLinks: [...links].reverse(), bookCounts, total: 4 }))
        .topAuthor,
    ).toEqual(expected);
  });

  it("ignores author links pointing at a book that holds no active quote", () => {
    const summary = buildQuotesSummary(
      summaryData({
        authorLinks: [
          authorLink("a", "herbert", "Frank Herbert"),
          authorLink("gone", "simmons", "Dan Simmons"),
        ],
        bookCounts: [count({ bookId: "a", count: 2 })],
        total: 2,
      }),
    );

    expect(summary.topAuthor).toEqual({
      id: "herbert",
      name: "Frank Herbert",
      quotesCount: 2,
      tiedCount: 0,
    });
  });
});
