import { describe, expect, it } from "vitest";

import { calculateReadingGoalPace } from "./reading-goal-pace.js";

type PaceInput = Parameters<typeof calculateReadingGoalPace>[0];

const goalStartDate = new Date("2026-08-01T09:15:00.000Z");
const deadline = new Date("2026-08-20T00:00:00.000Z");

const baseInput = {
  archivedAt: null,
  completedAt: null,
  completedCount: 0,
  daysLeft: 19,
  deadline,
  goalStartDate,
  now: new Date("2026-08-01T18:00:00.000Z"),
  remainingCount: 5,
  status: "active",
  targetCount: 5,
} satisfies PaceInput;

function calculatePace(overrides: Partial<PaceInput>) {
  return calculateReadingGoalPace({ ...baseInput, ...overrides });
}

describe("calculateReadingGoalPace schedule window", () => {
  it("counts both the start day and the deadline day in totalDays", () => {
    expect(calculatePace({}).totalDays).toBe(20);
  });

  it("reports a single-day goal as one total day", () => {
    expect(
      calculatePace({ daysLeft: 0, deadline: new Date("2026-08-01T00:00:00.000Z") }).totalDays,
    ).toBe(1);
  });

  it("floors totalDays at one when the deadline precedes the goal start", () => {
    expect(
      calculatePace({ deadline: new Date("2026-07-25T00:00:00.000Z"), status: "expired" })
        .totalDays,
    ).toBe(1);
  });

  it("counts the goal start day itself as one elapsed day regardless of the time of day", () => {
    expect(calculatePace({}).elapsedDays).toBe(1);
  });

  it("clamps elapsedDays at totalDays once the deadline has passed", () => {
    const metrics = calculatePace({
      completedCount: 2,
      daysLeft: null,
      now: new Date("2026-09-01T12:00:00.000Z"),
      remainingCount: 3,
      status: "expired",
    });

    expect(metrics.elapsedDays).toBe(20);
    expect(metrics.elapsedPercent).toBe(100);
  });

  it("freezes the elapsed window on the completion day, so a finished goal reads the same on any later day", () => {
    const finishedInput = {
      completedAt: new Date("2026-08-05T18:00:00.000Z"),
      completedCount: 5,
      daysLeft: null,
      remainingCount: 0,
      status: "completed",
    } as const;
    const onCompletionDay = calculatePace({
      ...finishedInput,
      now: new Date("2026-08-05T20:00:00.000Z"),
    });
    const twoWeeksLater = calculatePace({
      ...finishedInput,
      now: new Date("2026-08-19T20:00:00.000Z"),
    });

    expect(onCompletionDay.elapsedDays).toBe(5);
    expect(twoWeeksLater.elapsedDays).toBe(5);
  });

  it("freezes the elapsed window on the archiving day of an archived goal", () => {
    const archivedInput = {
      archivedAt: new Date("2026-08-06T09:00:00.000Z"),
      completedCount: 2,
      daysLeft: null,
      remainingCount: 3,
      status: "archived",
    } as const;
    const dayAfterArchiving = calculatePace({
      ...archivedInput,
      now: new Date("2026-08-07T09:00:00.000Z"),
    });
    const monthsLater = calculatePace({
      ...archivedInput,
      now: new Date("2026-11-07T09:00:00.000Z"),
    });

    expect(dayAfterArchiving.elapsedDays).toBe(6);
    expect(monthsLater.elapsedDays).toBe(6);
  });

  it("freezes the elapsed window on the deadline of an expired goal", () => {
    const expiredInput = {
      completedCount: 2,
      daysLeft: null,
      remainingCount: 3,
      status: "expired",
    } as const;
    const dayAfterTheDeadline = calculatePace({
      ...expiredInput,
      now: new Date("2026-08-21T09:00:00.000Z"),
    });
    const monthsLater = calculatePace({
      ...expiredInput,
      now: new Date("2026-11-21T09:00:00.000Z"),
    });

    expect(dayAfterTheDeadline.elapsedDays).toBe(20);
    expect(monthsLater.elapsedDays).toBe(20);
  });

  it("derives elapsedDays from the UTC day boundary rather than the moment of day", () => {
    const earlyMorning = calculatePace({ now: new Date("2026-08-10T00:00:01.000Z") });
    const lateEvening = calculatePace({ now: new Date("2026-08-10T23:59:59.000Z") });

    expect(earlyMorning.elapsedDays).toBe(lateEvening.elapsedDays);
  });
});

