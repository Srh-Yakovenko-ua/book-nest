import { describe, expect, it } from "vitest";

import type { GenreAggregate } from "./genre-aggregate.js";

import {
  applyGenresDatasetCriteria,
  countGenreQuickFilters,
  listGenreGroups,
  selectGenresResult,
} from "./genre-list.js";

function aggregate(overrides: Partial<GenreAggregate> & { key: string }): GenreAggregate {
  const label = overrides.label ?? overrides.key;
  return {
    averageRating: null,
    booksCount: 1,
    groupKey: "fiction",
    groupName: "Fiction",
    normalizedName: label.toLowerCase(),
    ratedBooksCount: 0,
    readCount: 0,
    readingQueueCount: 0,
    sortOrder: 0,
    wantToBuyCount: 0,
    ...overrides,
    label,
  };
}

function keys(genres: GenreAggregate[]): string[] {
  return genres.map((genre) => genre.key);
}

describe("applyGenresDatasetCriteria", () => {
  const genres = [
    aggregate({
      averageRating: 8,
      booksCount: 5,
      groupKey: "fiction",
      key: "fantasy",
      label: "Фентезі",
    }),
    aggregate({ booksCount: 2, groupKey: "fiction", key: "dark-fantasy", label: "Темне фентезі" }),
    aggregate({
      averageRating: 6,
      booksCount: 1,
      groupKey: "nonfiction",
      key: "history",
      label: "Історія",
    }),
    aggregate({
      averageRating: 9.5,
      booksCount: 3,
      groupKey: "kids",
      key: "fairy-tale",
      label: "Казка",
    }),
  ];

  it("returns every genre when no criteria are committed", () => {
    expect(keys(applyGenresDatasetCriteria({ criteria: {}, genres }))).toEqual(keys(genres));
  });

  it("matches the normalized search against the genre name only", () => {
    const result = applyGenresDatasetCriteria({ criteria: { q: "  ФЕНТЕЗІ " }, genres });

    expect(keys(result)).toEqual(["fantasy", "dark-fantasy"]);
  });

  it("treats a whitespace-only search as no search", () => {
    expect(applyGenresDatasetCriteria({ criteria: { q: "   " }, genres })).toHaveLength(4);
  });

  it("uses OR semantics across selected groups", () => {
    const result = applyGenresDatasetCriteria({
      criteria: { group: ["nonfiction", "kids"] },
      genres,
    });

    expect(keys(result)).toEqual(["history", "fairy-tale"]);
  });

  it("applies inclusive books bounds", () => {
    const result = applyGenresDatasetCriteria({ criteria: { booksMax: 3, booksMin: 2 }, genres });

    expect(keys(result)).toEqual(["dark-fantasy", "fairy-tale"]);
  });

  it("excludes unrated genres whenever a rating bound is active", () => {
    const onlyMin = applyGenresDatasetCriteria({ criteria: { ratingMin: 0.5 }, genres });
    const bounded = applyGenresDatasetCriteria({
      criteria: { ratingMax: 8, ratingMin: 6 },
      genres,
    });

    expect(keys(onlyMin)).toEqual(["fantasy", "history", "fairy-tale"]);
    expect(keys(bounded)).toEqual(["fantasy", "history"]);
  });
});

describe("countGenreQuickFilters", () => {
  it("counts overlapping sibling predicates, where unread means at least one unread book", () => {
    const counts = countGenreQuickFilters([
      aggregate({ booksCount: 3, key: "a", readCount: 3 }),
      aggregate({ booksCount: 3, key: "b", readCount: 1, readingQueueCount: 1 }),
      aggregate({ booksCount: 2, key: "c", wantToBuyCount: 2 }),
    ]);

    expect(counts).toEqual({ all: 3, finished: 2, in_queue: 1, unread: 2, want_to_buy: 1 });
  });
});

describe("selectGenresResult", () => {
  const genres = [
    aggregate({
      averageRating: 7,
      booksCount: 4,
      key: "romance",
      label: "Романтика",
      readCount: 1,
    }),
    aggregate({ booksCount: 4, key: "fantasy", label: "Фентезі", readingQueueCount: 3 }),
    aggregate({ averageRating: 9, booksCount: 1, key: "history", label: "Історія", readCount: 1 }),
    aggregate({ averageRating: 7, booksCount: 2, key: "horror", label: "Жахи" }),
  ];

  it("sorts by books count with the name then key as tie-breakers", () => {
    const result = selectGenresResult({ filter: "all", genres, sort: "books_count_desc" });

    expect(keys(result)).toEqual(["romance", "fantasy", "horror", "history"]);
  });

  it("sorts names with the Ukrainian alphabet", () => {
    const result = selectGenresResult({ filter: "all", genres, sort: "name_asc" });

    expect(keys(result)).toEqual(["horror", "history", "romance", "fantasy"]);
  });

  it("sorts by rating with unrated genres last", () => {
    const result = selectGenresResult({ filter: "all", genres, sort: "rating_desc" });

    expect(keys(result)).toEqual(["history", "horror", "romance", "fantasy"]);
  });

  it("sorts by read and queue counts", () => {
    expect(keys(selectGenresResult({ filter: "all", genres, sort: "read_count_desc" }))).toEqual([
      "history",
      "romance",
      "horror",
      "fantasy",
    ]);
    expect(keys(selectGenresResult({ filter: "all", genres, sort: "queue_count_desc" }))).toEqual([
      "fantasy",
      "horror",
      "history",
      "romance",
    ]);
  });

  it("breaks an identical name tie by key", () => {
    const twins = [
      aggregate({ key: "b-key", label: "Same" }),
      aggregate({ key: "a-key", label: "Same" }),
    ];

    expect(keys(selectGenresResult({ filter: "all", genres: twins, sort: "name_asc" }))).toEqual([
      "a-key",
      "b-key",
    ]);
  });

  it("applies the selected quick filter", () => {
    const result = selectGenresResult({ filter: "in_queue", genres, sort: "name_asc" });

    expect(keys(result)).toEqual(["fantasy"]);
  });
});

describe("listGenreGroups", () => {
  it("returns each represented group once, ordered by its first catalog position", () => {
    const groups = listGenreGroups([
      aggregate({ groupKey: "kids", groupName: "Дитячі", key: "fairy-tale", sortOrder: 80 }),
      aggregate({ groupKey: "fiction", groupName: "Художні", key: "fantasy", sortOrder: 3 }),
      aggregate({ groupKey: "kids", groupName: "Дитячі", key: "comics", sortOrder: 70 }),
    ]);

    expect(groups).toEqual([
      { key: "fiction", label: "Художні" },
      { key: "kids", label: "Дитячі" },
    ]);
  });
});
