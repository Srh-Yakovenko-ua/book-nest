import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GenreAggregate } from "./genre-aggregate.js";
import type { GenreLibraryCounts } from "./genre-summary.js";

import { buildGenreSummary } from "./genre-summary.js";

const EMPTY_LIBRARY: GenreLibraryCounts = {
  booksWithGenresCount: 0,
  finishedBooksCount: 0,
  finishedBooksWithGenresCount: 0,
  libraryBooksCount: 0,
  queuedBooksCount: 0,
  queuedBooksWithGenresCount: 0,
  ratedBooksCount: 0,
  ratedBooksWithGenresCount: 0,
  wantToBuyBooksCount: 0,
  wantToBuyBooksWithGenresCount: 0,
};

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

function leaderKeys(leader: Nullable<{ leaders: { key: string }[] }>): Nullable<string[]> {
  return leader === null ? null : leader.leaders.map((genre) => genre.key);
}

describe("buildGenreSummary", () => {
  it("returns zero counts and no leaders for an empty library", () => {
    const summary = buildGenreSummary({ genres: [], libraryCounts: EMPTY_LIBRARY });

    expect(summary).toEqual({
      ...EMPTY_LIBRARY,
      highestRated: null,
      mostFrequent: null,
      mostQueued: null,
      mostRead: null,
      mostWantedToBuy: null,
      usedGenresCount: 0,
    });
  });

  it("passes library counts through and counts the used genres", () => {
    const libraryCounts = { ...EMPTY_LIBRARY, booksWithGenresCount: 3, libraryBooksCount: 5 };

    const summary = buildGenreSummary({
      genres: [aggregate({ key: "a" }), aggregate({ key: "b" })],
      libraryCounts,
    });

    expect(summary).toMatchObject({ ...libraryCounts, usedGenresCount: 2 });
  });

  it("keeps at most two tied leaders in name order and reports the full tie count", () => {
    const summary = buildGenreSummary({
      genres: [
        aggregate({ booksCount: 24, key: "romance", label: "Романтика" }),
        aggregate({ booksCount: 24, key: "fantasy", label: "Фентезі" }),
        aggregate({ booksCount: 24, key: "horror", label: "Жахи" }),
        aggregate({ booksCount: 24, key: "history", label: "Історія" }),
        aggregate({ booksCount: 3, key: "poetry", label: "Поезія" }),
      ],
      libraryCounts: EMPTY_LIBRARY,
    });

    expect(leaderKeys(summary.mostFrequent)).toEqual(["horror", "history"]);
    expect(summary.mostFrequent?.leadersCount).toBe(4);
  });

  it("requires three rated books for the highest-rated leader", () => {
    const summary = buildGenreSummary({
      genres: [
        aggregate({ averageRating: 10, key: "tiny", ratedBooksCount: 2 }),
        aggregate({ averageRating: 8.5, key: "solid", ratedBooksCount: 3 }),
      ],
      libraryCounts: EMPTY_LIBRARY,
    });

    expect(leaderKeys(summary.highestRated)).toEqual(["solid"]);
  });

  it("returns no highest-rated leader when no genre reaches the sample", () => {
    const summary = buildGenreSummary({
      genres: [aggregate({ averageRating: 9, key: "tiny", ratedBooksCount: 2 })],
      libraryCounts: EMPTY_LIBRARY,
    });

    expect(summary.highestRated).toBeNull();
  });

  it("breaks an equal average by the larger rated sample instead of reporting a tie", () => {
    const summary = buildGenreSummary({
      genres: [
        aggregate({ averageRating: 9.2, key: "fantasy", label: "Фентезі", ratedBooksCount: 3 }),
        aggregate({ averageRating: 9.2, key: "romance", label: "Романтика", ratedBooksCount: 8 }),
      ],
      libraryCounts: EMPTY_LIBRARY,
    });

    expect(leaderKeys(summary.highestRated)).toEqual(["romance"]);
    expect(summary.highestRated?.leadersCount).toBe(1);
  });

  it("reports an exact rating tie only when both average and sample match", () => {
    const summary = buildGenreSummary({
      genres: [
        aggregate({ averageRating: 9.2, key: "romance", label: "Романтика", ratedBooksCount: 6 }),
        aggregate({ averageRating: 9.2, key: "fantasy", label: "Фентезі", ratedBooksCount: 6 }),
      ],
      libraryCounts: EMPTY_LIBRARY,
    });

    expect(leaderKeys(summary.highestRated)).toEqual(["romance", "fantasy"]);
    expect(summary.highestRated?.leadersCount).toBe(2);
  });

  it("never picks a zero-count leader for read, queue and want-to-buy cards", () => {
    const summary = buildGenreSummary({
      genres: [aggregate({ booksCount: 5, key: "fantasy" })],
      libraryCounts: EMPTY_LIBRARY,
    });

    expect(summary.mostRead).toBeNull();
    expect(summary.mostQueued).toBeNull();
    expect(summary.mostWantedToBuy).toBeNull();
    expect(leaderKeys(summary.mostFrequent)).toEqual(["fantasy"]);
  });

  it("ranks read, queue and want-to-buy leaders by their own metric only", () => {
    const summary = buildGenreSummary({
      genres: [
        aggregate({ booksCount: 30, key: "big", readCount: 2, readingQueueCount: 1 }),
        aggregate({ booksCount: 3, key: "small", readCount: 2, wantToBuyCount: 3 }),
        aggregate({ booksCount: 10, key: "queue", readingQueueCount: 4, wantToBuyCount: 1 }),
      ],
      libraryCounts: EMPTY_LIBRARY,
    });

    expect(leaderKeys(summary.mostRead)).toEqual(["big", "small"]);
    expect(summary.mostRead?.leadersCount).toBe(2);
    expect(leaderKeys(summary.mostQueued)).toEqual(["queue"]);
    expect(leaderKeys(summary.mostWantedToBuy)).toEqual(["small"]);
  });
});
