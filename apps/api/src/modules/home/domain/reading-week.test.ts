import type { HomeReadingWeek, StatisticsCalendarHistoryQuality, WeekStartDay } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { HomeTemporalContext } from "./home-temporal-context.js";
import type { WeekActivityDay, WeekActivityInput } from "./reading-week.js";

import { buildHomeReadingWeek, resolveCalendarWeek, toWeekDay } from "./reading-week.js";

const TODAY = "2026-11-26";

const WEEK_DATES = [
  "2026-11-23",
  "2026-11-24",
  "2026-11-25",
  "2026-11-26",
  "2026-11-27",
  "2026-11-28",
  "2026-11-29",
];

function activityDay({
  booksCount = 0,
  date,
  historyQuality = "exact",
  pagesRead = 0,
}: {
  booksCount?: number;
  date: string;
  historyQuality?: StatisticsCalendarHistoryQuality;
  pagesRead?: number;
}): WeekActivityDay {
  return { booksCount, date, historyQuality, pagesRead };
}

function buildWeek({
  days,
  periodReliable,
}: {
  days: WeekActivityDay[];
  periodReliable: boolean;
}): HomeReadingWeek {
  return buildHomeReadingWeek({
    activity: weekActivity({ days, periodReliable }),
    period: { from: "2026-11-23", to: "2026-11-29" },
    temporal: temporalOn(TODAY),
  });
}

function quietWeek(historyQuality: StatisticsCalendarHistoryQuality): WeekActivityDay[] {
  return WEEK_DATES.map((date) => activityDay({ date, historyQuality }));
}

function temporalOn(today: string): HomeTemporalContext {
  return {
    day: new Date(`${today}T00:00:00.000Z`),
    timeZone: "Europe/Kyiv",
    today,
    weekStartDay: "monday",
  };
}

function weekActivity({
  days,
  periodReliable,
}: {
  days: WeekActivityDay[];
  periodReliable: boolean;
}): WeekActivityInput {
  return {
    currentStreak: { availability: "unavailable", data: null },
    days,
    hasReadingHistory: true,
    periodReliable,
  };
}

describe("resolveCalendarWeek", () => {
  it.each<[string, WeekStartDay, string, string]>([
    ["2026-11-24", "monday", "2026-11-23", "2026-11-29"],
    ["2026-11-24", "sunday", "2026-11-22", "2026-11-28"],
    ["2026-11-30", "monday", "2026-11-30", "2026-12-06"],
    ["2026-11-29", "monday", "2026-11-23", "2026-11-29"],
    ["2026-11-29", "sunday", "2026-11-29", "2026-12-05"],
    ["2026-12-01", "monday", "2026-11-30", "2026-12-06"],
    ["2026-12-01", "sunday", "2026-11-29", "2026-12-05"],
    ["2026-12-31", "monday", "2026-12-28", "2027-01-03"],
    ["2026-12-31", "sunday", "2026-12-27", "2027-01-02"],
    ["2027-01-01", "monday", "2026-12-28", "2027-01-03"],
    ["2027-01-01", "sunday", "2026-12-27", "2027-01-02"],
  ])("puts %s in a %s-start week from %s to %s", (today, weekStartDay, from, to) => {
    expect(resolveCalendarWeek({ today, weekStartDay })).toEqual({ from, to });
  });
});

