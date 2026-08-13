import { describe, expect, it } from "vitest";

import { parseIsoDate } from "../../../core/iso-date.js";
import {
  resolveReadingGoalCountingEnd,
  resolveReadingGoalObservationEnd,
} from "./reading-goal-window.js";

type ObservationEndInput = Parameters<typeof resolveReadingGoalObservationEnd>[0];

const deadline = parseIsoDate("2026-08-20");

const baseInput = {
  archivedAt: null,
  completedAt: null,
  deadline,
  now: new Date("2026-08-10T18:30:00.000Z"),
  status: "active",
} satisfies ObservationEndInput;

function resolveObservationEnd(overrides: Partial<ObservationEndInput>) {
  return resolveReadingGoalObservationEnd({ ...baseInput, ...overrides });
}

describe("resolveReadingGoalCountingEnd", () => {
  it("ends a live goal on its deadline", () => {
    expect(resolveReadingGoalCountingEnd({ archivedAt: null, deadline })).toEqual(
      parseIsoDate("2026-08-20"),
    );
  });

  it("ends an archived goal on the day it was archived", () => {
    expect(
      resolveReadingGoalCountingEnd({
        archivedAt: new Date("2026-08-10T09:00:00.000Z"),
        deadline,
      }),
    ).toEqual(parseIsoDate("2026-08-10"));
  });

  it("keeps the deadline when the goal was archived after it had passed", () => {
    expect(
      resolveReadingGoalCountingEnd({
        archivedAt: new Date("2026-09-05T09:00:00.000Z"),
        deadline,
      }),
    ).toEqual(parseIsoDate("2026-08-20"));
  });

  it("snaps to the UTC day rather than the moment of archiving", () => {
    expect(
      resolveReadingGoalCountingEnd({
        archivedAt: new Date("2026-08-10T23:59:59.000Z"),
        deadline,
      }),
    ).toEqual(parseIsoDate("2026-08-10"));
  });
});

describe("resolveReadingGoalObservationEnd", () => {
  it("follows today while the goal is active", () => {
    expect(resolveObservationEnd({})).toEqual(parseIsoDate("2026-08-10"));
  });

  it("never runs past the deadline for an active goal", () => {
    expect(resolveObservationEnd({ now: new Date("2026-09-01T12:00:00.000Z") })).toEqual(
      parseIsoDate("2026-08-20"),
    );
  });

  it("stops on the completion day of a completed goal", () => {
    expect(
      resolveObservationEnd({
        completedAt: new Date("2026-08-05T18:00:00.000Z"),
        now: new Date("2026-12-31T12:00:00.000Z"),
        status: "completed",
      }),
    ).toEqual(parseIsoDate("2026-08-05"));
  });

  it("falls back to the counting end for the completed goal that cannot happen, one without a completion date", () => {
    expect(
      resolveObservationEnd({ now: new Date("2026-12-31T12:00:00.000Z"), status: "completed" }),
    ).toEqual(parseIsoDate("2026-08-20"));
  });

  it("stops on the deadline of an expired goal", () => {
    expect(
      resolveObservationEnd({ now: new Date("2026-12-31T12:00:00.000Z"), status: "expired" }),
    ).toEqual(parseIsoDate("2026-08-20"));
  });

  it("stops on the archiving day of an archived goal", () => {
    expect(
      resolveObservationEnd({
        archivedAt: new Date("2026-08-06T09:00:00.000Z"),
        now: new Date("2026-12-31T12:00:00.000Z"),
        status: "archived",
      }),
    ).toEqual(parseIsoDate("2026-08-06"));
  });

  it("stops on the deadline of a goal archived after it had passed", () => {
    expect(
      resolveObservationEnd({
        archivedAt: new Date("2026-09-05T09:00:00.000Z"),
        now: new Date("2026-12-31T12:00:00.000Z"),
        status: "archived",
      }),
    ).toEqual(parseIsoDate("2026-08-20"));
  });

  it("stops on the archiving day even when the goal had already met its target", () => {
    expect(
      resolveObservationEnd({
        archivedAt: new Date("2026-08-06T09:00:00.000Z"),
        completedAt: new Date("2026-08-04T09:00:00.000Z"),
        now: new Date("2026-12-31T12:00:00.000Z"),
        status: "archived",
      }),
    ).toEqual(parseIsoDate("2026-08-06"));
  });
});
