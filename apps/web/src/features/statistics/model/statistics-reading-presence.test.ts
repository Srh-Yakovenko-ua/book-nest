import type { Nullable, ReadingStatisticsOverview, ReadingStatisticsPeriodKind } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { LibraryPresence } from "@/features/books";

import type {
  StatisticsAllTimeOverview,
  StatisticsPresenceSignal,
} from "./statistics-reading-presence";

import { toOverviewParams } from "./statistics-period";
import {
  hasStatisticsPresence,
  needsAllTimeOverview,
  resolveStatisticsReadingPresence,
  STATISTICS_ALL_TIME_OVERVIEW_PARAMS,
} from "./statistics-reading-presence";
import { calendarFixture, overviewFixture } from "./statistics.fixtures";

type Activity = { activeDays: number; completedReads: number; pagesRead: Nullable<number> };

const NO_ACTIVITY: Activity = { activeDays: 0, completedReads: 0, pagesRead: 0 };

const PAGES_ONLY: Activity = { activeDays: 0, completedReads: 0, pagesRead: 120 };

const COMPLETED_READ: Activity = { activeDays: 0, completedReads: 1, pagesRead: 0 };

const ACTIVE_DAYS_ONLY: Activity = { activeDays: 2, completedReads: 0, pagesRead: 0 };

const UNKNOWN_PAGES: Activity = { activeDays: 0, completedReads: 0, pagesRead: null };

const LIBRARY_WITH_BOOKS: LibraryPresence = { kind: "ready", total: 4 };

const EMPTY_LIBRARY: LibraryPresence = { kind: "ready", total: 0 };

function overviewWith({
  activity = NO_ACTIVITY,
  period = "year",
}: {
  activity?: Activity;
  period?: ReadingStatisticsPeriodKind;
} = {}): ReadingStatisticsOverview {
  const base = overviewFixture();
  return overviewFixture({
    calendar: calendarFixture({ activeDays: activity.activeDays }),
    kpis: {
      ...base.kpis,
      completedReads: { ...base.kpis.completedReads, value: activity.completedReads },
      pagesRead: { ...base.kpis.pagesRead, value: activity.pagesRead },
    },
    period: { ...base.period, kind: period },
  });
}

function readyAllTime(activity: Activity): StatisticsAllTimeOverview {
  return { kind: "ready", overview: overviewWith({ activity, period: "all_time" }) };
}

describe("hasStatisticsPresence", () => {
  it.each<[string, StatisticsPresenceSignal, boolean, Activity]>([
    ["pages read", "reading", true, PAGES_ONLY],
    ["active days", "reading", true, ACTIVE_DAYS_ONLY],
    ["a completed read", "reading", true, COMPLETED_READ],
    ["unknown pages and nothing else", "reading", false, UNKNOWN_PAGES],
    ["nothing", "reading", false, NO_ACTIVITY],
    ["pages read", "completedReads", false, PAGES_ONLY],
    ["active days", "completedReads", false, ACTIVE_DAYS_ONLY],
    ["a completed read", "completedReads", true, COMPLETED_READ],
  ])("counts %s as %s presence: %s", (_label, signal, expected, activity) => {
    expect(hasStatisticsPresence({ overview: overviewWith({ activity }), signal })).toBe(expected);
  });
});

describe("needsAllTimeOverview", () => {
  it.each<[string, ReadingStatisticsPeriodKind, StatisticsPresenceSignal, Activity, boolean]>([
    ["an empty year", "year", "reading", NO_ACTIVITY, true],
    ["empty last 12 months", "last_12_months", "reading", NO_ACTIVITY, true],
    ["an empty custom range", "custom", "reading", NO_ACTIVITY, true],
    ["an empty all-time period", "all_time", "reading", NO_ACTIVITY, false],
    ["a year with pages read", "year", "reading", PAGES_ONLY, false],
    ["a year with pages but no completed read", "year", "completedReads", PAGES_ONLY, true],
  ])("decides whether %s needs all time", (_label, period, signal, activity, expected) => {
    expect(needsAllTimeOverview({ selected: overviewWith({ activity, period }), signal })).toBe(
      expected,
    );
  });
});

