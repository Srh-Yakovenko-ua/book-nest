import type { BookView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { computeDedicationsSummary } from "./dedications-summary.js";

function makeBook(overrides: {
  authors?: string[];
  genres?: string[];
  isFavoriteDedication?: boolean;
  readingStatus?: BookView["readingStatus"];
}): BookView {
  return {
    authors: (overrides.authors ?? []).map((name, index) => ({
      id: `author-${index}-${name}`,
      name,
    })),
    genres: overrides.genres ?? [],
    isFavoriteDedication: overrides.isFavoriteDedication ?? false,
    readingStatus: overrides.readingStatus ?? "not_started",
  } as unknown as BookView;
}

describe("computeDedicationsSummary", () => {
  it("returns all zeros and null tops for an empty set", () => {
    expect(computeDedicationsSummary({ books: [] })).toEqual({
      favoriteCount: 0,
      finishedCount: 0,
      topAuthor: null,
      topGenre: null,
      totalCount: 0,
      unfinishedCount: 0,
    });
  });

  it("counts favorites, finished and unfinished dedications", () => {
    const books = [
      makeBook({ isFavoriteDedication: true, readingStatus: "finished" }),
      makeBook({ isFavoriteDedication: true, readingStatus: "reading" }),
      makeBook({ isFavoriteDedication: false, readingStatus: "finished" }),
      makeBook({ isFavoriteDedication: false, readingStatus: "not_started" }),
    ];

    const summary = computeDedicationsSummary({ books });

    expect(summary.totalCount).toBe(4);
    expect(summary.favoriteCount).toBe(2);
    expect(summary.finishedCount).toBe(2);
    expect(summary.unfinishedCount).toBe(2);
  });

  it("picks the most frequent genre and author", () => {
    const books = [
      makeBook({ authors: ["Frank Herbert"], genres: ["memoir", "history"] }),
      makeBook({ authors: ["Frank Herbert"], genres: ["memoir"] }),
      makeBook({ authors: ["Isaac Asimov"], genres: ["biography"] }),
    ];

    const summary = computeDedicationsSummary({ books });

    expect(summary.topGenre).toEqual({ count: 2, genre: "memoir" });
    expect(summary.topAuthor).toEqual({ count: 2, name: "Frank Herbert" });
  });

  it("breaks genre ties by the alphabetically first genre", () => {
    const books = [
      makeBook({ genres: ["beta"] }),
      makeBook({ genres: ["alpha"] }),
      makeBook({ genres: ["gamma"] }),
    ];

    expect(computeDedicationsSummary({ books }).topGenre).toEqual({ count: 1, genre: "alpha" });
  });

  it("breaks author ties by the alphabetically first name", () => {
    const books = [
      makeBook({ authors: ["Isaac Asimov"] }),
      makeBook({ authors: ["Frank Herbert"] }),
      makeBook({ authors: ["Ursula Le Guin"] }),
    ];

    expect(computeDedicationsSummary({ books }).topAuthor).toEqual({
      count: 1,
      name: "Frank Herbert",
    });
  });

  it("counts every genre and author carried by a single book", () => {
    const summary = computeDedicationsSummary({
      books: [makeBook({ authors: ["A", "B"], genres: ["x", "y"] })],
    });

    expect(summary.topGenre).toEqual({ count: 1, genre: "x" });
    expect(summary.topAuthor).toEqual({ count: 1, name: "A" });
  });

  it("returns null tops when books carry no genres or authors", () => {
    const summary = computeDedicationsSummary({
      books: [makeBook({ readingStatus: "finished" }), makeBook({ isFavoriteDedication: true })],
    });

    expect(summary.topGenre).toBeNull();
    expect(summary.topAuthor).toBeNull();
    expect(summary.totalCount).toBe(2);
  });
});
