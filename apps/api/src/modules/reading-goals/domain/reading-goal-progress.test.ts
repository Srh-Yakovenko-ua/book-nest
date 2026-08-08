import { describe, expect, it } from "vitest";

import { calculateReadingGoalProgress, resolveReadingGoalStatus } from "./reading-goal-progress.js";

const now = new Date("2026-08-08T18:30:00.000Z");

describe("resolveReadingGoalStatus", () => {
  it("is active while the target is unmet and the deadline is still ahead", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: null,
        completedCount: 1,
        deadline: new Date("2026-08-20T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("active");
  });

  it("is active when the deadline falls exactly on the current UTC day", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: null,
        completedCount: 1,
        deadline: new Date("2026-08-08T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("active");
  });

  it("is completed once the counted books exactly meet the target", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: null,
        completedCount: 3,
        deadline: new Date("2026-08-20T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("completed");
  });

  it("is expired when the deadline is before the current UTC day and the target is unmet", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: null,
        completedCount: 2,
        deadline: new Date("2026-08-07T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("expired");
  });

  it("is archived when archivedAt is set", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: new Date("2026-08-05T09:00:00.000Z"),
        completedCount: 1,
        deadline: new Date("2026-08-20T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("archived");
  });

  it("prefers completed over expired when the target was met after the deadline passed", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: null,
        completedCount: 3,
        deadline: new Date("2026-08-01T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("completed");
  });

  it("prefers archived over completed when an archived goal has met its target", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: new Date("2026-08-05T09:00:00.000Z"),
        completedCount: 4,
        deadline: new Date("2026-08-20T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("archived");
  });

  it("prefers archived over expired when an archived goal is past its deadline", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: new Date("2026-08-05T09:00:00.000Z"),
        completedCount: 0,
        deadline: new Date("2026-08-01T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("archived");
  });
});

describe("calculateReadingGoalProgress", () => {
  it("reports completedAt as the finish date of the target-th book, not the last one", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      finishedDates: [
        new Date("2026-08-01T10:00:00.000Z"),
        new Date("2026-08-02T10:00:00.000Z"),
        new Date("2026-08-03T10:00:00.000Z"),
        new Date("2026-08-04T10:00:00.000Z"),
        new Date("2026-08-05T10:00:00.000Z"),
      ],
      now,
      targetCount: 3,
    });

    expect(progress.completedAt).toEqual(new Date("2026-08-03T10:00:00.000Z"));
  });

  it("leaves completedAt null while fewer books than the target are counted", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      finishedDates: [new Date("2026-08-01T10:00:00.000Z")],
      now,
      targetCount: 3,
    });

    expect(progress.completedAt).toBeNull();
  });

  it("counts only the books handed to it, so a book finished before the cutoff never lands in completedCount", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      finishedDates: [new Date("2026-08-08T09:00:00.000Z")],
      now,
      targetCount: 3,
    });

    expect(progress.completedCount).toBe(1);
  });

  it("returns remainingCount zero rather than a negative number when the target is exceeded", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      finishedDates: [
        new Date("2026-08-01T10:00:00.000Z"),
        new Date("2026-08-02T10:00:00.000Z"),
        new Date("2026-08-03T10:00:00.000Z"),
        new Date("2026-08-04T10:00:00.000Z"),
      ],
      now,
      targetCount: 2,
    });

    expect(progress.remainingCount).toBe(0);
  });

  it("counts the books still owed while the goal is active", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      finishedDates: [new Date("2026-08-01T10:00:00.000Z")],
      now,
      targetCount: 4,
    });

    expect(progress.remainingCount).toBe(3);
  });

  it("reports daysLeft as zero when the deadline is the current UTC day", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      deadline: new Date("2026-08-08T00:00:00.000Z"),
      finishedDates: [],
      now,
      targetCount: 3,
    });

    expect(progress.daysLeft).toBe(0);
  });

  it("reports a negative daysLeft for an expired goal", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      deadline: new Date("2026-08-05T00:00:00.000Z"),
      finishedDates: [],
      now,
      targetCount: 3,
    });

    expect(progress.status).toBe("expired");
    expect(progress.daysLeft).toBe(-3);
  });

  it("stops counting daysLeft once the goal is completed", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      finishedDates: [new Date("2026-08-01T10:00:00.000Z"), new Date("2026-08-02T10:00:00.000Z")],
      now,
      targetCount: 2,
    });

    expect(progress.status).toBe("completed");
    expect(progress.daysLeft).toBeNull();
  });

  it("stops counting daysLeft once the goal is archived", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: new Date("2026-08-06T12:00:00.000Z"),
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      finishedDates: [],
      now,
      targetCount: 3,
    });

    expect(progress.status).toBe("archived");
    expect(progress.daysLeft).toBeNull();
  });

  it("derives daysLeft from the UTC day boundary rather than the moment of day", () => {
    const earlyMorning = calculateReadingGoalProgress({
      archivedAt: null,
      deadline: new Date("2026-08-12T00:00:00.000Z"),
      finishedDates: [],
      now: new Date("2026-08-08T00:00:01.000Z"),
      targetCount: 3,
    });
    const lateEvening = calculateReadingGoalProgress({
      archivedAt: null,
      deadline: new Date("2026-08-12T00:00:00.000Z"),
      finishedDates: [],
      now: new Date("2026-08-08T23:59:59.000Z"),
      targetCount: 3,
    });

    expect(earlyMorning.daysLeft).toBe(lateEvening.daysLeft);
  });
});
