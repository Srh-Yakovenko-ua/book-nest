import { describe, expect, it } from "vitest";

import { parseIsoDate } from "../../../core/iso-date.js";
import {
  resolveReadingGoalCountingEnd,
  resolveReadingGoalObservationEnd,
  resolveReadingGoalQualificationWindow,
} from "./reading-goal-window.js";

type ObservationEndInput = Parameters<typeof resolveReadingGoalObservationEnd>[0];

const deadline = parseIsoDate("2026-08-20");

const baseInput = {
  archivedDay: null,
  completedAt: null,
  deadline,
  status: "active",
  today: new Date("2026-08-10T18:30:00.000Z"),
} satisfies ObservationEndInput;

function resolveObservationEnd(overrides: Partial<ObservationEndInput>) {
  return resolveReadingGoalObservationEnd({ ...baseInput, ...overrides });
}

describe("resolveReadingGoalCountingEnd", () => {
  it("ends a live goal on its deadline", () => {
    expect(resolveReadingGoalCountingEnd({ archivedDay: null, deadline })).toEqual(
      parseIsoDate("2026-08-20"),
    );
  });

  it("ends an archived goal on the day it was archived", () => {
    expect(
      resolveReadingGoalCountingEnd({
        archivedDay: parseIsoDate("2026-08-10"),
        deadline,
      }),
    ).toEqual(parseIsoDate("2026-08-10"));
  });

  it("keeps the deadline when the goal was archived after it had passed", () => {
    expect(
      resolveReadingGoalCountingEnd({
        archivedDay: parseIsoDate("2026-09-05"),
        deadline,
      }),
    ).toEqual(parseIsoDate("2026-08-20"));
  });

  it("ends on the local archive day of a goal archived late in the evening in Kyiv, a day past its UTC date", () => {
    expect(
      resolveReadingGoalCountingEnd({
        archivedDay: parseIsoDate("2026-11-16"),
        deadline: parseIsoDate("2026-11-20"),
      }),
    ).toEqual(parseIsoDate("2026-11-16"));
  });
});

describe("resolveReadingGoalQualificationWindow", () => {
  it("starts the window on the local creation day and ends a live goal on its deadline", () => {
    expect(
      resolveReadingGoalQualificationWindow({
        archivedDay: null,
        createdDay: parseIsoDate("2026-11-16"),
        deadline: parseIsoDate("2026-11-20"),
      }),
    ).toEqual({
      countingEndsAt: parseIsoDate("2026-11-20"),
      goalStartDate: parseIsoDate("2026-11-16"),
    });
  });

  it("closes the window of an archived goal on its archive day", () => {
    expect(
      resolveReadingGoalQualificationWindow({
        archivedDay: parseIsoDate("2026-11-16"),
        createdDay: parseIsoDate("2026-11-10"),
        deadline: parseIsoDate("2026-11-20"),
      }),
    ).toEqual({
      countingEndsAt: parseIsoDate("2026-11-16"),
      goalStartDate: parseIsoDate("2026-11-10"),
    });
  });
});

describe("resolveReadingGoalObservationEnd", () => {
  it("follows today while the goal is active", () => {
    expect(resolveObservationEnd({})).toEqual(parseIsoDate("2026-08-10"));
  });

  it("never runs past the deadline for an active goal", () => {
    expect(resolveObservationEnd({ today: new Date("2026-09-01T12:00:00.000Z") })).toEqual(
      parseIsoDate("2026-08-20"),
    );
  });

  it("stops on the completion day of a completed goal", () => {
    expect(
      resolveObservationEnd({
        completedAt: new Date("2026-08-05T18:00:00.000Z"),
        status: "completed",
        today: new Date("2026-12-31T12:00:00.000Z"),
      }),
    ).toEqual(parseIsoDate("2026-08-05"));
  });

  it("falls back to the counting end for the completed goal that cannot happen, one without a completion date", () => {
    expect(
      resolveObservationEnd({ status: "completed", today: new Date("2026-12-31T12:00:00.000Z") }),
    ).toEqual(parseIsoDate("2026-08-20"));
  });

  it("stops on the deadline of an expired goal", () => {
    expect(
      resolveObservationEnd({ status: "expired", today: new Date("2026-12-31T12:00:00.000Z") }),
    ).toEqual(parseIsoDate("2026-08-20"));
  });

  it("stops on the archiving day of an archived goal", () => {
    expect(
      resolveObservationEnd({
        archivedDay: parseIsoDate("2026-08-06"),
        status: "archived",
        today: new Date("2026-12-31T12:00:00.000Z"),
      }),
    ).toEqual(parseIsoDate("2026-08-06"));
  });

  it("stops on the deadline of a goal archived after it had passed", () => {
    expect(
      resolveObservationEnd({
        archivedDay: parseIsoDate("2026-09-05"),
        status: "archived",
        today: new Date("2026-12-31T12:00:00.000Z"),
      }),
    ).toEqual(parseIsoDate("2026-08-20"));
  });

  it("stops on the archiving day even when the goal had already met its target", () => {
    expect(
      resolveObservationEnd({
        archivedDay: parseIsoDate("2026-08-06"),
        completedAt: new Date("2026-08-04T09:00:00.000Z"),
        status: "archived",
        today: new Date("2026-12-31T12:00:00.000Z"),
      }),
    ).toEqual(parseIsoDate("2026-08-06"));
  });
});
