import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { SeriesAggregateBookRow } from "./series-aggregates.js";

import { summarizeSeriesAggregates } from "./series-aggregates.js";

type AggregateBookInput = {
  ageCategory?: string;
  formats?: string[];
  isFavorite?: boolean;
  language?: string;
  ownershipStatus?: string;
  pagesCount?: Nullable<number>;
  rating?: Nullable<number>;
  tags?: { id: string; name: string }[];
};

function bookRow(overrides: AggregateBookInput = {}): SeriesAggregateBookRow {
  const { rating, tags, ...scalars } = overrides;
  return {
    ageCategory: "not_specified",
    formats: [],
    isFavorite: false,
    language: "ukrainian",
    ownershipStatus: "none",
    pagesCount: null,
    readingProgress: rating === undefined ? null : { rating },
    tags: (tags ?? []).map((tag) => ({ tag })),
    ...scalars,
  };
}

describe("summarizeSeriesAggregates with no books", () => {
  it("answers empty for every collection, null for every average and a zeroed ownership object", () => {
    expect(summarizeSeriesAggregates([])).toEqual({
      ageCategories: [],
      averagePages: null,
      averageRating: null,
      formats: [],
      hasFavoriteBook: false,
      languages: [],
      ownership: { ownedCount: 0, total: 0 },
      pagesCount: null,
      tags: [],
    });
  });
});

describe("summarizeSeriesAggregates with a single book", () => {
  it("reports that book's own values as the aggregates", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({
        ageCategory: "16_plus",
        formats: ["paper"],
        isFavorite: true,
        language: "polish",
        ownershipStatus: "owned",
        pagesCount: 320,
        rating: 9,
        tags: [{ id: "tag-1", name: "epic" }],
      }),
    ]);

    expect(aggregates).toEqual({
      ageCategories: ["16_plus"],
      averagePages: 320,
      averageRating: 9,
      formats: ["paper"],
      hasFavoriteBook: true,
      languages: ["polish"],
      ownership: { ownedCount: 1, total: 1 },
      pagesCount: 320,
      tags: [{ id: "tag-1", name: "epic" }],
    });
  });
});

describe("summarizeSeriesAggregates with many books", () => {
  it("folds every book into one aggregate object", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({
        ageCategory: "18_plus",
        formats: ["ebook"],
        language: "english",
        ownershipStatus: "borrowed_from_someone",
        pagesCount: 100,
        rating: 7,
        tags: [{ id: "tag-zebra", name: "zebra" }],
      }),
      bookRow({
        ageCategory: "6_plus",
        formats: ["paper", "ebook"],
        isFavorite: true,
        language: "ukrainian",
        ownershipStatus: "owned",
        pagesCount: 200,
        rating: 8,
        tags: [
          { id: "tag-alpha", name: "alpha" },
          { id: "tag-zebra", name: "zebra" },
        ],
      }),
      bookRow({
        ageCategory: "12_plus",
        formats: ["audiobook"],
        language: "other",
        ownershipStatus: "want_to_buy",
        pagesCount: null,
      }),
    ]);

    expect(aggregates).toEqual({
      ageCategories: ["6_plus", "12_plus", "18_plus"],
      averagePages: 150,
      averageRating: 7.5,
      formats: ["paper", "ebook", "audiobook"],
      hasFavoriteBook: true,
      languages: ["ukrainian", "english", "other"],
      ownership: { ownedCount: 1, total: 3 },
      pagesCount: 300,
      tags: [
        { id: "tag-alpha", name: "alpha" },
        { id: "tag-zebra", name: "zebra" },
      ],
    });
  });
});

