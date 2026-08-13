import type { Nullable } from "@app/shared";

import { ReadingGoalMetricsSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { ReadingGoalSnapshotBook } from "./reading-goal-metrics.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { calculateReadingGoalMetrics } from "./reading-goal-metrics.js";

type MetricsInput = Parameters<typeof calculateReadingGoalMetrics>[0];

const baseGoal = {
  archivedAt: null,
  createdAt: new Date("2026-08-01T09:15:00.000Z"),
  deadline: parseIsoDate("2026-08-20"),
  targetCount: 5,
} satisfies MetricsInput["goal"];

const baseInput = {
  goal: baseGoal,
  now: new Date("2026-08-10T12:00:00.000Z"),
  snapshotBooks: snapshotBooks(["2026-08-03", "2026-08-07", null, null, null]),
} satisfies MetricsInput;

function calculateMetrics(overrides: Partial<MetricsInput>) {
  return calculateReadingGoalMetrics({ ...baseInput, ...overrides }).metrics;
}

function snapshotBooks(qualifiedDates: Nullable<string>[]): ReadingGoalSnapshotBook[] {
  return qualifiedDates.map((qualifiedFinishedAt, index) => ({
    bookId: `book-${index + 1}`,
    qualifiedFinishedAt: qualifiedFinishedAt === null ? null : parseIsoDate(qualifiedFinishedAt),
  }));
}

describe("calculateReadingGoalMetrics progress", () => {
  it("reports an untouched goal as zero of its target", () => {
    const metrics = calculateMetrics({
      snapshotBooks: snapshotBooks([null, null, null, null, null]),
    });

    expect(metrics.completedCount).toBe(0);
    expect(metrics.progressPercent).toBe(0);
    expect(metrics.remainingCount).toBe(5);
  });

  it("reports partial progress as the share of the target that is counted", () => {
    const metrics = calculateMetrics({});

    expect(metrics.completedCount).toBe(2);
    expect(metrics.progressPercent).toBe(40);
    expect(metrics.remainingCount).toBe(3);
  });

  it("reports a reached target as one hundred percent with nothing remaining", () => {
    const metrics = calculateMetrics({
      snapshotBooks: snapshotBooks([
        "2026-08-03",
        "2026-08-04",
        "2026-08-05",
        "2026-08-06",
        "2026-08-07",
      ]),
    });

    expect(metrics.completedCount).toBe(5);
    expect(metrics.progressPercent).toBe(100);
    expect(metrics.remainingCount).toBe(0);
  });

  it("caps progress at one hundred percent when more books than the target are counted", () => {
    const metrics = calculateMetrics({
      snapshotBooks: snapshotBooks([
        "2026-08-03",
        "2026-08-04",
        "2026-08-05",
        "2026-08-06",
        "2026-08-07",
        "2026-08-08",
      ]),
    });

    expect(metrics.completedCount).toBe(6);
    expect(metrics.progressPercent).toBe(100);
    expect(metrics.remainingCount).toBe(0);
  });

  it("returns the lifecycle alongside the metrics so no caller recomputes it", () => {
    const { metrics, progress } = calculateReadingGoalMetrics(baseInput);

    expect(progress).toStrictEqual({
      completedAt: null,
      completedCount: metrics.completedCount,
      daysLeft: metrics.daysLeft,
      remainingCount: metrics.remainingCount,
      result: null,
      status: "active",
    });
  });
});

describe("calculateReadingGoalMetrics snapshot qualification", () => {
  it("ignores a cached date that falls before the goal started", () => {
    const metrics = calculateMetrics({
      snapshotBooks: snapshotBooks(["2026-07-31", "2026-08-07", null, null, null]),
    });

    expect(metrics.completedCount).toBe(1);
    expect(metrics.lastCountedAt).toBe("2026-08-07");
  });

  it("ignores a cached date that falls after the deadline", () => {
    const metrics = calculateMetrics({
      snapshotBooks: snapshotBooks(["2026-08-03", "2026-08-21", null, null, null]),
    });

    expect(metrics.completedCount).toBe(1);
    expect(metrics.lastCountedAt).toBe("2026-08-03");
  });

  it("counts a book finished on the goal start day and on the deadline day", () => {
    const metrics = calculateMetrics({
      now: new Date("2026-08-20T12:00:00.000Z"),
      snapshotBooks: snapshotBooks(["2026-08-01", "2026-08-20", null, null, null]),
    });

    expect(metrics.completedCount).toBe(2);
    expect(metrics.lastCountedAt).toBe("2026-08-20");
  });

  it("leaves lastCountedAt null while nothing qualifies", () => {
    const metrics = calculateMetrics({
      snapshotBooks: snapshotBooks([null, null, null, null, null]),
    });

    expect(metrics.lastCountedAt).toBeNull();
  });
});

describe("calculateReadingGoalMetrics idle days", () => {
  it("counts the idle days from the newest counted book", () => {
    expect(calculateMetrics({}).daysSinceLastCounted).toBe(3);
  });

  it("counts the idle days from the goal start while nothing is counted", () => {
    expect(
      calculateMetrics({ snapshotBooks: snapshotBooks([null, null, null, null, null]) })
        .daysSinceLastCounted,
    ).toBe(9);
  });

  it("reports no idle days when the counted date runs a day ahead of now", () => {
    expect(
      calculateMetrics({ snapshotBooks: snapshotBooks(["2026-08-11", null, null, null, null]) })
        .daysSinceLastCounted,
    ).toBe(0);
  });

  it("keeps counting idle days after the deadline has passed", () => {
    expect(
      calculateMetrics({ now: new Date("2026-08-25T12:00:00.000Z") }).daysSinceLastCounted,
    ).toBe(18);
  });

  it("reports no idle days for an archived goal", () => {
    const metrics = calculateMetrics({
      goal: { ...baseGoal, archivedAt: new Date("2026-08-09T10:00:00.000Z") },
    });

    expect(metrics.daysSinceLastCounted).toBeNull();
  });

  it("reports no idle days for a completed goal", () => {
    const metrics = calculateMetrics({
      snapshotBooks: snapshotBooks([
        "2026-08-03",
        "2026-08-04",
        "2026-08-05",
        "2026-08-06",
        "2026-08-07",
      ]),
    });

    expect(metrics.daysSinceLastCounted).toBeNull();
  });
});

describe("calculateReadingGoalMetrics required and actual pace", () => {
  it("spreads the remaining books over the days left including today", () => {
    const metrics = calculateMetrics({});

    expect(metrics.requiredBooksPerDay).toBe(0.273);
    expect(metrics.requiredDaysPerBook).toBe(3.7);
  });

  it("drops the required pace once no book is owed", () => {
    const metrics = calculateMetrics({
      snapshotBooks: snapshotBooks([
        "2026-08-03",
        "2026-08-04",
        "2026-08-05",
        "2026-08-06",
        "2026-08-07",
      ]),
    });

    expect(metrics.requiredBooksPerDay).toBeNull();
    expect(metrics.requiredDaysPerBook).toBeNull();
  });

  it("drops the required pace for a goal whose deadline has passed", () => {
    const metrics = calculateMetrics({ now: new Date("2026-08-25T12:00:00.000Z") });

    expect(metrics.requiredBooksPerDay).toBeNull();
    expect(metrics.requiredDaysPerBook).toBeNull();
  });

  it("reports the observed rate and the days each counted book took", () => {
    const metrics = calculateMetrics({});

    expect(metrics.actualBooksPerDay).toBe(0.2);
    expect(metrics.averageDaysPerBook).toBe(5);
  });

  it("reports a zero observed rate and no average while nothing is counted", () => {
    const metrics = calculateMetrics({
      snapshotBooks: snapshotBooks([null, null, null, null, null]),
    });

    expect(metrics.actualBooksPerDay).toBe(0);
    expect(metrics.averageDaysPerBook).toBeNull();
  });

  it("freezes the achieved rate of a completed goal, whichever day it is asked on", () => {
    const finishedBooks = snapshotBooks([
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-04",
      "2026-08-05",
    ]);
    const onCompletionDay = calculateMetrics({
      now: new Date("2026-08-05T20:00:00.000Z"),
      snapshotBooks: finishedBooks,
    });
    const onTheDeadline = calculateMetrics({
      now: new Date("2026-08-20T20:00:00.000Z"),
      snapshotBooks: finishedBooks,
    });

    expect(onCompletionDay).toMatchObject({
      actualBooksPerDay: 1,
      averageDaysPerBook: 1,
      elapsedDays: 5,
    });
    expect(onTheDeadline).toMatchObject({
      actualBooksPerDay: onCompletionDay.actualBooksPerDay,
      averageDaysPerBook: onCompletionDay.averageDaysPerBook,
      elapsedDays: onCompletionDay.elapsedDays,
    });
  });

  it("freezes the achieved rate of an archived goal on its archiving day", () => {
    const archivedGoal = { ...baseGoal, archivedAt: new Date("2026-08-08T10:00:00.000Z") };
    const dayAfterArchiving = calculateMetrics({
      goal: archivedGoal,
      now: new Date("2026-08-09T12:00:00.000Z"),
    });
    const monthsLater = calculateMetrics({
      goal: archivedGoal,
      now: new Date("2026-11-06T12:00:00.000Z"),
    });

    expect(dayAfterArchiving).toMatchObject({
      actualBooksPerDay: 0.25,
      averageDaysPerBook: 4,
      elapsedDays: 8,
    });
    expect(monthsLater).toMatchObject({
      actualBooksPerDay: dayAfterArchiving.actualBooksPerDay,
      averageDaysPerBook: dayAfterArchiving.averageDaysPerBook,
      elapsedDays: dayAfterArchiving.elapsedDays,
    });
  });
});

describe("calculateReadingGoalMetrics rounding", () => {
  it("rounds the returned rates without rounding the values the risk rules compare", () => {
    const metrics = calculateMetrics({
      goal: { ...baseGoal, deadline: parseIsoDate("2026-11-29"), targetCount: 77 },
      now: new Date("2026-08-07T12:00:00.000Z"),
      snapshotBooks: snapshotBooks(["2026-08-03", "2026-08-04", "2026-08-05"]),
    });

    expect(metrics.actualBooksPerDay).toBe(0.429);
    expect(metrics.requiredBooksPerDay).toBe(0.643);
    expect(metrics.riskReasons).toContain("required_pace_high");
  });
});

describe("calculateReadingGoalMetrics contract", () => {
  it("returns every metric the shared contract declares and nothing else", () => {
    const metrics = calculateMetrics({});

    expect(ReadingGoalMetricsSchema.parse(metrics)).toStrictEqual(metrics);
    expect(metrics).toStrictEqual({
      actualBooksPerDay: 0.2,
      averageDaysPerBook: 5,
      completedCount: 2,
      daysLeft: 10,
      daysSinceLastCounted: 3,
      elapsedDays: 10,
      elapsedPercent: 50,
      expectedCompletedCount: 2.5,
      lastCountedAt: "2026-08-07",
      pace: "behind",
      paceDeltaBooks: -0.5,
      paceDeltaPercent: -10,
      progressPercent: 40,
      projectedCompletionDate: "2026-08-25",
      projectedDaysDelta: -5,
      projectionConfidence: "medium",
      remainingCount: 3,
      requiredBooksPerDay: 0.273,
      requiredDaysPerBook: 3.7,
      riskLevel: "medium",
      riskReasons: ["behind_schedule"],
      totalDays: 20,
    });
  });

  it("blanks every active-only metric once the goal is archived", () => {
    const metrics = calculateMetrics({
      goal: { ...baseGoal, archivedAt: new Date("2026-08-09T10:00:00.000Z") },
    });

    expect(ReadingGoalMetricsSchema.parse(metrics)).toStrictEqual(metrics);
    expect(metrics).toMatchObject({
      actualBooksPerDay: 0.222,
      averageDaysPerBook: 4.5,
      daysLeft: null,
      daysSinceLastCounted: null,
      elapsedDays: 9,
      pace: null,
      paceDeltaBooks: null,
      paceDeltaPercent: null,
      projectionConfidence: "none",
      requiredBooksPerDay: null,
      requiredDaysPerBook: null,
      riskLevel: "none",
      riskReasons: [],
    });
  });
});