describe("STATISTICS_ALL_TIME_OVERVIEW_PARAMS", () => {
  it("matches the overview params the all-time period selection produces", () => {
    const allTimeSelection = toOverviewParams(
      { compare: "previous_period", from: "", period: "all_time", to: "", year: 2024 },
      "2026-03-31",
    );

    expect(STATISTICS_ALL_TIME_OVERVIEW_PARAMS).toEqual(allTimeSelection);
    expect(STATISTICS_ALL_TIME_OVERVIEW_PARAMS).toEqual({ period: "all_time" });
  });
});

describe("resolveStatisticsReadingPresence", () => {
  it("reports activity in the selected period before the all-time query is asked", () => {
    expect(
      resolveStatisticsReadingPresence({
        allTime: { kind: "pending" },
        library: LIBRARY_WITH_BOOKS,
        selected: overviewWith({ activity: PAGES_ONLY }),
        signal: "reading",
      }),
    ).toEqual({ kind: "has_activity" });
  });

  it.each<[string, StatisticsAllTimeOverview, LibraryPresence]>([
    ["the library", readyAllTime(NO_ACTIVITY), { kind: "pending" }],
    ["the all-time overview", { kind: "pending" }, LIBRARY_WITH_BOOKS],
  ])("waits while %s is pending", (_label, allTime, library) => {
    expect(
      resolveStatisticsReadingPresence({
        allTime,
        library,
        selected: overviewWith(),
        signal: "reading",
      }),
    ).toEqual({ kind: "pending" });
  });

  it("waits for the library on an empty all-time period", () => {
    expect(
      resolveStatisticsReadingPresence({
        allTime: { kind: "pending" },
        library: { kind: "pending" },
        selected: overviewWith({ period: "all_time" }),
        signal: "reading",
      }),
    ).toEqual({ kind: "pending" });
  });

  it("reports an empty period when reading exists at all time", () => {
    expect(
      resolveStatisticsReadingPresence({
        allTime: readyAllTime(COMPLETED_READ),
        library: LIBRARY_WITH_BOOKS,
        selected: overviewWith(),
        signal: "reading",
      }),
    ).toEqual({ kind: "period_empty" });
  });

  it("falls back to an empty period when the all-time query fails", () => {
    expect(
      resolveStatisticsReadingPresence({
        allTime: { kind: "error" },
        library: EMPTY_LIBRARY,
        selected: overviewWith(),
        signal: "reading",
      }),
    ).toEqual({ kind: "period_empty" });
  });

  it("judges all-time presence by the same signal as the selected period", () => {
    expect(
      resolveStatisticsReadingPresence({
        allTime: readyAllTime(PAGES_ONLY),
        library: LIBRARY_WITH_BOOKS,
        selected: overviewWith(),
        signal: "completedReads",
      }),
    ).toEqual({ hasBooks: true, kind: "no_activity" });
  });

  it.each<[string, LibraryPresence, boolean]>([
    ["with books", LIBRARY_WITH_BOOKS, true],
    ["without books", EMPTY_LIBRARY, false],
  ])("reports no reading at all time %s", (_label, library, hasBooks) => {
    expect(
      resolveStatisticsReadingPresence({
        allTime: readyAllTime(NO_ACTIVITY),
        library,
        selected: overviewWith(),
        signal: "reading",
      }),
    ).toEqual({ hasBooks, kind: "no_activity" });
  });

  it.each<[string, StatisticsAllTimeOverview]>([
    ["pending", { kind: "pending" }],
    ["failed", { kind: "error" }],
    ["full of reading", readyAllTime(COMPLETED_READ)],
  ])("decides an all-time period alone when the all-time input is %s", (_label, allTime) => {
    expect(
      resolveStatisticsReadingPresence({
        allTime,
        library: EMPTY_LIBRARY,
        selected: overviewWith({ period: "all_time" }),
        signal: "reading",
      }),
    ).toEqual({ hasBooks: false, kind: "no_activity" });
  });

  it.each<[string, ReadingStatisticsPeriodKind, StatisticsAllTimeOverview]>([
    ["an empty all-time period", "all_time", { kind: "pending" }],
    ["an empty year with no reading at all time", "year", readyAllTime(NO_ACTIVITY)],
  ])("offers a retry when the library fails on %s", (_label, period, allTime) => {
    const retry = vi.fn();

    expect(
      resolveStatisticsReadingPresence({
        allTime,
        library: { kind: "error", retry },
        selected: overviewWith({ period }),
        signal: "reading",
      }),
    ).toEqual({ kind: "error", retry });
  });
});
