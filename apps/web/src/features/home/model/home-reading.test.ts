import type {
  HomeActiveBooksPage,
  HomeGoalSection,
  HomeReadingView,
  HomeReadingWeek,
  HomeReadingWeekDayStatus,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { HomeReadingState } from "./home-reading";

import { homeReadingFacts, homeReadingWidget, mergeHomeReading } from "./home-reading";

const TODAY = "2026-11-25";
const TOMORROW = "2026-11-26";

const UNAVAILABLE = { reason: "SOURCE_FAILED", status: "unavailable" } as const;

function activeBooks(total: number): HomeActiveBooksPage {
  return { items: [], nextCursor: null, total };
}

function freshState(overrides: Partial<HomeReadingState> = {}): HomeReadingState {
  return {
    currentlyReading: { data: activeBooks(2), kind: "fresh" },
    readingGoal: { data: goalSection(), kind: "fresh" },
    readingWeek: { data: readingWeek(), kind: "fresh" },
    today: TODAY,
    ...overrides,
  };
}

function goalSection(overrides: Partial<HomeGoalSection> = {}): HomeGoalSection {
  return { activeGoalsCount: 1, primaryGoal: null, recentCompletion: null, ...overrides };
}

function readingView(overrides: Partial<HomeReadingView> = {}): HomeReadingView {
  return {
    currentlyReading: { data: activeBooks(2), status: "available" },
    readingGoal: { data: goalSection(), status: "available" },
    readingWeek: { data: readingWeek(), status: "available" },
    today: TODAY,
    ...overrides,
  };
}

function readingWeek({
  hasReadingHistory = true,
  todayStatus = "active",
}: {
  hasReadingHistory?: boolean;
  todayStatus?: HomeReadingWeekDayStatus;
} = {}): HomeReadingWeek {
  const day = (date: string, status: HomeReadingWeekDayStatus) => ({
    booksCount: null,
    date,
    pagesRead: null,
    status,
  });

  return {
    activeDays: 2,
    currentStreak: { availability: "unavailable", data: null },
    days: [
      day("2026-11-23", "inactive"),
      day("2026-11-24", "active"),
      day(TODAY, todayStatus),
      day(TOMORROW, "future"),
      day("2026-11-27", "future"),
      day("2026-11-28", "future"),
      day("2026-11-29", "future"),
    ],
    hasReadingHistory,
    pages: { quality: "exact", value: 40 },
    period: { from: "2026-11-23", to: "2026-11-29" },
    timezone: "Europe/Kyiv",
    today: TODAY,
    weekStartDay: "monday",
  };
}

describe("mergeHomeReading", () => {
  it("takes fresh data from a response where every section is available", () => {
    const merged = mergeHomeReading({ next: readingView(), previous: undefined });

    expect(merged.currentlyReading).toEqual({ data: activeBooks(2), kind: "fresh" });
  });

  it("replaces previous data with the new available data", () => {
    const merged = mergeHomeReading({
      next: readingView({ currentlyReading: { data: activeBooks(5), status: "available" } }),
      previous: freshState(),
    });

    expect(merged.currentlyReading).toEqual({ data: activeBooks(5), kind: "fresh" });
  });

  it("keeps the previous data marked stale when a section fails later the same day", () => {
    const merged = mergeHomeReading({
      next: readingView({ readingGoal: UNAVAILABLE }),
      previous: freshState({
        readingGoal: { data: goalSection({ activeGoalsCount: 3 }), kind: "fresh" },
      }),
    });

    expect(merged.readingGoal).toEqual({
      data: goalSection({ activeGoalsCount: 3 }),
      kind: "stale",
    });
  });

  it("drops the previous data when the failing response belongs to a new day", () => {
    const merged = mergeHomeReading({
      next: readingView({ readingWeek: UNAVAILABLE, today: TOMORROW }),
      previous: freshState(),
    });

    expect(merged.readingWeek).toEqual({ kind: "unavailable", reason: "SOURCE_FAILED" });
  });

  it("marks a section unavailable when it fails on the first response", () => {
    const merged = mergeHomeReading({
      next: readingView({ currentlyReading: UNAVAILABLE }),
      previous: undefined,
    });

    expect(merged.currentlyReading).toEqual({ kind: "unavailable", reason: "SOURCE_FAILED" });
  });

  it("leaves the sections that did not fail fresh", () => {
    const merged = mergeHomeReading({
      next: readingView({ readingGoal: UNAVAILABLE }),
      previous: freshState(),
    });

    expect(merged.readingWeek).toEqual({ data: readingWeek(), kind: "fresh" });
  });
});

describe("homeReadingWidget", () => {
  it("is loading before the first response", () => {
    expect(
      homeReadingWidget({ isError: false, isRefetchError: false, section: undefined }),
    ).toEqual({ kind: "loading" });
  });

  it("is an error when the first request fails", () => {
    expect(homeReadingWidget({ isError: true, isRefetchError: false, section: undefined })).toEqual(
      { kind: "error" },
    );
  });

  it("is an error when the section is unavailable", () => {
    expect(
      homeReadingWidget({
        isError: false,
        isRefetchError: false,
        section: { kind: "unavailable", reason: "SOURCE_FAILED" },
      }),
    ).toEqual({ kind: "error" });
  });

  it("shows fresh data as stale while a refetch is failing", () => {
    expect(
      homeReadingWidget({
        isError: true,
        isRefetchError: true,
        section: { data: activeBooks(2), kind: "fresh" },
      }),
    ).toEqual({ data: activeBooks(2), kind: "stale" });
  });

  it("shows fresh data as fresh when nothing failed", () => {
    expect(
      homeReadingWidget({
        isError: false,
        isRefetchError: false,
        section: { data: activeBooks(2), kind: "fresh" },
      }),
    ).toEqual({ data: activeBooks(2), kind: "fresh" });
  });
});

describe("homeReadingFacts", () => {
  it("knows nothing before the first response", () => {
    expect(homeReadingFacts(undefined)).toEqual({
      activeBooksCount: null,
      goalPresence: "unknown",
      hasReadToday: null,
      historyPresence: "unknown",
    });
  });

  it("counts the active books from the currently reading total", () => {
    const state = freshState({ currentlyReading: { data: activeBooks(4), kind: "fresh" } });

    expect(homeReadingFacts(state).activeBooksCount).toBe(4);
  });

  it.each([
    ["active", true],
    ["inactive", false],
    ["unknown", null],
    ["future", null],
  ] as const)("reads today from today's cell, which is %s", (todayStatus, expected) => {
    const state = freshState({
      readingWeek: { data: readingWeek({ todayStatus }), kind: "fresh" },
    });

    expect(homeReadingFacts(state).hasReadToday).toBe(expected);
  });

  it("does not know about today when the week is unavailable", () => {
    const state = freshState({ readingWeek: { kind: "unavailable", reason: "SOURCE_FAILED" } });

    expect(homeReadingFacts(state)).toMatchObject({
      hasReadToday: null,
      historyPresence: "unknown",
    });
  });

  it("counts a goal as present when one is active", () => {
    const state = freshState({
      readingGoal: { data: goalSection({ activeGoalsCount: 1 }), kind: "fresh" },
    });

    expect(homeReadingFacts(state).goalPresence).toBe("present");
  });

  it("counts a goal as present when none is active but one was recently completed", () => {
    const state = freshState({
      readingGoal: {
        data: goalSection({
          activeGoalsCount: 0,
          recentCompletion: {
            completedAt: "2026-11-22",
            goalId: "5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c",
            listName: null,
            name: "12 книжок",
            targetCount: 12,
          },
        }),
        kind: "fresh",
      },
    });

    expect(homeReadingFacts(state).goalPresence).toBe("present");
  });

  it("counts a goal as absent when none is active and none was recently completed", () => {
    const state = freshState({
      readingGoal: { data: goalSection({ activeGoalsCount: 0 }), kind: "fresh" },
    });

    expect(homeReadingFacts(state).goalPresence).toBe("absent");
  });

  it("does not know about goals when the goal section is unavailable", () => {
    const state = freshState({ readingGoal: { kind: "unavailable", reason: "SOURCE_FAILED" } });

    expect(homeReadingFacts(state).goalPresence).toBe("unknown");
  });

  it.each([
    [true, "present"],
    [false, "absent"],
  ] as const)("reads history presence from hasReadingHistory %s", (hasReadingHistory, expected) => {
    const state = freshState({
      readingWeek: { data: readingWeek({ hasReadingHistory }), kind: "fresh" },
    });

    expect(homeReadingFacts(state).historyPresence).toBe(expected);
  });

  it("keeps using stale data for the facts", () => {
    const state = freshState({
      readingWeek: { data: readingWeek({ todayStatus: "inactive" }), kind: "stale" },
    });

    expect(homeReadingFacts(state).hasReadToday).toBe(false);
  });
});
