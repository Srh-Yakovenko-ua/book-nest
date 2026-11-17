import type { CompletedReadsFilter, Nullable, ReadingStatisticsSubsetFilter } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  buildStatisticsDrilldownTarget,
  toContextActionLink,
  toContextActionLinks,
} from "./statistics-drilldown";
import { statisticsIds } from "./statistics.fixtures";

type SingleAttributeCase = {
  attribute: string;
  filter: ReadingStatisticsSubsetFilter;
  filters: CompletedReadsFilter;
  period: { from: Nullable<string>; to: string };
};

describe("buildStatisticsDrilldownTarget", () => {
  it("resolves a reading day to its own date", () => {
    const target = buildStatisticsDrilldownTarget({ date: "2026-03-02", kind: "reading_day" });

    expect(target).toEqual({ date: "2026-03-02", kind: "reading_day" });
  });

  it("resolves a reading cycle to that exact cycle", () => {
    const target = buildStatisticsDrilldownTarget({
      bookId: statisticsIds.bookId,
      kind: "reading_cycle",
      readingCycleId: statisticsIds.cycleId,
    });

    expect(target).toEqual({ kind: "reading_cycle", readingCycleId: statisticsIds.cycleId });
  });

  it("resolves a single-author subset to that exact attribute over the row's period", () => {
    const target = buildStatisticsDrilldownTarget({
      filters: { authorId: statisticsIds.authorId },
      kind: "completed_reads_subset",
      period: { from: "2026-01-01", to: "2026-03-31" },
    });

    expect(target).toEqual({
      filter: { field: "authorId", value: statisticsIds.authorId },
      kind: "completed_reads_subset",
      period: { from: "2026-01-01", to: "2026-03-31" },
    });
  });

  it.each<SingleAttributeCase>([
    {
      attribute: "genre",
      filter: { field: "genre", value: "fantasy" },
      filters: { genre: "fantasy" },
      period: { from: "2025-10-01", to: "2025-12-31" },
    },
    {
      attribute: "publisher",
      filter: { field: "publisherId", value: statisticsIds.publisherId },
      filters: { publisherId: statisticsIds.publisherId },
      period: { from: null, to: "2026-03-31" },
    },
    {
      attribute: "language",
      filter: { field: "language", value: "english" },
      filters: { language: "english" },
      period: { from: "2026-04-01", to: "2026-06-30" },
    },
  ])("resolves a single-$attribute subset and keeps its period", ({ filter, filters, period }) => {
    const target = buildStatisticsDrilldownTarget({
      filters,
      kind: "completed_reads_subset",
      period,
    });

    expect(target).toEqual({ filter, kind: "completed_reads_subset", period });
  });

  it.each<[string, CompletedReadsFilter]>([
    ["two attributes", { authorId: statisticsIds.authorId, genre: "fantasy" }],
    ["an attribute and a rating floor", { genre: "fantasy", ratingMin: 8 }],
    [
      "an attribute and a series",
      { publisherId: statisticsIds.publisherId, seriesId: statisticsIds.seriesId },
    ],
    ["an attribute and one finish bound", { finishedFrom: "2026-03-01", language: "english" }],
    ["a series alone", { seriesId: statisticsIds.seriesId }],
  ])("fails closed instead of narrowing to one attribute for %s", (_, filters) => {
    const target = buildStatisticsDrilldownTarget({
      filters,
      kind: "completed_reads_subset",
      period: { from: "2026-01-01", to: "2026-03-31" },
    });

    expect(target).toEqual({
      kind: "unsupported",
      reason: "COMPLETED_READS_SUBSET_HAS_NO_EXACT_DESTINATION",
    });
  });

  it("resolves a date-only subset to its exact finished-date interval", () => {
    const target = buildStatisticsDrilldownTarget({
      filters: { finishedFrom: "2026-03-01", finishedTo: "2026-03-31" },
      kind: "completed_reads_subset",
      period: { from: "2026-01-01", to: "2026-03-31" },
    });

    expect(target).toEqual({
      from: "2026-03-01",
      kind: "completed_reads_interval",
      to: "2026-03-31",
    });
  });

  it.each([
    ["one bound only", { finishedFrom: "2026-03-01" }],
    [
      "a narrowing filter",
      { finishedFrom: "2026-03-01", finishedTo: "2026-03-31", genre: "fantasy" },
    ],
  ])("keeps failing closed for a subset with %s", (_, filters) => {
    const target = buildStatisticsDrilldownTarget({
      filters,
      kind: "completed_reads_subset",
      period: { from: "2026-01-01", to: "2026-03-31" },
    });

    expect(target.kind).toBe("unsupported");
  });
});

describe("toContextActionLink", () => {
  it("uses entity ids rather than a fuzzy search", () => {
    expect(toContextActionLink({ authorId: statisticsIds.authorId, kind: "open_author" })).toEqual({
      href: `/books?author=${statisticsIds.authorId}`,
      kind: "open_author",
    });
    expect(
      toContextActionLink({ kind: "open_publisher", publisherId: statisticsIds.publisherId }),
    ).toEqual({ href: `/publishers/${statisticsIds.publisherId}`, kind: "open_publisher" });
    expect(toContextActionLink({ kind: "open_series", seriesId: statisticsIds.seriesId })).toEqual({
      href: `/series/${statisticsIds.seriesId}`,
      kind: "open_series",
    });
    expect(toContextActionLink({ bookId: statisticsIds.bookId, kind: "open_book" })).toEqual({
      href: `/books/${statisticsIds.bookId}`,
      kind: "open_book",
    });
    expect(toContextActionLink({ goalId: statisticsIds.goalId, kind: "open_goal" })).toEqual({
      href: `/goals/${statisticsIds.goalId}`,
      kind: "open_goal",
    });
  });

  it("keeps the backend order of context actions", () => {
    const links = toContextActionLinks([
      { kind: "open_series", seriesId: statisticsIds.seriesId },
      { authorId: statisticsIds.authorId, kind: "open_author" },
      { bookId: statisticsIds.bookId, kind: "open_book" },
    ]);

    expect(links.map((link) => link.kind)).toEqual(["open_series", "open_author", "open_book"]);
  });
});