describe("toWeekDay", () => {
  it("marks a day after today as future with unknown pages and books", () => {
    expect(toWeekDay({ day: activityDay({ date: "2026-11-27" }), today: TODAY })).toEqual({
      booksCount: null,
      date: "2026-11-27",
      pagesRead: null,
      status: "future",
    });
  });

  it("marks a day with pages read as active", () => {
    expect(
      toWeekDay({
        day: activityDay({ booksCount: 2, date: "2026-11-24", pagesRead: 48 }),
        today: TODAY,
      }),
    ).toEqual({ booksCount: 2, date: "2026-11-24", pagesRead: 48, status: "active" });
  });

  it("marks a legacy day with pages read as active", () => {
    expect(
      toWeekDay({
        day: activityDay({
          booksCount: 1,
          date: "2026-11-24",
          historyQuality: "legacy_observed_only",
          pagesRead: 12,
        }),
        today: TODAY,
      }),
    ).toEqual({ booksCount: 1, date: "2026-11-24", pagesRead: 12, status: "active" });
  });

  it("marks a legacy day without pages as unknown rather than inactive", () => {
    expect(
      toWeekDay({
        day: activityDay({ date: "2026-11-24", historyQuality: "legacy_observed_only" }),
        today: TODAY,
      }),
    ).toEqual({ booksCount: null, date: "2026-11-24", pagesRead: null, status: "unknown" });
  });

  it("marks a reliable day without pages as inactive with zero pages and books", () => {
    expect(toWeekDay({ day: activityDay({ date: "2026-11-24" }), today: TODAY })).toEqual({
      booksCount: 0,
      date: "2026-11-24",
      pagesRead: 0,
      status: "inactive",
    });
  });

  it("treats today without pages as inactive, not future", () => {
    expect(toWeekDay({ day: activityDay({ date: TODAY }), today: TODAY })).toMatchObject({
      status: "inactive",
    });
  });
});

describe("buildHomeReadingWeek", () => {
  it("returns the seven days of the week in calendar order", () => {
    const week = buildWeek({ days: quietWeek("exact"), periodReliable: true });

    expect(week.days.map((day) => day.date)).toEqual(WEEK_DATES);
  });

  it("counts each active day once however many books were read on it", () => {
    const week = buildWeek({
      days: [
        activityDay({ booksCount: 3, date: "2026-11-23", pagesRead: 60 }),
        activityDay({ date: "2026-11-24" }),
        activityDay({ booksCount: 1, date: "2026-11-25", pagesRead: 15 }),
        activityDay({ date: "2026-11-26" }),
        activityDay({ date: "2026-11-27" }),
        activityDay({ date: "2026-11-28" }),
        activityDay({ date: "2026-11-29" }),
      ],
      periodReliable: true,
    });

    expect(week.activeDays).toBe(2);
  });

  it("reports exact pages for a week that starts inside reliable history", () => {
    const week = buildWeek({
      days: [
        activityDay({ booksCount: 1, date: "2026-11-23", pagesRead: 20 }),
        activityDay({ booksCount: 2, date: "2026-11-24", pagesRead: 35 }),
        activityDay({ date: "2026-11-25" }),
        activityDay({ booksCount: 1, date: "2026-11-26", pagesRead: 12 }),
        activityDay({ date: "2026-11-27" }),
        activityDay({ date: "2026-11-28" }),
        activityDay({ date: "2026-11-29" }),
      ],
      periodReliable: true,
    });

    expect(week.pages).toEqual({ quality: "exact", value: 67 });
  });

  it("reports exactly zero pages for a quiet week inside reliable history", () => {
    const week = buildWeek({ days: quietWeek("exact"), periodReliable: true });

    expect(week.pages).toEqual({ quality: "exact", value: 0 });
  });

  it("reports the observed pages as a lower bound for a partly legacy week", () => {
    const week = buildWeek({
      days: [
        activityDay({
          booksCount: 1,
          date: "2026-11-23",
          historyQuality: "legacy_observed_only",
          pagesRead: 30,
        }),
        activityDay({ date: "2026-11-24", historyQuality: "legacy_observed_only" }),
        activityDay({ booksCount: 1, date: "2026-11-25", pagesRead: 15 }),
        activityDay({ date: "2026-11-26" }),
        activityDay({ date: "2026-11-27" }),
        activityDay({ date: "2026-11-28" }),
        activityDay({ date: "2026-11-29" }),
      ],
      periodReliable: false,
    });

    expect(week.pages).toEqual({ quality: "lower_bound", value: 45 });
  });

  it("reports pages as unavailable without a value for a quiet partly legacy week", () => {
    const week = buildWeek({ days: quietWeek("legacy_observed_only"), periodReliable: false });

    expect(week.pages).toEqual({ quality: "unavailable" });
    expect(week.pages).not.toHaveProperty("value");
  });

  it("shows quiet past legacy days as unknown and days after today as future", () => {
    const week = buildWeek({ days: quietWeek("legacy_observed_only"), periodReliable: false });

    expect(week.days.map((day) => day.status)).toEqual([
      "unknown",
      "unknown",
      "unknown",
      "unknown",
      "future",
      "future",
      "future",
    ]);
  });
});
