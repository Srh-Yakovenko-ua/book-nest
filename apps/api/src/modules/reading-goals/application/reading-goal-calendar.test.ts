import { describe, expect, it } from "vitest";

import { toReadingGoalCalculationGoal } from "./reading-goal-calendar.js";

const liveGoal = {
  archivedAt: null,
  createdAt: new Date("2026-11-15T22:30:00.000Z"),
  deadline: new Date("2026-11-30T00:00:00.000Z"),
  targetCount: 4,
};

const goalArchivedLateEveningInKyiv = {
  archivedAt: new Date("2026-11-15T23:30:00.000Z"),
  createdAt: new Date("2026-11-01T09:00:00.000Z"),
  deadline: new Date("2026-11-30T00:00:00.000Z"),
  targetCount: 4,
};

describe("toReadingGoalCalculationGoal", () => {
  it("dates a goal created at 22:30Z on the next local day in Kyiv", () => {
    const { createdDay } = toReadingGoalCalculationGoal({
      goal: liveGoal,
      timeZone: "Europe/Kyiv",
    });

    expect(createdDay).toEqual(new Date("2026-11-16T00:00:00.000Z"));
  });

  it("dates the same creation instant on its own UTC day in UTC", () => {
    const { createdDay } = toReadingGoalCalculationGoal({ goal: liveGoal, timeZone: "UTC" });

    expect(createdDay).toEqual(new Date("2026-11-15T00:00:00.000Z"));
  });

  it("dates a goal archived at 23:30Z on the next local day in Kyiv", () => {
    const { archivedDay } = toReadingGoalCalculationGoal({
      goal: goalArchivedLateEveningInKyiv,
      timeZone: "Europe/Kyiv",
    });

    expect(archivedDay).toEqual(new Date("2026-11-16T00:00:00.000Z"));
  });

  it("leaves archivedDay null for a goal that was never archived", () => {
    const { archivedDay } = toReadingGoalCalculationGoal({
      goal: liveGoal,
      timeZone: "Europe/Kyiv",
    });

    expect(archivedDay).toBeNull();
  });

  it("carries the deadline and target count through unchanged", () => {
    expect(
      toReadingGoalCalculationGoal({
        goal: goalArchivedLateEveningInKyiv,
        timeZone: "Europe/Kyiv",
      }),
    ).toMatchObject({
      deadline: new Date("2026-11-30T00:00:00.000Z"),
      targetCount: 4,
    });
  });
});
