import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingGoalActivityRepository } from "../infrastructure/reading-goal-activity.repository.js";
import type { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { fakeOf } from "../../../test/fake.js";
import { ReadingGoalActivityRecorder } from "./reading-goal-activity.recorder.js";

const GOAL_ID = "33333333-3333-4333-8333-333333333333";
const LIST_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";

const NOW = new Date("2026-08-15T09:00:00.000Z");
const TX = fakeOf<Prisma.TransactionClient>({});

type WrittenRow = {
  bookId: null | string;
  goalId: string;
  metadata: null | Record<string, unknown>;
  type: string;
  userId: string;
};

function bookId(index: number): string {
  return `2222${String(index).padStart(4, "0")}-2222-4222-8222-222222222222`;
}

function buildRecorder(snapshotBooks: { bookId: string; qualifiedFinishedAt: Date | null }[] = []) {
  const activityRepository = {
    createMany: vi.fn().mockResolvedValue(0),
    existsOfType: vi.fn().mockResolvedValue(false),
  };
  const booksRepository = {
    findByGoal: vi.fn().mockResolvedValue(snapshotBooks),
  };
  const recorder = new ReadingGoalActivityRecorder(
    activityRepository as unknown as ReadingGoalActivityRepository,
    booksRepository as unknown as ReadingGoalBooksRepository,
  );
  return { activityRepository, recorder };
}

function goal(overrides: Partial<ReadingGoalWithList> = {}): ReadingGoalWithList {
  return {
    archivedAt: null,
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
    deadline: parseIsoDate("2026-09-01"),
    id: GOAL_ID,
    list: { id: LIST_ID, name: "Autumn reads" },
    listId: LIST_ID,
    name: "Five books",
    targetCount: 2,
    updatedAt: new Date("2026-08-01T10:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  };
}

function rowsOf(activityRepository: { createMany: ReturnType<typeof vi.fn> }): WrittenRow[] {
  const call: unknown = activityRepository.createMany.mock.calls.at(0)?.at(0);
  if (call === undefined || call === null || typeof call !== "object" || !("rows" in call)) {
    return [];
  }
  return call.rows as WrittenRow[];
}

function typesOf(activityRepository: { createMany: ReturnType<typeof vi.fn> }): string[] {
  return rowsOf(activityRepository).map((row) => row.type);
}

describe("ReadingGoalActivityRecorder.recordCreation", () => {
  it("records the goal with its target, deadline and snapshot size", async () => {
    const { activityRepository, recorder } = buildRecorder([
      { bookId: bookId(0), qualifiedFinishedAt: null },
      { bookId: bookId(1), qualifiedFinishedAt: null },
      { bookId: bookId(2), qualifiedFinishedAt: null },
    ]);

    await recorder.recordCreation({ goal: goal(), now: NOW, tx: TX });

    expect(rowsOf(activityRepository)).toEqual([
      {
        bookId: null,
        goalId: GOAL_ID,
        metadata: { deadline: "2026-09-01", snapshotBookCount: 3, targetCount: 2 },
        type: "goal_created",
        userId: USER_ID,
      },
    ]);
  });

  it("counts the books that already qualify, in finished order", async () => {
    const { activityRepository, recorder } = buildRecorder([
      { bookId: bookId(0), qualifiedFinishedAt: parseIsoDate("2026-08-10") },
      { bookId: bookId(1), qualifiedFinishedAt: null },
      { bookId: bookId(2), qualifiedFinishedAt: parseIsoDate("2026-08-05") },
    ]);

    await recorder.recordCreation({ goal: goal({ targetCount: 5 }), now: NOW, tx: TX });

    expect(rowsOf(activityRepository).filter((row) => row.type === "book_counted")).toEqual([
      {
        bookId: bookId(2),
        goalId: GOAL_ID,
        metadata: { completedCount: 1, finishedAt: "2026-08-05", targetCount: 5 },
        type: "book_counted",
        userId: USER_ID,
      },
      {
        bookId: bookId(0),
        goalId: GOAL_ID,
        metadata: { completedCount: 2, finishedAt: "2026-08-10", targetCount: 5 },
        type: "book_counted",
        userId: USER_ID,
      },
    ]);
  });

  it("closes the goal when the snapshot already meets the target", async () => {
    const { activityRepository, recorder } = buildRecorder([
      { bookId: bookId(0), qualifiedFinishedAt: parseIsoDate("2026-08-05") },
      { bookId: bookId(1), qualifiedFinishedAt: parseIsoDate("2026-08-10") },
    ]);

    await recorder.recordCreation({ goal: goal(), now: NOW, tx: TX });

    expect(typesOf(activityRepository)).toEqual([
      "goal_created",
      "book_counted",
      "book_counted",
      "goal_completed",
    ]);
    expect(rowsOf(activityRepository).at(-1)?.metadata).toEqual({
      completedAt: "2026-08-10",
      daysBeforeDeadline: 22,
      targetCount: 2,
    });
  });

  it("leaves the goal open when the target is not met yet", async () => {
    const { activityRepository, recorder } = buildRecorder([
      { bookId: bookId(0), qualifiedFinishedAt: parseIsoDate("2026-08-05") },
      { bookId: bookId(1), qualifiedFinishedAt: null },
    ]);

    await recorder.recordCreation({ goal: goal(), now: NOW, tx: TX });

    expect(typesOf(activityRepository)).toEqual(["goal_created", "book_counted"]);
  });
});

describe("ReadingGoalActivityRecorder.recordUpdate", () => {
  it("records a target change with both sides", async () => {
    const { activityRepository, recorder } = buildRecorder();

    await recorder.recordUpdate({
      changes: [],
      goal: goal({ targetCount: 6 }),
      now: NOW,
      previous: goal({ targetCount: 5 }),
      tx: TX,
    });

    expect(rowsOf(activityRepository)).toEqual([
      {
        bookId: null,
        goalId: GOAL_ID,
        metadata: { from: 5, to: 6 },
        type: "target_changed",
        userId: USER_ID,
      },
    ]);
  });

  it("records a deadline change as calendar dates", async () => {
    const { activityRepository, recorder } = buildRecorder();

    await recorder.recordUpdate({
      changes: [],
      goal: goal({ deadline: parseIsoDate("2026-11-01") }),
      now: NOW,
      previous: goal({ deadline: parseIsoDate("2026-10-01") }),
      tx: TX,
    });

    expect(rowsOf(activityRepository)).toEqual([
      {
        bookId: null,
        goalId: GOAL_ID,
        metadata: { from: "2026-10-01", to: "2026-11-01" },
        type: "deadline_changed",
        userId: USER_ID,
      },
    ]);
  });

  it("records a rename with both names", async () => {
    const { activityRepository, recorder } = buildRecorder();

    await recorder.recordUpdate({
      changes: [],
      goal: goal({ name: "Winter reads" }),
      now: NOW,
      previous: goal({ name: "Autumn reads" }),
      tx: TX,
    });

    expect(rowsOf(activityRepository)).toEqual([
      {
        bookId: null,
        goalId: GOAL_ID,
        metadata: { from: "Autumn reads", to: "Winter reads" },
        type: "goal_renamed",
        userId: USER_ID,
      },
    ]);
  });

  it("uncounts a book the new deadline pushed out", async () => {
    const { activityRepository, recorder } = buildRecorder([
      { bookId: bookId(0), qualifiedFinishedAt: null },
    ]);

    await recorder.recordUpdate({
      changes: [
        {
          bookId: bookId(0),
          previousQualifiedFinishedAt: parseIsoDate("2026-08-18"),
          qualifiedFinishedAt: null,
        },
      ],
      goal: goal({ deadline: parseIsoDate("2026-08-16") }),
      now: NOW,
      previous: goal(),
      tx: TX,
    });

    expect(rowsOf(activityRepository)).toContainEqual({
      bookId: bookId(0),
      goalId: GOAL_ID,
      metadata: { previousFinishedAt: "2026-08-18", reason: "deadline_changed" },
      type: "book_uncounted",
      userId: USER_ID,
    });
  });

  it("counts a book the new deadline pulled in", async () => {
    const { activityRepository, recorder } = buildRecorder([
      { bookId: bookId(0), qualifiedFinishedAt: parseIsoDate("2026-08-14") },
    ]);

    await recorder.recordUpdate({
      changes: [
        {
          bookId: bookId(0),
          previousQualifiedFinishedAt: null,
          qualifiedFinishedAt: parseIsoDate("2026-08-14"),
        },
      ],
      goal: goal({ deadline: parseIsoDate("2026-10-01") }),
      now: NOW,
      previous: goal({ deadline: parseIsoDate("2026-08-10") }),
      tx: TX,
    });

    expect(rowsOf(activityRepository)).toContainEqual({
      bookId: bookId(0),
      goalId: GOAL_ID,
      metadata: { completedCount: 1, finishedAt: "2026-08-14", targetCount: 2 },
      type: "book_counted",
      userId: USER_ID,
    });
  });

  it("treats a moved finished date as neither counted nor uncounted", async () => {
    const { activityRepository, recorder } = buildRecorder([
      { bookId: bookId(0), qualifiedFinishedAt: parseIsoDate("2026-08-14") },
    ]);

    await recorder.recordUpdate({
      changes: [
        {
          bookId: bookId(0),
          previousQualifiedFinishedAt: parseIsoDate("2026-08-12"),
          qualifiedFinishedAt: parseIsoDate("2026-08-14"),
        },
      ],
      goal: goal({ deadline: parseIsoDate("2026-10-01") }),
      now: NOW,
      previous: goal(),
      tx: TX,
    });

    expect(typesOf(activityRepository)).toEqual(["deadline_changed"]);
  });

  it("closes the goal when a lowered target is already met", async () => {
    const { activityRepository, recorder } = buildRecorder([
      { bookId: bookId(0), qualifiedFinishedAt: parseIsoDate("2026-08-05") },
      { bookId: bookId(1), qualifiedFinishedAt: null },
    ]);

    await recorder.recordUpdate({
      changes: [],
      goal: goal({ targetCount: 1 }),
      now: NOW,
      previous: goal({ targetCount: 2 }),
      tx: TX,
    });

    expect(typesOf(activityRepository)).toEqual(["target_changed", "goal_completed"]);
  });

  it("does not repeat a completion that is already on the timeline", async () => {
    const { activityRepository, recorder } = buildRecorder([
      { bookId: bookId(0), qualifiedFinishedAt: parseIsoDate("2026-08-05") },
    ]);
    activityRepository.existsOfType.mockResolvedValue(true);

    await recorder.recordUpdate({
      changes: [],
      goal: goal({ targetCount: 1 }),
      now: NOW,
      previous: goal({ targetCount: 2 }),
      tx: TX,
    });

    expect(typesOf(activityRepository)).toEqual(["target_changed"]);
  });

  it("expires the goal when a raised target no longer fits the passed deadline", async () => {
    const { activityRepository, recorder } = buildRecorder([
      { bookId: bookId(0), qualifiedFinishedAt: parseIsoDate("2026-08-05") },
    ]);

    await recorder.recordUpdate({
      changes: [],
      goal: goal({ deadline: parseIsoDate("2026-08-10"), targetCount: 2 }),
      now: NOW,
      previous: goal({ deadline: parseIsoDate("2026-08-10"), targetCount: 1 }),
      tx: TX,
    });

    expect(typesOf(activityRepository)).toEqual(["target_changed", "goal_expired"]);
    expect(rowsOf(activityRepository).at(-1)?.metadata).toEqual({
      completedCount: 1,
      deadline: "2026-08-10",
      remainingCount: 1,
      targetCount: 2,
    });
  });

  it("stays silent when nothing about the goal changed", async () => {
    const { activityRepository, recorder } = buildRecorder();

    await recorder.recordUpdate({
      changes: [],
      goal: goal(),
      now: NOW,
      previous: goal(),
      tx: TX,
    });

    expect(activityRepository.createMany).not.toHaveBeenCalled();
  });
});

describe("ReadingGoalActivityRecorder.recordArchive", () => {
  it("records the result the goal was frozen at", async () => {
    const { activityRepository, recorder } = buildRecorder([
      { bookId: bookId(0), qualifiedFinishedAt: parseIsoDate("2026-08-05") },
      { bookId: bookId(1), qualifiedFinishedAt: parseIsoDate("2026-08-10") },
    ]);

    await recorder.recordArchive({
      changes: [],
      goal: goal({ archivedAt: new Date("2026-08-15T09:00:00.000Z") }),
      now: NOW,
      tx: TX,
    });

    expect(rowsOf(activityRepository)).toEqual([
      {
        bookId: null,
        goalId: GOAL_ID,
        metadata: { result: "completed" },
        type: "goal_archived",
        userId: USER_ID,
      },
    ]);
  });

  it("records an unfinished goal archived after its deadline as expired", async () => {
    const { activityRepository, recorder } = buildRecorder([
      { bookId: bookId(0), qualifiedFinishedAt: null },
    ]);

    await recorder.recordArchive({
      changes: [],
      goal: goal({
        archivedAt: new Date("2026-09-15T09:00:00.000Z"),
        deadline: parseIsoDate("2026-09-01"),
      }),
      now: new Date("2026-09-15T09:00:00.000Z"),
      tx: TX,
    });

    expect(rowsOf(activityRepository).at(0)?.metadata).toEqual({ result: "expired" });
  });
});
