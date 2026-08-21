import { ReadingGoalListItemSchema, ReadingGoalViewSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { calculateReadingGoalMetrics } from "./reading-goal-metrics.js";
import { toReadingGoalListItem, toReadingGoalView } from "./reading-goal.mapper.js";

const goal = {
  archivedAt: null,
  createdAt: new Date("2026-08-01T09:15:00.000Z"),
  deadline: parseIsoDate("2026-08-20"),
  id: "6a1d0a4c-6f3a-4a26-9a4c-2d9b0b9f6f11",
  list: { id: "0f7b1f2a-6a1e-4a9e-8f61-9a1d3b6e2c44", name: "Summer reading" },
  listId: "0f7b1f2a-6a1e-4a9e-8f61-9a1d3b6e2c44",
  name: "Five books before autumn",
  targetCount: 5,
  updatedAt: new Date("2026-08-09T09:15:00.000Z"),
  userId: "3b2f1c0d-9e8a-4b7c-8d6e-5f4a3b2c1d0e",
} satisfies ReadingGoalWithList;

const now = new Date("2026-08-10T12:00:00.000Z");

const calculation = calculateReadingGoalMetrics({
  goal,
  now,
  snapshotBooks: [
    { bookId: "book-1", qualifiedFinishedAt: parseIsoDate("2026-08-03") },
    { bookId: "book-2", qualifiedFinishedAt: parseIsoDate("2026-08-07") },
    { bookId: "book-3", qualifiedFinishedAt: null },
    { bookId: "book-4", qualifiedFinishedAt: null },
    { bookId: "book-5", qualifiedFinishedAt: null },
  ],
});

describe("toReadingGoalView", () => {
  it("returns exactly the shared view contract", () => {
    const view = toReadingGoalView({ goal, progress: calculation.progress });

    expect(ReadingGoalViewSchema.parse(view)).toStrictEqual(view);
  });

  it("renders calendar fields as dates and audit fields as timestamps", () => {
    const view = toReadingGoalView({
      goal: { ...goal, archivedAt: new Date("2026-08-09T10:30:00.000Z") },
      progress: calculation.progress,
    });

    expect(view.deadline).toBe("2026-08-20");
    expect(view.createdAt).toBe("2026-08-01T09:15:00.000Z");
    expect(view.archivedAt).toBe("2026-08-09T10:30:00.000Z");
  });

  it("carries the owning list and the lifecycle the calculation resolved", () => {
    const view = toReadingGoalView({ goal, progress: calculation.progress });

    expect(view).toMatchObject({
      completedAt: null,
      completedCount: 2,
      daysLeft: 10,
      id: goal.id,
      list: { id: goal.listId, name: "Summer reading" },
      name: goal.name,
      remainingCount: 3,
      result: null,
      status: "active",
      targetCount: 5,
    });
  });

  it("reports no list for a goal detached from one", () => {
    const view = toReadingGoalView({
      goal: { ...goal, list: null, listId: null },
      progress: calculation.progress,
    });

    expect(view.list).toBeNull();
  });
});

describe("toReadingGoalListItem", () => {
  it("returns exactly the shared list-item contract", () => {
    const listItem = toReadingGoalListItem({ calculation, goal });

    expect(ReadingGoalListItemSchema.parse(listItem)).toStrictEqual(listItem);
  });

  it("carries every view field and every metric of the same calculation", () => {
    const listItem = toReadingGoalListItem({ calculation, goal });

    expect(listItem).toMatchObject(toReadingGoalView({ goal, progress: calculation.progress }));
    expect(listItem).toMatchObject(calculation.metrics);
  });
});
