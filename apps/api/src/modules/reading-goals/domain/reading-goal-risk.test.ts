import { describe, expect, it } from "vitest";

import { calculateReadingGoalRisk } from "./reading-goal-risk.js";

type RiskInput = Parameters<typeof calculateReadingGoalRisk>[0];

const baseInput = {
  actualBooksPerDay: 0.5,
  daysLeft: 20,
  daysSinceLastCounted: 1,
  elapsedDays: 10,
  elapsedPercent: 50,
  pace: "on_track",
  projectedDaysDelta: 10,
  remainingCount: 5,
  requiredBooksPerDay: 0.25,
  status: "active",
} satisfies RiskInput;

function calculateRisk(overrides: Partial<RiskInput>) {
  return calculateReadingGoalRisk({ ...baseInput, ...overrides });
}

describe("calculateReadingGoalRisk reasons", () => {
  it("reports no reason for a goal that is on plan with room to spare", () => {
    expect(calculateRisk({})).toStrictEqual({ riskLevel: "none", riskReasons: [] });
  });

  it("reports behind_schedule exactly when the pace is behind", () => {
    expect(calculateRisk({ pace: "behind" }).riskReasons).toEqual(["behind_schedule"]);
  });

  it("does not report behind_schedule for a critical pace", () => {
    expect(calculateRisk({ pace: "critical" }).riskReasons).toEqual([]);
  });

  it("reports deadline_soon within the final week while books are still owed", () => {
    expect(calculateRisk({ daysLeft: 7 }).riskReasons).toEqual(["deadline_soon"]);
  });

  it("drops deadline_soon once no book is owed", () => {
    expect(calculateRisk({ daysLeft: 2, remainingCount: 0 }).riskReasons).toEqual([]);
  });

  it("reports no_recent_progress after two idle weeks on a two-week-old goal", () => {
    expect(calculateRisk({ daysSinceLastCounted: 14, elapsedDays: 14 }).riskReasons).toEqual([
      "no_recent_progress",
    ]);
  });

  it("keeps no_recent_progress away from a goal younger than two weeks", () => {
    expect(calculateRisk({ daysSinceLastCounted: 13, elapsedDays: 13 }).riskReasons).toEqual([]);
  });

  it("holds the goal-age condition on its own, so a young goal with a long idle count stays clear", () => {
    expect(calculateRisk({ daysSinceLastCounted: 20, elapsedDays: 10 }).riskReasons).toEqual([]);
  });

  it("reports required_pace_high when the required rate outruns the observed rate by half again", () => {
    expect(calculateRisk({ requiredBooksPerDay: 0.75 }).riskReasons).toEqual([
      "required_pace_high",
    ]);
  });

  it("keeps required_pace_high away while the required rate is still within reach", () => {
    expect(calculateRisk({ requiredBooksPerDay: 0.74 }).riskReasons).toEqual([]);
  });

  it("reports required_pace_high on an untouched goal once half its time is gone", () => {
    expect(
      calculateRisk({
        actualBooksPerDay: 0,
        elapsedPercent: 50,
        requiredBooksPerDay: 0.1,
      }).riskReasons,
    ).toEqual(["required_pace_high"]);
  });

  it("keeps required_pace_high away from an expired goal that was never started", () => {
    expect(
      calculateRisk({
        actualBooksPerDay: 0,
        daysLeft: null,
        daysSinceLastCounted: null,
        elapsedPercent: 100,
        pace: null,
        projectedDaysDelta: null,
        requiredBooksPerDay: null,
        status: "expired",
      }),
    ).toStrictEqual({ riskLevel: "none", riskReasons: [] });
  });

  it.each(["archived", "completed", "expired"] as const)(
    "leaves a %s goal free of every reason even on the worst inputs",
    (status) => {
      expect(
        calculateRisk({
          actualBooksPerDay: 0,
          daysLeft: 0,
          daysSinceLastCounted: 400,
          elapsedDays: 400,
          elapsedPercent: 100,
          pace: null,
          projectedDaysDelta: null,
          remainingCount: 5,
          requiredBooksPerDay: 10,
          status,
        }),
      ).toStrictEqual({ riskLevel: "none", riskReasons: [] });
    },
  );

  it("reports no reason for a finished goal", () => {
    expect(
      calculateRisk({
        daysLeft: null,
        daysSinceLastCounted: null,
        pace: null,
        projectedDaysDelta: 2,
        remainingCount: 0,
        requiredBooksPerDay: null,
        status: "completed",
      }),
    ).toStrictEqual({ riskLevel: "none", riskReasons: [] });
  });

  it("lists every reason in the order the shared enum declares them", () => {
    expect(
      calculateRisk({
        daysLeft: 3,
        daysSinceLastCounted: 20,
        elapsedDays: 20,
        pace: "behind",
        requiredBooksPerDay: 2,
      }).riskReasons,
    ).toEqual(["behind_schedule", "deadline_soon", "no_recent_progress", "required_pace_high"]);
  });
});

describe("calculateReadingGoalRisk level", () => {
  it("is critical when the pace is critical even without a single reason", () => {
    expect(calculateRisk({ pace: "critical" })).toStrictEqual({
      riskLevel: "critical",
      riskReasons: [],
    });
  });

  it("is critical when a nearing deadline meets a goal already behind", () => {
    const risk = calculateRisk({ daysLeft: 5, pace: "behind" });

    expect(risk.riskReasons).toEqual(["behind_schedule", "deadline_soon"]);
    expect(risk.riskLevel).toBe("critical");
  });

  it("is high for two reasons that do not form the critical pair", () => {
    const risk = calculateRisk({ pace: "behind", requiredBooksPerDay: 2 });

    expect(risk.riskReasons).toEqual(["behind_schedule", "required_pace_high"]);
    expect(risk.riskLevel).toBe("high");
  });

  it("is high for three reasons without behind_schedule", () => {
    const risk = calculateRisk({
      daysLeft: 3,
      daysSinceLastCounted: 20,
      elapsedDays: 20,
      requiredBooksPerDay: 2,
    });

    expect(risk.riskReasons).toEqual(["deadline_soon", "no_recent_progress", "required_pace_high"]);
    expect(risk.riskLevel).toBe("high");
  });

  it("is medium for a single reason", () => {
    expect(calculateRisk({ pace: "behind" }).riskLevel).toBe("medium");
  });

  it.each([0, 3])(
    "is low for an on-track goal projected to land %i days before the deadline",
    (projectedDaysDelta) => {
      expect(calculateRisk({ projectedDaysDelta }).riskLevel).toBe("low");
    },
  );

  it("withholds low from a finished goal, the pace of which the calculator never reports as on_track", () => {
    expect(
      calculateRisk({ projectedDaysDelta: 2, remainingCount: 0, status: "completed" }).riskLevel,
    ).toBe("none");
  });

  it("is none when the projection lands comfortably before the deadline", () => {
    expect(calculateRisk({ projectedDaysDelta: 4 }).riskLevel).toBe("none");
  });

  it("is none when the projection overshoots the deadline but nothing else is wrong", () => {
    expect(calculateRisk({ projectedDaysDelta: -1 }).riskLevel).toBe("none");
  });

  it("is none when there is no projection to lean on", () => {
    expect(calculateRisk({ projectedDaysDelta: null }).riskLevel).toBe("none");
  });
});
