import { describe, expect, it } from "vitest";

import { resolveGoalPlanGap, resolveGoalRateFigure, roundToTenth } from "./goal-pace-figures";

describe("resolveGoalPlanGap", () => {
  it("treats a gap that rounds to zero books as being on plan", () => {
    expect(resolveGoalPlanGap({ pace: "on_track", paceDeltaBooks: -0.04 })).toEqual({
      books: 0,
      kind: "on_plan",
      pace: "on_track",
    });
  });

  it("calls a small lag inside the on-track band close behind, not behind", () => {
    expect(resolveGoalPlanGap({ pace: "on_track", paceDeltaBooks: -0.4 })).toEqual({
      books: 0.4,
      kind: "close_behind",
      pace: "on_track",
    });
  });

  it("calls the same lag behind once the server says the pace is behind", () => {
    expect(resolveGoalPlanGap({ pace: "behind", paceDeltaBooks: -0.4 })).toEqual({
      books: 0.4,
      kind: "behind",
      pace: "behind",
    });
  });

  it("keeps a critical pace behind with no books to catch up when the delta shows a lead", () => {
    expect(resolveGoalPlanGap({ pace: "critical", paceDeltaBooks: 0.3 })).toEqual({
      books: 0,
      kind: "behind",
      pace: "critical",
    });
  });

  it("keeps a behind pace behind with no books to catch up when the delta shows a lead", () => {
    expect(resolveGoalPlanGap({ pace: "behind", paceDeltaBooks: 0.1 })).toEqual({
      books: 0,
      kind: "behind",
      pace: "behind",
    });
  });

  it("states a critical lag in books rounded to a tenth", () => {
    expect(resolveGoalPlanGap({ pace: "critical", paceDeltaBooks: -2.04 })).toEqual({
      books: 2,
      kind: "behind",
      pace: "critical",
    });
  });

  it("states a lead in books rounded to a tenth", () => {
    expect(resolveGoalPlanGap({ pace: "ahead", paceDeltaBooks: 1.26 })).toEqual({
      books: 1.3,
      kind: "ahead",
      pace: "ahead",
    });
  });

  it.each([
    { pace: null, paceDeltaBooks: -0.4 },
    { pace: "on_track" as const, paceDeltaBooks: null },
  ])("has no gap to show without both the pace and the delta: %o", (metrics) => {
    expect(resolveGoalPlanGap(metrics)).toBeNull();
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