describe("summarizeSeriesAggregates averageRating", () => {
  it("returns null when no book carries a reading progress row", () => {
    const aggregates = summarizeSeriesAggregates([bookRow(), bookRow(), bookRow()]);

    expect(aggregates.averageRating).toBeNull();
  });

  it("returns null when every reading progress row leaves the rating unset", () => {
    const aggregates = summarizeSeriesAggregates([bookRow({ rating: null }), bookRow()]);

    expect(aggregates.averageRating).toBeNull();
  });

  it("averages only the books that carry a rating", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ rating: 8 }),
      bookRow({ rating: 6 }),
      bookRow({ rating: null }),
      bookRow(),
    ]);

    expect(aggregates.averageRating).toBe(7);
  });

  it("rounds the average to one decimal like the shared stats primitive", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ rating: 7 }),
      bookRow({ rating: 8 }),
      bookRow({ rating: 8 }),
    ]);

    expect(aggregates.averageRating).toBe(7.7);
  });
});

describe("summarizeSeriesAggregates page counts", () => {
  it("returns a null pagesCount when no book carries a page count", () => {
    const aggregates = summarizeSeriesAggregates([bookRow(), bookRow({ pagesCount: null })]);

    expect(aggregates.pagesCount).toBeNull();
  });

  it("returns a null averagePages when no book carries a page count", () => {
    const aggregates = summarizeSeriesAggregates([bookRow(), bookRow({ pagesCount: null })]);

    expect(aggregates.averagePages).toBeNull();
  });

  it("sums only the books that carry a page count", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ pagesCount: 100 }),
      bookRow({ pagesCount: null }),
      bookRow({ pagesCount: 200 }),
    ]);

    expect(aggregates.pagesCount).toBe(300);
  });

  it("divides by the books that carry a page count rather than by every book", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ pagesCount: 100 }),
      bookRow({ pagesCount: null }),
      bookRow({ pagesCount: 200 }),
    ]);

    expect(aggregates.averagePages).toBe(150);
  });

  it("rounds the average page count to a whole number like the shared stats primitive", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ pagesCount: 100 }),
      bookRow({ pagesCount: 200 }),
      bookRow({ pagesCount: 251 }),
    ]);

    expect(aggregates.averagePages).toBe(184);
  });
});

describe("summarizeSeriesAggregates ownership", () => {
  it("reports zero owned against the full total when no book is owned", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ ownershipStatus: "none" }),
      bookRow({ ownershipStatus: "want_to_buy" }),
      bookRow({ ownershipStatus: "in_transit" }),
    ]);

    expect(aggregates.ownership).toEqual({ ownedCount: 0, total: 3 });
  });

  it("counts only the owned books against the total when some are owned", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ ownershipStatus: "owned" }),
      bookRow({ ownershipStatus: "owned" }),
      bookRow({ ownershipStatus: "want_to_buy" }),
    ]);

    expect(aggregates.ownership).toEqual({ ownedCount: 2, total: 3 });
  });

  it("reports ownedCount equal to total when every book is owned", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ ownershipStatus: "owned" }),
      bookRow({ ownershipStatus: "owned" }),
    ]);

    expect(aggregates.ownership).toEqual({ ownedCount: 2, total: 2 });
  });

  it("does not count a borrowed book as owned, so a borrowed part keeps the series short of complete", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ ownershipStatus: "owned" }),
      bookRow({ ownershipStatus: "borrowed_from_someone" }),
    ]);

    expect(aggregates.ownership).toEqual({ ownedCount: 1, total: 2 });
  });

  it("counts a lent book as owned, so lending a part keeps the series fully collected", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ ownershipStatus: "owned" }),
      bookRow({ ownershipStatus: "lent_to_someone" }),
    ]);

    expect(aggregates.ownership).toEqual({ ownedCount: 2, total: 2 });
  });

  it("counts the owned and the lent book when all six ownership statuses are present", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ ownershipStatus: "none" }),
      bookRow({ ownershipStatus: "want_to_buy" }),
      bookRow({ ownershipStatus: "in_transit" }),
      bookRow({ ownershipStatus: "owned" }),
      bookRow({ ownershipStatus: "borrowed_from_someone" }),
      bookRow({ ownershipStatus: "lent_to_someone" }),
    ]);

    expect(aggregates.ownership).toEqual({ ownedCount: 2, total: 6 });
  });
});

