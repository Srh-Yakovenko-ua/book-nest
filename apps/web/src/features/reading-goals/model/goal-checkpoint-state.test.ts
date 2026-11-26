import type { ReadingGoalCheckpoint } from "@app/shared";

import { describe, expect, it } from "vitest";

import { resolveGoalCheckpointState } from "./goal-checkpoint-state";

function makeCheckpoint(overrides: Partial<ReadingGoalCheckpoint>): ReadingGoalCheckpoint {
  return {
    achievedAt: null,
    currentCompletedCount: 0,
    dueDate: "2026-11-03",
    status: "upcoming",
    targetCount: 4,
    ...overrides,
  };
}

describe("resolveGoalCheckpointState", () => {
  it("marks a checkpoint reached before its due date as achieved", () => {
    const checkpoint = makeCheckpoint({
      achievedAt: "2026-10-28",
      currentCompletedCount: 4,
      status: "achieved",
    });

    expect(resolveGoalCheckpointState(checkpoint)).toEqual({
      achievedAt: "2026-10-28",
      kind: "achieved",
    });
  });

  it("counts a checkpoint reached on the due day itself as achieved on time", () => {
    const checkpoint = makeCheckpoint({
      achievedAt: "2026-11-03",
      currentCompletedCount: 4,
      status: "achieved",
    });

    expect(resolveGoalCheckpointState(checkpoint)).toEqual({
      achievedAt: "2026-11-03",
      kind: "achieved",
    });
  });

  it("shows a checkpoint the API reports as missed but reached later as achieved late", () => {
    const checkpoint = makeCheckpoint({
      achievedAt: "2026-11-23",
      currentCompletedCount: 4,
      status: "missed",
    });

    expect(resolveGoalCheckpointState(checkpoint)).toEqual({
      achievedAt: "2026-11-23",
      kind: "achieved_late",
      lateDays: 20,
    });
  });

  it.each([
    {
      achievedAt: "2026-11-04",
      behavior: "counts one late day for a checkpoint reached the day after it was due",
      dueDate: "2026-11-03",
      lateDays: 1,
    },
    {
      achievedAt: "2027-01-02",
      behavior: "counts late calendar days across a year boundary",
      dueDate: "2026-12-30",
      lateDays: 3,
    },
  ])("$behavior", ({ achievedAt, dueDate, lateDays }) => {
    const checkpoint = makeCheckpoint({
      achievedAt,
      currentCompletedCount: 4,
      dueDate,
      status: "missed",
    });

    expect(resolveGoalCheckpointState(checkpoint)).toEqual({
      achievedAt,
      kind: "achieved_late",
      lateDays,
    });
  });

  it("keeps an unreached checkpoint the API reports as missed as missed", () => {
    const checkpoint = makeCheckpoint({ currentCompletedCount: 2, status: "missed" });

    expect(resolveGoalCheckpointState(checkpoint)).toEqual({ kind: "missed" });
  });

  it.each(["upcoming", "achieved"] as const)(
    "treats a checkpoint with status %s and no achievement date as upcoming",
    (status) => {
      const checkpoint = makeCheckpoint({ currentCompletedCount: 1, status });

      expect(resolveGoalCheckpointState(checkpoint)).toEqual({ kind: "upcoming" });
    },
  );
});