describe("calculateReadingGoalPace classification", () => {
  it("is on_track on the first day of the goal", () => {
    const metrics = calculatePace({});

    expect(metrics).toStrictEqual({
      elapsedDays: 1,
      elapsedPercent: 5,
      expectedCompletedCount: 0.25,
      pace: "on_track",
      paceDeltaBooks: -0.25,
      paceDeltaPercent: -5,
      progressPercent: 0,
      totalDays: 20,
    });
  });

  it("is on_track when the counted books match the expected books exactly", () => {
    const metrics = calculatePace({
      completedCount: 5,
      daysLeft: 10,
      now: new Date("2026-08-10T08:00:00.000Z"),
      remainingCount: 5,
      targetCount: 10,
    });

    expect(metrics.pace).toBe("on_track");
    expect(metrics.expectedCompletedCount).toBe(5);
    expect(metrics.paceDeltaBooks).toBe(0);
    expect(metrics.paceDeltaPercent).toBe(0);
  });

  it("is ahead when one book more than expected has been counted", () => {
    const metrics = calculatePace({
      completedCount: 6,
      daysLeft: 10,
      now: new Date("2026-08-10T08:00:00.000Z"),
      remainingCount: 4,
      targetCount: 10,
    });

    expect(metrics.pace).toBe("ahead");
    expect(metrics.paceDeltaBooks).toBe(1);
    expect(metrics.paceDeltaPercent).toBe(10);
  });

  it("is behind when one book fewer than expected has been counted", () => {
    const metrics = calculatePace({
      completedCount: 4,
      daysLeft: 10,
      now: new Date("2026-08-10T08:00:00.000Z"),
      remainingCount: 6,
      targetCount: 10,
    });

    expect(metrics.pace).toBe("behind");
    expect(metrics.paceDeltaBooks).toBe(-1);
    expect(metrics.paceDeltaPercent).toBe(-10);
  });

  it("is critical when most of the time is gone and progress trails it by twenty points", () => {
    const metrics = calculatePace({
      completedCount: 4,
      daysLeft: 16,
      goalStartDate: new Date("2026-06-01T07:00:00.000Z"),
      now: new Date("2026-08-04T08:00:00.000Z"),
      remainingCount: 6,
      targetCount: 10,
    });

    expect(metrics.elapsedPercent).toBe(80.2);
    expect(metrics.progressPercent).toBe(40);
    expect(metrics.pace).toBe("critical");
  });

  it("is critical when the deadline is a week away with two books still owed, even while ahead of plan", () => {
    const metrics = calculatePace({
      completedCount: 8,
      daysLeft: 7,
      now: new Date("2026-08-13T08:00:00.000Z"),
      remainingCount: 2,
      targetCount: 10,
    });

    expect(metrics.paceDeltaBooks).toBe(1.5);
    expect(metrics.pace).toBe("critical");
  });

  it("stays out of critical when only one book is left in the final week", () => {
    const metrics = calculatePace({
      completedCount: 9,
      daysLeft: 7,
      now: new Date("2026-08-13T08:00:00.000Z"),
      remainingCount: 1,
      targetCount: 10,
    });

    expect(metrics.pace).toBe("ahead");
  });

  it.each([
    {
      archivedAt: new Date("2026-08-10T08:00:00.000Z"),
      completedAt: null,
      elapsedDays: 10,
      status: "archived",
    },
    {
      archivedAt: null,
      completedAt: new Date("2026-08-10T08:00:00.000Z"),
      elapsedDays: 10,
      status: "completed",
    },
    { archivedAt: null, completedAt: null, elapsedDays: 20, status: "expired" },
  ] as const)(
    "reports no pace for a $status goal and stops its window at $elapsedDays days",
    ({ archivedAt, completedAt, elapsedDays, status }) => {
      const metrics = calculatePace({
        archivedAt,
        completedAt,
        completedCount: 4,
        daysLeft: null,
        now: new Date("2026-08-25T08:00:00.000Z"),
        remainingCount: 6,
        status,
        targetCount: 10,
      });

      expect(metrics.pace).toBeNull();
      expect(metrics.paceDeltaBooks).toBeNull();
      expect(metrics.paceDeltaPercent).toBeNull();
      expect(metrics.elapsedDays).toBe(elapsedDays);
      expect(metrics.progressPercent).toBe(40);
    },
  );
});

