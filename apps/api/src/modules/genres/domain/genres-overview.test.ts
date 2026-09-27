import { subDays } from "date-fns";
import { describe, expect, it } from "vitest";

import type { GenreOverviewAggregate } from "./genres-overview.js";

import { addDaysToIsoDate, parseIsoDate } from "../../../core/iso-date.js";
import { buildGenresOverview } from "./genres-overview.js";

const NOW = new Date("2026-09-23T15:30:00.000Z");
const TODAY_ISO = "2026-09-23";
const LONG_AGO = new Date("2025-01-01T10:00:00.000Z");

function daysBeforeToday(days: number): Date {
  return parseIsoDate(addDaysToIsoDate(TODAY_ISO, -days));
}

function genre(
  overrides: Partial<GenreOverviewAggregate> & { key: string },
): GenreOverviewAggregate {
  const label = overrides.label ?? overrides.key;
  return {
    booksCount: 2,
    firstAddedAt: LONG_AGO,
    lastReadingActivityAt: null,
    latestUnratedFinishedAt: null,
    normalizedName: label.toLowerCase(),
    readCount: 0,
    startedBooksCount: 0,
    unratedFinishedCount: 0,
    ...overrides,
    label,
  };
}

function overviewOf(genres: GenreOverviewAggregate[]) {
  return buildGenresOverview({ genres, now: NOW });
}

describe("dormant genres", () => {
  const dormant = (overrides: Partial<GenreOverviewAggregate> & { key: string }) =>
    genre({
      booksCount: 2,
      lastReadingActivityAt: daysBeforeToday(200),
      readCount: 1,
      startedBooksCount: 1,
      ...overrides,
    });

  it("includes a partially read genre whose last activity is 90 days ago and excludes 89", () => {
    const result = overviewOf([
      dormant({ key: "ninety", lastReadingActivityAt: daysBeforeToday(90) }),
      dormant({ key: "eighty-nine", lastReadingActivityAt: daysBeforeToday(89) }),
    ]);

    expect(result.dormantGenres.map((entry) => entry.key)).toEqual(["ninety"]);
  });

  it("compares calendar days in UTC, so any time on day 90 qualifies and none on day 89 does", () => {
    const result = overviewOf([
      dormant({
        key: "day-90-morning",
        lastReadingActivityAt: new Date("2026-06-25T10:00:00.000Z"),
      }),
      dormant({ key: "day-90-late", lastReadingActivityAt: new Date("2026-06-25T23:59:59.999Z") }),
      dormant({ key: "day-89-start", lastReadingActivityAt: new Date("2026-06-26T00:00:00.000Z") }),
      dormant({ key: "day-89-noon", lastReadingActivityAt: new Date("2026-06-26T12:00:00.000Z") }),
    ]);

    expect(result.dormantGenres.map((entry) => entry.key)).toEqual([
      "day-90-morning",
      "day-90-late",
    ]);
  });

  it("excludes fully read, never read and recently active genres", () => {
    const result = overviewOf([
      dormant({ booksCount: 2, key: "fully-read", readCount: 2 }),
      dormant({ key: "never-read", readCount: 0 }),
      dormant({ key: "recent", lastReadingActivityAt: daysBeforeToday(1) }),
      dormant({ key: "no-activity", lastReadingActivityAt: null }),
    ]);

    expect(result.dormantGenres).toEqual([]);
  });

  it("ranks the oldest activity first, then the larger backlog, then the name", () => {
    const result = overviewOf([
      dormant({ key: "newer", lastReadingActivityAt: daysBeforeToday(100) }),
      dormant({ booksCount: 5, key: "big-backlog", lastReadingActivityAt: daysBeforeToday(300) }),
      dormant({ key: "small-backlog", lastReadingActivityAt: daysBeforeToday(300) }),
    ]);

    expect(result.dormantGenres).toEqual([
      {
        booksCount: 5,
        key: "big-backlog",
        label: "big-backlog",
        lastReadingActivityAt: daysBeforeToday(300).toISOString(),
        readCount: 1,
      },
      expect.objectContaining({ key: "small-backlog" }),
    ]);
  });
});

describe("new-for-you genres", () => {
  it("accepts a single recent never-started book and rejects an old or explored genre", () => {
    const result = overviewOf([
      genre({ booksCount: 1, firstAddedAt: subDays(NOW, 5), key: "fresh" }),
      genre({ booksCount: 1, firstAddedAt: subDays(NOW, 120), key: "old" }),
      genre({ firstAddedAt: subDays(NOW, 5), key: "started", startedBooksCount: 1 }),
      genre({
        firstAddedAt: subDays(NOW, 5),
        key: "history-only",
        lastReadingActivityAt: daysBeforeToday(400),
      }),
    ]);

    expect(result.newForYouGenres).toEqual([
      { booksCount: 1, firstAddedAt: subDays(NOW, 5).toISOString(), key: "fresh", label: "fresh" },
    ]);
  });

  it("keeps a genre first added on calendar day 90 at any time and drops day 91", () => {
    const result = overviewOf([
      genre({ firstAddedAt: new Date("2026-06-25T00:00:00.000Z"), key: "day-90-start" }),
      genre({ firstAddedAt: new Date("2026-06-25T22:00:00.000Z"), key: "day-90-late" }),
      genre({ firstAddedAt: new Date("2026-06-24T23:59:59.999Z"), key: "day-91-late" }),
    ]);

    expect(result.newForYouGenres.map((entry) => entry.key)).toEqual([
      "day-90-late",
      "day-90-start",
    ]);
  });

  it("prefers multi-book genres, then the most recent first appearance", () => {
    const result = overviewOf([
      genre({ booksCount: 1, firstAddedAt: subDays(NOW, 1), key: "singleton" }),
      genre({ booksCount: 2, firstAddedAt: subDays(NOW, 30), key: "older-pair" }),
      genre({ booksCount: 3, firstAddedAt: subDays(NOW, 10), key: "newer-trio" }),
    ]);

    expect(result.newForYouGenres.map((entry) => entry.key)).toEqual(["newer-trio", "older-pair"]);
  });

  it("falls back to singletons when fewer than two multi-book candidates exist", () => {
    const result = overviewOf([
      genre({ booksCount: 1, firstAddedAt: subDays(NOW, 1), key: "singleton" }),
      genre({ booksCount: 2, firstAddedAt: subDays(NOW, 30), key: "pair" }),
    ]);

    expect(result.newForYouGenres.map((entry) => entry.key)).toEqual(["pair", "singleton"]);
  });
});

describe("unrated finished genres", () => {
  it("ranks by count, then the latest finish with unknown dates last, then the name", () => {
    const result = overviewOf([
      genre({ key: "none", unratedFinishedCount: 0 }),
      genre({ key: "undated", latestUnratedFinishedAt: null, unratedFinishedCount: 1 }),
      genre({
        key: "dated",
        latestUnratedFinishedAt: daysBeforeToday(3),
        unratedFinishedCount: 1,
      }),
      genre({ key: "most", latestUnratedFinishedAt: null, unratedFinishedCount: 4 }),
    ]);

    expect(result.unratedFinishedGenres).toEqual([
      { key: "most", label: "most", latestUnratedFinishedAt: null, unratedFinishedCount: 4 },
      {
        key: "dated",
        label: "dated",
        latestUnratedFinishedAt: daysBeforeToday(3).toISOString(),
        unratedFinishedCount: 1,
      },
    ]);
  });
});