describe("summarizeSeriesAggregates formats", () => {
  it("returns an empty array when no book carries a format", () => {
    const aggregates = summarizeSeriesAggregates([bookRow(), bookRow()]);

    expect(aggregates.formats).toEqual([]);
  });

  it("deduplicates a format shared by several books and by one book listing it twice", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ formats: ["paper", "paper"] }),
      bookRow({ formats: ["paper"] }),
    ]);

    expect(aggregates.formats).toEqual(["paper"]);
  });

  it("orders formats by the declared enum order, not alphabetically and not by first appearance", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ formats: ["audiobook"] }),
      bookRow({ formats: ["ebook"] }),
      bookRow({ formats: ["paper"] }),
    ]);

    expect(aggregates.formats).toEqual(["paper", "ebook", "audiobook"]);
  });

  it("keeps the declared order when only the two physical-first formats are present", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ formats: ["ebook"] }),
      bookRow({ formats: ["paper"] }),
    ]);

    expect(aggregates.formats).toEqual(["paper", "ebook"]);
  });
});

describe("summarizeSeriesAggregates languages", () => {
  it("deduplicates a language shared by several books", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ language: "english" }),
      bookRow({ language: "english" }),
    ]);

    expect(aggregates.languages).toEqual(["english"]);
  });

  it("orders languages by the declared enum order, not alphabetically and not by first appearance", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ language: "other" }),
      bookRow({ language: "english" }),
      bookRow({ language: "ukrainian" }),
    ]);

    expect(aggregates.languages).toEqual(["ukrainian", "english", "other"]);
  });
});

describe("summarizeSeriesAggregates ageCategories", () => {
  it("deduplicates an age category shared by several books", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ ageCategory: "12_plus" }),
      bookRow({ ageCategory: "12_plus" }),
    ]);

    expect(aggregates.ageCategories).toEqual(["12_plus"]);
  });

  it("orders age categories by the declared enum order, not alphabetically and not by first appearance", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ ageCategory: "18_plus" }),
      bookRow({ ageCategory: "6_plus" }),
      bookRow({ ageCategory: "12_plus" }),
    ]);

    expect(aggregates.ageCategories).toEqual(["6_plus", "12_plus", "18_plus"]);
  });
});

describe("summarizeSeriesAggregates hasFavoriteBook", () => {
  it("is false when no book is marked favorite", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ isFavorite: false }),
      bookRow({ isFavorite: false }),
    ]);

    expect(aggregates.hasFavoriteBook).toBe(false);
  });

  it("is true when one of several books is marked favorite", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ isFavorite: false }),
      bookRow({ isFavorite: true }),
      bookRow({ isFavorite: false }),
    ]);

    expect(aggregates.hasFavoriteBook).toBe(true);
  });

  it("is true when every book is marked favorite", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ isFavorite: true }),
      bookRow({ isFavorite: true }),
    ]);

    expect(aggregates.hasFavoriteBook).toBe(true);
  });
});

describe("summarizeSeriesAggregates tags", () => {
  it("returns an empty array when no book carries a tag", () => {
    const aggregates = summarizeSeriesAggregates([bookRow(), bookRow({ tags: [] })]);

    expect(aggregates.tags).toEqual([]);
  });

  it("deduplicates a tag carried by several books into one id and name pair", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({ tags: [{ id: "tag-1", name: "epic" }] }),
      bookRow({ tags: [{ id: "tag-1", name: "epic" }] }),
    ]);

    expect(aggregates.tags).toEqual([{ id: "tag-1", name: "epic" }]);
  });

  it("sorts the tags of every book by name rather than by first appearance", () => {
    const aggregates = summarizeSeriesAggregates([
      bookRow({
        tags: [
          { id: "tag-zebra", name: "zebra" },
          { id: "tag-alpha", name: "alpha" },
        ],
      }),
      bookRow({ tags: [{ id: "tag-middle", name: "middle" }] }),
    ]);

    expect(aggregates.tags).toEqual([
      { id: "tag-alpha", name: "alpha" },
      { id: "tag-middle", name: "middle" },
      { id: "tag-zebra", name: "zebra" },
    ]);
  });
});