describe("calculateReadingGoalPace critical threshold", () => {
  const longWindow = {
    daysLeft: 20,
    deadline: new Date("2026-11-08T00:00:00.000Z"),
    now: new Date("2026-10-19T08:00:00.000Z"),
    targetCount: 1000,
  } as const;

  it("turns critical exactly at a twenty point gap between elapsed and progress", () => {
    const metrics = calculatePace({ ...longWindow, completedCount: 600, remainingCount: 400 });

    expect(metrics.elapsedPercent).toBe(80);
    expect(metrics.progressPercent).toBe(60);
    expect(metrics.pace).toBe("critical");
  });

  it("stays out of critical one tenth of a point short of that gap", () => {
    const metrics = calculatePace({ ...longWindow, completedCount: 601, remainingCount: 399 });

    expect(metrics.elapsedPercent).toBe(80);
    expect(metrics.progressPercent).toBe(60.1);
    expect(metrics.pace).toBe("behind");
  });
});

describe("calculateReadingGoalPace rounding", () => {
  it("classifies against the unrounded expectation, so a half-book expectation still reads as ahead", () => {
    const metrics = calculatePace({
      completedCount: 4,
      daysLeft: 13,
      now: new Date("2026-08-07T08:00:00.000Z"),
      remainingCount: 6,
      targetCount: 10,
    });

    expect(metrics.expectedCompletedCount).toBe(3.5);
    expect(metrics.paceDeltaBooks).toBe(0.5);
    expect(metrics.pace).toBe("ahead");
  });

  it("keeps expectedCompletedCount at two decimals and elapsedPercent at one", () => {
    const metrics = calculatePace({
      completedCount: 4,
      daysLeft: 16,
      goalStartDate: new Date("2026-06-01T07:00:00.000Z"),
      now: new Date("2026-08-04T08:00:00.000Z"),
      remainingCount: 6,
      targetCount: 10,
    });

    expect(metrics.expectedCompletedCount).toBe(8.02);
    expect(metrics.elapsedPercent).toBe(80.2);
    expect(metrics.paceDeltaBooks).toBe(-4.02);
    expect(metrics.paceDeltaPercent).toBe(-40.2);
  });

  it("caps progressPercent at one hundred when more books than the target were counted", () => {
    const metrics = calculatePace({
      completedCount: 12,
      daysLeft: null,
      now: new Date("2026-08-10T08:00:00.000Z"),
      remainingCount: 0,
      status: "completed",
      targetCount: 10,
    });

    expect(metrics.progressPercent).toBe(100);
  });

  it("keeps elapsedPercent inside zero and one hundred for a goal read long after its deadline", () => {
    const metrics = calculatePace({
      completedCount: 1,
      daysLeft: null,
      now: new Date("2027-01-01T08:00:00.000Z"),
      remainingCount: 4,
      status: "expired",
    });

    expect(metrics.elapsedPercent).toBe(100);
  });
});
