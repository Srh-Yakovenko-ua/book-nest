import type { HomeReadingWeek, HomeReadingWeekDay } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  homeWeekDayHref,
  homeWeekDayPreview,
  homeWeekStreakDays,
  homeWeekSummary,
  isConfirmedQuietWeek,
} from "./home-reading-week";

function week(overrides: Partial<HomeReadingWeek> = {}): HomeReadingWeek {
  return {
    activeDays: 2,
    currentStreak: {
      availability: "available",
      data: {
        continuesBeforeRange: false,
        continuesBeforeReliableHistory: false,
        days: 5,
        endDate: "2026-11-24",
        startDate: "2026-11-20",
      },
    },
    days: [
      weekDay({ date: "2026-11-23", status: "active" }),
      weekDay({ date: "2026-11-24", status: "active" }),
      weekDay({ date: "2026-11-25", status: "inactive" }),
      weekDay({ date: "2026-11-26", status: "future" }),
      weekDay({ date: "2026-11-27", status: "future" }),
      weekDay({ date: "2026-11-28", status: "future" }),
      weekDay({ date: "2026-11-29", status: "future" }),
    ],
    hasReadingHistory: true,
    pages: { quality: "exact", value: 84 },
    period: { from: "2026-11-23", to: "2026-11-29" },
    timezone: "Europe/Kyiv",
    today: "2026-11-25",
    weekStartDay: "monday",
    ...overrides,
  };
}

function weekDay(overrides: Partial<HomeReadingWeekDay> = {}): HomeReadingWeekDay {
  return {
    booksCount: null,
    date: "2026-11-24",
    pagesRead: null,
    status: "inactive",
    ...overrides,
  };
}

describe("homeWeekSummary", () => {
  it("shows the exact page count when the pages are exact", () => {
    expect(homeWeekSummary(week({ pages: { quality: "exact", value: 84 } }))).toEqual({
      kind: "exactPages",
      value: 84,
    });
  });

  it("shows an at-least page count when the pages are a lower bound", () => {
    expect(homeWeekSummary(week({ pages: { quality: "lower_bound", value: 60 } }))).toEqual({
      kind: "minimumPages",
      value: 60,
    });
  });

  it("shows the active days when the pages are unavailable", () => {
    expect(homeWeekSummary(week({ activeDays: 3, pages: { quality: "unavailable" } }))).toEqual({
      kind: "activeDays",
      value: 3,
    });
  });
});

describe("homeWeekStreakDays", () => {
  it("shows the length of the current streak", () => {
    expect(homeWeekStreakDays(week())).toBe(5);
  });

  it("shows no streak when the streak is unavailable", () => {
    expect(
      homeWeekStreakDays(week({ currentStreak: { availability: "unavailable", data: null } })),
    ).toBeNull();
  });
});

describe("homeWeekDayHref", () => {
  it("links a past day to that day in the reading calendar", () => {
    expect(homeWeekDayHref(weekDay({ date: "2026-11-24", status: "active" }))).toBe(
      "/reading-calendar?day=2026-11-24&month=2026-11&year=2026",
    );
  });

  it("links a day without reading as well", () => {
    expect(homeWeekDayHref(weekDay({ date: "2026-11-25", status: "inactive" }))).toBe(
      "/reading-calendar?day=2026-11-25&month=2026-11&year=2026",
    );
  });

  it("gives a future day no link", () => {
    expect(homeWeekDayHref(weekDay({ date: "2026-11-26", status: "future" }))).toBeNull();
  });
});

describe("homeWeekDayPreview", () => {
  it("previews the pages and books of an active day", () => {
    expect(homeWeekDayPreview(weekDay({ booksCount: 2, pagesRead: 35, status: "active" }))).toEqual(
      { booksCount: 2, pagesRead: 35 },
    );
  });

  it("previews an active day that only knows its books", () => {
    expect(homeWeekDayPreview(weekDay({ booksCount: 1, status: "active" }))).toEqual({
      booksCount: 1,
      pagesRead: null,
    });
  });

  it("gives no preview for an active day without data", () => {
    expect(homeWeekDayPreview(weekDay({ status: "active" }))).toBeNull();
  });

  it.each([["inactive"], ["unknown"], ["future"]] as const)(
    "gives no preview for a day that is %s",
    (status) => {
      expect(homeWeekDayPreview(weekDay({ booksCount: 1, pagesRead: 10, status }))).toBeNull();
    },
  );
});

describe("isConfirmedQuietWeek", () => {
  it("is quiet when no day so far had reading", () => {
    expect(
      isConfirmedQuietWeek(
        week({
          activeDays: 0,
          days: week().days.map((day): HomeReadingWeekDay =>
            day.status === "active" ? { ...day, status: "inactive" } : day,
          ),
        }),
      ),
    ).toBe(true);
  });

  it("is not quiet when a day had reading", () => {
    expect(isConfirmedQuietWeek(week())).toBe(false);
  });

  it("is not confirmed quiet when a day is unknown", () => {
    expect(
      isConfirmedQuietWeek(
        week({
          activeDays: 0,
          days: week().days.map((day): HomeReadingWeekDay =>
            day.status === "active" ? { ...day, status: "unknown" } : day,
          ),
        }),
      ),
    ).toBe(false);
  });
});
