import { describe, expect, it } from "vitest";

import {
  resolveGoalPaceAdvice,
  resolveGoalPaceBadge,
  resolveGoalRateFigure,
  roundToTenth,
} from "./goal-pace-figures";

describe("resolveGoalPaceBadge", () => {
  it.each([
    { pace: "on_track" as const, paceDeltaBooks: -0.04 },
    { pace: "on_track" as const, paceDeltaBooks: 0 },
    { pace: "on_track" as const, paceDeltaBooks: 0.3 },
  ])("shows the on-track pace when the delta rounds to no lag: %o", (metrics) => {
    expect(resolveGoalPaceBadge(metrics)).toEqual({ kind: "pace", pace: "on_track" });
  });

  it.each([
    { pace: "on_track" as const, paceDeltaBooks: -0.4 },
    { pace: "on_track" as const, paceDeltaBooks: -0.06 },
  ])("calls a lag inside the on-track band close to plan: %o", (metrics) => {
    expect(resolveGoalPaceBadge(metrics)).toEqual({ kind: "close_to_plan" });
  });

  it.each([
    { pace: "ahead" as const, paceDeltaBooks: 1.26 },
    { pace: "ahead" as const, paceDeltaBooks: -0.4 },
    { pace: "behind" as const, paceDeltaBooks: -0.4 },
    { pace: "behind" as const, paceDeltaBooks: 0.1 },
    { pace: "critical" as const, paceDeltaBooks: 0.3 },
    { pace: "critical" as const, paceDeltaBooks: -2.04 },
  ])("keeps the server $pace pace at a delta of $paceDeltaBooks", (metrics) => {
    expect(resolveGoalPaceBadge(metrics)).toEqual({ kind: "pace", pace: metrics.pace });
  });

  it.each([
    { pace: null, paceDeltaBooks: -0.4 },
    { pace: "on_track" as const, paceDeltaBooks: null },
  ])("shows no badge without both the pace and the delta: %o", (metrics) => {
    expect(resolveGoalPaceBadge(metrics)).toBeNull();
  });
});

describe("resolveGoalRateFigure", () => {
  it("leads with days per book and keeps books per day as the detail", () => {
    expect(resolveGoalRateFigure({ booksPerDay: 0.2, daysPerBook: 5 })).toEqual({
      booksPerDay: 0.2,
      daysPerBook: 5,
      kind: "days_per_book",
    });
  });

  it("drops a zero books-per-day detail next to a known days-per-book figure", () => {
    expect(resolveGoalRateFigure({ booksPerDay: 0, daysPerBook: 5 })).toEqual({
      booksPerDay: null,
      daysPerBook: 5,
      kind: "days_per_book",
    });
  });

  it.each([
    { booksPerDay: 0.5, daysPerBook: null },
    { booksPerDay: 0.5, daysPerBook: 0 },
  ])("falls back to books per day without a usable days-per-book figure: %o", (rates) => {
    expect(resolveGoalRateFigure(rates)).toEqual({ booksPerDay: 0.5, kind: "books_per_day" });
  });

  it.each([
    { booksPerDay: null, daysPerBook: null },
    { booksPerDay: 0, daysPerBook: 0 },
    { booksPerDay: 0, daysPerBook: null },
  ])("reports a missing rate instead of a zero one: %o", (rates) => {
    expect(resolveGoalRateFigure(rates)).toEqual({ kind: "missing" });
  });
});

describe("resolveGoalPaceAdvice", () => {
  it.each([
    { booksPerDay: 0.072, days: 14, daysPerBook: 13.8 },
    { booksPerDay: 0.233, days: 4, daysPerBook: 4.3 },
    { booksPerDay: 1, days: 1, daysPerBook: 1 },
  ])("rounds $daysPerBook days per book to $days whole days", ({ days, ...rates }) => {
    expect(resolveGoalPaceAdvice(rates)).toEqual({ days, kind: "days_per_book" });
  });

  it.each([
    { booksPerDay: 1.5, daysPerBook: 0.7, rounded: 1.5 },
    { booksPerDay: 1.667, daysPerBook: 0.6, rounded: 1.7 },
    { booksPerDay: 1.96, daysPerBook: 0.5, rounded: 2 },
  ])(
    "switches to $rounded books per day when a book is needed more often than daily",
    ({ rounded, ...rates }) => {
      expect(resolveGoalPaceAdvice(rates)).toEqual({ booksPerDay: rounded, kind: "books_per_day" });
    },
  );

  it("keeps books per day when there is no days-per-book figure", () => {
    expect(resolveGoalPaceAdvice({ booksPerDay: 30, daysPerBook: 0 })).toEqual({
      booksPerDay: 30,
      kind: "books_per_day",
    });
  });

  it.each([
    { booksPerDay: null, daysPerBook: null },
    { booksPerDay: null, daysPerBook: 0.5 },
  ])("gives no advice without a usable rate: %o", (rates) => {
    expect(resolveGoalPaceAdvice(rates)).toEqual({ kind: "missing" });
  });
});

describe("roundToTenth", () => {
  it.each([
    [2.44, 2.4],
    [0.96, 1],
    [-0.04, 0],
    [47.9, 47.9],
  ])("rounds %s to %s", (value, rounded) => {
    expect(roundToTenth(value)).toBeCloseTo(rounded, 9);
  });
});
