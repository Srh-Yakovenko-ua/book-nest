import type { ReadingGoalListItem } from "@app/shared";

import { describe, expect, it } from "vitest";

import { buildReadingGoalAttention, needsReadingGoalAttention } from "./reading-goal-attention.js";

const onTrackLateGoal = {
  actualBooksPerDay: 0.057,
  archivedAt: null,
  averageDaysPerBook: 17.5,
  completedAt: null,
  completedCount: 2,
  createdAt: "2026-09-01T08:00:00.000Z",
  daysLeft: 38,
  daysSinceLastCounted: 4,
  deadline: "2026-11-12",
  elapsedDays: 35,
  elapsedPercent: 47.9,
  expectedCompletedCount: 2.4,
  id: "goal-autumn",
  lastCountedAt: "2026-10-01",
  list: { id: "list-fantasy", name: "Fantasy" },
  name: "Autumn shelf",
  pace: "on_track",
  paceDeltaBooks: -0.4,
  paceDeltaPercent: -7.9,
  progressPercent: 40,
  projectedCompletionDate: "2026-11-27",
  projectedDaysDelta: -15,
  projectionConfidence: "medium",
  remainingCount: 3,
  requiredBooksPerDay: 0.077,
  requiredDaysPerBook: 13,
  result: null,
  riskLevel: "high",
  riskReasons: ["projected_late"],
  status: "active",
  targetCount: 5,
  totalDays: 73,
} satisfies ReadingGoalListItem;

function listItem(overrides: Partial<ReadingGoalListItem>): ReadingGoalListItem {
  return { ...onTrackLateGoal, ...overrides };
}

describe("needsReadingGoalAttention projected lateness", () => {
  it("pulls in an on-track goal whose trusted forecast is fifteen days late", () => {
    expect(needsReadingGoalAttention(onTrackLateGoal)).toBe(true);
  });

  it.each([
    { lateDays: 1, riskLevel: "low" },
    { lateDays: 3, riskLevel: "low" },
    { lateDays: 4, riskLevel: "medium" },
    { lateDays: 7, riskLevel: "medium" },
  ] as const)(
    "leaves out an on-track goal forecast only $lateDays days late",
    ({ lateDays, riskLevel }) => {
      const item = listItem({ projectedDaysDelta: -lateDays, riskLevel });

      expect(needsReadingGoalAttention(item)).toBe(false);
    },
  );
});

describe("buildReadingGoalAttention projected lateness", () => {
  it("leads with projected_late at high severity for an on-track goal forecast fifteen days late", () => {
    expect(buildReadingGoalAttention([onTrackLateGoal])).toMatchObject([
      { goalId: "goal-autumn", reason: "projected_late", severity: "high" },
    ]);
  });

  it("tells the reader how many days late the forecast lands", () => {
    const [attention] = buildReadingGoalAttention([onTrackLateGoal]);

    expect(attention?.messageData).toStrictEqual({
      daysLeft: 38,
      lateDays: 15,
      projectedCompletionDate: "2026-11-27",
      remainingCount: 3,
      targetCount: 5,
    });
  });

  it("keeps behind_schedule in the lead for a behind goal that is also forecast late", () => {
    const behindAndLate = listItem({
      pace: "behind",
      paceDeltaBooks: -0.6,
      riskReasons: ["behind_schedule", "projected_late"],
    });

    expect(buildReadingGoalAttention([behindAndLate])).toMatchObject([
      { reason: "behind_schedule" },
    ]);
  });

  it("does not lead with projected_late when the forecast behind a high risk is untrusted", () => {
    const untrustedForecast = listItem({
      daysLeft: 5,
      projectionConfidence: "low",
      requiredBooksPerDay: 0.5,
      riskReasons: ["deadline_soon", "required_pace_high"],
    });

    expect(buildReadingGoalAttention([untrustedForecast])).toMatchObject([
      { reason: "deadline_soon" },
    ]);
  });
});
