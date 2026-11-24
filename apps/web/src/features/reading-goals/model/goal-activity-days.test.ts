import { describe, expect, it } from "vitest";

import type { GoalActivityDay } from "./goal-activity-days";

import { groupGoalActivityByDay } from "./goal-activity-days";
import { makeReadingGoalActivity } from "./reading-goals.fixtures";

function activityAt(id: string, createdAt: string) {
  return makeReadingGoalActivity({ createdAt, id });
}

function dayIds(groups: GoalActivityDay[]) {
  return groups.map(({ day, items }) => ({ day, ids: items.map(({ id }) => id) }));
}

const FIRST_PAGE = [
  activityAt("afternoon", "2026-11-24T13:30:00.000Z"),
  activityAt("morning", "2026-11-24T07:05:00.000Z"),
];

const SECOND_PAGE = [
  activityAt("kyiv-past-midnight", "2026-11-23T22:30:00.000Z"),
  activityAt("previous-day", "2026-11-23T08:00:00.000Z"),
];

describe("groupGoalActivityByDay", () => {
  it("returns no groups for an empty feed", () => {
    expect(groupGoalActivityByDay({ items: [], timeZone: "Europe/Kyiv" })).toEqual([]);
  });

  it.each([
    {
      expected: [
        { day: "2026-11-24", ids: ["afternoon", "morning", "kyiv-past-midnight"] },
        { day: "2026-11-23", ids: ["previous-day"] },
      ],
      timeZone: "Europe/Kyiv",
    },
    {
      expected: [
        { day: "2026-11-24", ids: ["afternoon", "morning"] },
        { day: "2026-11-23", ids: ["kyiv-past-midnight", "previous-day"] },
      ],
      timeZone: "UTC",
    },
  ])("merges one $timeZone day across two pages into one group", ({ expected, timeZone }) => {
    const groups = groupGoalActivityByDay({ items: [...FIRST_PAGE, ...SECOND_PAGE], timeZone });

    expect(dayIds(groups)).toEqual(expected);
  });

  it.each([
    { expectedDay: "2026-11-24", timeZone: "Europe/Kyiv" },
    { expectedDay: "2026-11-23", timeZone: "UTC" },
    { expectedDay: "2026-11-23", timeZone: "America/New_York" },
  ])("files a 22:30 UTC event under $expectedDay in $timeZone", ({ expectedDay, timeZone }) => {
    const groups = groupGoalActivityByDay({
      items: [activityAt("late", "2026-11-23T22:30:00.000Z")],
      timeZone,
    });

    expect(groups.map(({ day }) => day)).toEqual([expectedDay]);
  });

  it("starts the next day exactly at local midnight", () => {
    const groups = groupGoalActivityByDay({
      items: [
        activityAt("kyiv-midnight", "2026-11-23T22:00:00.000Z"),
        activityAt("kyiv-last-minute", "2026-11-23T21:59:00.000Z"),
      ],
      timeZone: "Europe/Kyiv",
    });

    expect(dayIds(groups)).toEqual([
      { day: "2026-11-24", ids: ["kyiv-midnight"] },
      { day: "2026-11-23", ids: ["kyiv-last-minute"] },
    ]);
  });
});
