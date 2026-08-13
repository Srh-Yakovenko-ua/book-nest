import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { calculateReadingGoalProjection } from "./reading-goal-projection.js";

type ProjectionInput = Parameters<typeof calculateReadingGoalProjection>[0];

const deadline = new Date("2026-08-31T00:00:00.000Z");

const baseInput = {
  completedAt: null,
  completedCount: 0,
  deadline,
  elapsedDays: 10,
  now: new Date("2026-08-11T12:00:00.000Z"),
  remainingCount: 5,
  status: "active",
} satisfies ProjectionInput;

function calculateProjection(overrides: Partial<ProjectionInput>) {
  return calculateReadingGoalProjection({ ...baseInput, ...overrides });
}

describe("calculateReadingGoalProjection confidence", () => {
  it("refuses to invent a projection for an active goal with nothing counted", () => {
    expect(calculateProjection({})).toStrictEqual({
      actualBooksPerDay: 0,
      projectedCompletionDate: null,
      projectedDaysDelta: null,
      projectionConfidence: "none",
    });
  });

  it("reports low confidence off a single counted book", () => {
    const projection = calculateProjection({ completedCount: 1, remainingCount: 4 });

    expect(projection.projectionConfidence).toBe("low");
    expect(projection.actualBooksPerDay).toBe(0.1);
  });

  it.each([2, 3])("reports medium confidence off %i counted books", (completedCount) => {
    const projection = calculateProjection({
      completedCount,
      remainingCount: 5 - completedCount,
    });

    expect(projection.projectionConfidence).toBe("medium");
  });

  it("reports high confidence once four books are counted", () => {
    const projection = calculateProjection({ completedCount: 4, remainingCount: 1 });

    expect(projection.projectionConfidence).toBe("high");
  });
});

describe("calculateReadingGoalProjection active goal", () => {
  it("projects an early completion as a positive day delta", () => {
    const projection = calculateProjection({ completedCount: 4, remainingCount: 1 });

    expect(projection.projectedCompletionDate).toEqual(new Date("2026-08-14T00:00:00.000Z"));
    expect(projection.projectedDaysDelta).toBe(17);
  });

  it("projects a late completion as a negative day delta", () => {
    const projection = calculateProjection({ completedCount: 1, remainingCount: 4 });

    expect(projection.projectedCompletionDate).toEqual(new Date("2026-09-20T00:00:00.000Z"));
    expect(projection.projectedDaysDelta).toBe(-20);
  });

  it("projects the deadline day itself as a zero delta", () => {
    const projection = calculateProjection({ completedCount: 2, remainingCount: 4 });

    expect(projection.projectedCompletionDate).toEqual(deadline);
    expect(projection.projectedDaysDelta).toBe(0);
  });

  it("keeps the observed rate honest instead of losing a day to floating point", () => {
    const projection = calculateProjection({
      completedCount: 1,
      elapsedDays: 49,
      now: new Date("2026-08-18T21:00:00.000Z"),
      remainingCount: 1,
    });

    expect(projection.projectedCompletionDate).toEqual(new Date("2026-10-06T00:00:00.000Z"));
  });

  it("treats a goal on its first day as a full day of observation", () => {
    const projection = calculateProjection({
      completedCount: 1,
      elapsedDays: 0,
      remainingCount: 1,
    });

    expect(projection.actualBooksPerDay).toBe(1);
    expect(projection.projectedCompletionDate).toEqual(new Date("2026-08-12T00:00:00.000Z"));
  });

  it("projects from the UTC day boundary rather than the moment of day", () => {
    const earlyMorning = calculateProjection({
      completedCount: 2,
      now: new Date("2026-08-11T00:00:01.000Z"),
      remainingCount: 3,
    });
    const lateEvening = calculateProjection({
      completedCount: 2,
      now: new Date("2026-08-11T23:59:59.000Z"),
      remainingCount: 3,
    });

    expect(earlyMorning.projectedCompletionDate).toEqual(lateEvening.projectedCompletionDate);
  });
});

describe("calculateReadingGoalProjection across a daylight saving change", () => {
  const originalTimeZone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "Europe/Kyiv";
  });

  afterAll(() => {
    process.env.TZ = originalTimeZone;
  });

  it.each([
    {
      expectedDelta: 144,
      expectedIsoDate: "2026-04-09",
      now: new Date("2026-03-20T12:00:00.000Z"),
      remainingCount: 2,
    },
    {
      expectedDelta: 149,
      expectedIsoDate: "2026-04-04",
      now: new Date("2026-03-25T12:00:00.000Z"),
      remainingCount: 1,
    },
  ])(
    "lands on $expectedIsoDate when the projection window crosses the spring transition",
    ({ expectedDelta, expectedIsoDate, now, remainingCount }) => {
      const projection = calculateProjection({ completedCount: 1, now, remainingCount });

      expect(projection.projectedCompletionDate).toEqual(
        new Date(`${expectedIsoDate}T00:00:00.000Z`),
      );
      expect(projection.projectedDaysDelta).toBe(expectedDelta);
    },
  );
});

describe("calculateReadingGoalProjection finished goal", () => {
  it("reports the actual completion day for a completed goal", () => {
    const projection = calculateProjection({
      completedAt: new Date("2026-08-25T18:30:00.000Z"),
      completedCount: 5,
      remainingCount: 0,
      status: "completed",
    });

    expect(projection).toStrictEqual({
      actualBooksPerDay: 0.5,
      projectedCompletionDate: new Date("2026-08-25T00:00:00.000Z"),
      projectedDaysDelta: 6,
      projectionConfidence: "high",
    });
  });

  it("reports the actual completion day for an archived goal that met its target", () => {
    const projection = calculateProjection({
      completedAt: new Date("2026-08-25T18:30:00.000Z"),
      completedCount: 5,
      remainingCount: 0,
      status: "archived",
    });

    expect(projection.projectedCompletionDate).toEqual(new Date("2026-08-25T00:00:00.000Z"));
    expect(projection.projectionConfidence).toBe("high");
  });

  it("projects nothing for an expired goal that never met its target", () => {
    const projection = calculateProjection({
      completedCount: 2,
      elapsedDays: 20,
      now: new Date("2026-09-05T12:00:00.000Z"),
      remainingCount: 3,
      status: "expired",
    });

    expect(projection.projectedCompletionDate).toBeNull();
    expect(projection.projectedDaysDelta).toBeNull();
    expect(projection.projectionConfidence).toBe("none");
  });

  it("projects nothing for an archived goal that was left unfinished", () => {
    const projection = calculateProjection({
      completedCount: 2,
      remainingCount: 3,
      status: "archived",
    });

    expect(projection.projectedCompletionDate).toBeNull();
    expect(projection.projectedDaysDelta).toBeNull();
    expect(projection.projectionConfidence).toBe("none");
  });
});
