import { READING_GOAL_TARGET_MAX, ReadingGoalCheckpointSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { ReadingGoalCandidateBook } from "./reading-goal-progress.js";

import {
  buildReadingGoalCheckpoints,
  dedupeCheckpointTargets,
} from "./reading-goal-checkpoints.js";
import { READING_GOAL_CHECKPOINTS } from "./reading-goal.constants.js";

const goalStartDate = new Date("2026-08-01T00:00:00.000Z");
const deadline = new Date("2026-08-10T00:00:00.000Z");
const now = new Date("2026-08-05T12:00:00.000Z");

function book(bookId: string, finishedAt: null | string): ReadingGoalCandidateBook {
  return { bookId, finishedAt: finishedAt === null ? null : new Date(finishedAt) };
}

function targetsFor(targetCount: number): number[] {
  return buildReadingGoalCheckpoints({
    archivedAt: null,
    books: [],
    deadline,
    goalStartDate,
    now,
    targetCount,
  }).map((checkpoint) => checkpoint.targetCount);
}

describe("buildReadingGoalCheckpoints targets", () => {
  it("returns a single checkpoint on the deadline for a one book goal", () => {
    const checkpoints = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [],
      deadline,
      goalStartDate,
      now,
      targetCount: 1,
    });

    expect(checkpoints).toEqual([
      {
        achievedAt: null,
        currentCompletedCount: 0,
        dueDate: "2026-08-10",
        status: "upcoming",
        targetCount: 1,
      },
    ]);
  });

  it.each([1, 2, 3, 4, 5])("creates one checkpoint per book for target %i", (targetCount) => {
    const expected = Array.from({ length: targetCount }, (_value, index) => index + 1);

    expect(targetsFor(targetCount)).toEqual(expected);
  });

  it.each([
    { expected: [2, 3, 4, 5, 6], targetCount: 6 },
    { expected: [2, 3, 5, 6, 7], targetCount: 7 },
    { expected: [2, 4, 5, 7, 8], targetCount: 8 },
    { expected: [2, 4, 6, 8, 9], targetCount: 9 },
    { expected: [2, 4, 6, 8, 10], targetCount: 10 },
    { expected: [3, 5, 7, 9, 11], targetCount: 11 },
    { expected: [3, 5, 8, 10, 12], targetCount: 12 },
    { expected: [20, 40, 60, 80, 100], targetCount: 100 },
    { expected: [200, 400, 600, 800, 1000], targetCount: 1000 },
  ])("rounds target $targetCount up onto the fraction grid", ({ expected, targetCount }) => {
    const targets = targetsFor(targetCount);

    expect(targets).toEqual(expected);
    expect(targets.length).toBeLessThanOrEqual(READING_GOAL_CHECKPOINTS.maxCount);
  });

  it("never repeats a target above the checkpoint cap, so the grid dedupe is a safety net", () => {
    const repeating: number[] = [];
    for (
      let targetCount = READING_GOAL_CHECKPOINTS.maxCount + 1;
      targetCount <= READING_GOAL_TARGET_MAX;
      targetCount += 1
    ) {
      const targets = targetsFor(targetCount);
      if (new Set(targets).size !== targets.length) {
        repeating.push(targetCount);
      }
    }

    expect(repeating).toEqual([]);
  });
});

describe("dedupeCheckpointTargets", () => {
  it("keeps the last draft of a repeated target so the later dueDate survives", () => {
    expect(
      dedupeCheckpointTargets([
        { dueDate: "2026-08-02", targetCount: 1 },
        { dueDate: "2026-08-04", targetCount: 1 },
        { dueDate: "2026-08-06", targetCount: 2 },
        { dueDate: "2026-08-08", targetCount: 3 },
        { dueDate: "2026-08-10", targetCount: 3 },
      ]),
    ).toEqual([
      { dueDate: "2026-08-04", targetCount: 1 },
      { dueDate: "2026-08-06", targetCount: 2 },
      { dueDate: "2026-08-10", targetCount: 3 },
    ]);
  });

  it("leaves a strictly increasing grid untouched", () => {
    const drafts = [
      { dueDate: "2026-08-02", targetCount: 3 },
      { dueDate: "2026-08-04", targetCount: 5 },
      { dueDate: "2026-08-06", targetCount: 8 },
      { dueDate: "2026-08-08", targetCount: 10 },
      { dueDate: "2026-08-10", targetCount: 12 },
    ];

    expect(dedupeCheckpointTargets(drafts)).toEqual(drafts);
  });
});

describe("buildReadingGoalCheckpoints dueDate", () => {
  it("spreads the checkpoints evenly across the inclusive goal window", () => {
    const checkpoints = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [],
      deadline,
      goalStartDate,
      now,
      targetCount: 10,
    });

    expect(checkpoints.map((checkpoint) => checkpoint.dueDate)).toEqual([
      "2026-08-02",
      "2026-08-04",
      "2026-08-06",
      "2026-08-08",
      "2026-08-10",
    ]);
  });

  it.each([
    { expected: ["2026-08-10"], targetCount: 1 },
    { expected: ["2026-08-05", "2026-08-10"], targetCount: 2 },
    { expected: ["2026-08-03", "2026-08-07", "2026-08-10"], targetCount: 3 },
    { expected: ["2026-08-03", "2026-08-05", "2026-08-08", "2026-08-10"], targetCount: 4 },
    {
      expected: ["2026-08-02", "2026-08-04", "2026-08-06", "2026-08-08", "2026-08-10"],
      targetCount: 5,
    },
  ])(
    "spreads a goal of $targetCount books evenly rather than onto the fraction grid",
    ({ expected, targetCount }) => {
      const checkpoints = buildReadingGoalCheckpoints({
        archivedAt: null,
        books: [],
        deadline,
        goalStartDate,
        now,
        targetCount,
      });

      expect(checkpoints.map((checkpoint) => checkpoint.dueDate)).toEqual(expected);
    },
  );

  it("matches the spec example of ten books between the first of September and the last of December", () => {
    const checkpoints = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [],
      deadline: new Date("2026-12-31T00:00:00.000Z"),
      goalStartDate: new Date("2026-09-01T00:00:00.000Z"),
      now: new Date("2026-09-10T12:00:00.000Z"),
      targetCount: 10,
    });

    expect(checkpoints.map((checkpoint) => checkpoint.dueDate)).toEqual([
      "2026-09-24",
      "2026-10-19",
      "2026-11-12",
      "2026-12-07",
      "2026-12-31",
    ]);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 11, 12, 49, 100, 1000])(
    "ends on the deadline with the full goal target for target %i",
    (targetCount) => {
      const shortWindow = buildReadingGoalCheckpoints({
        archivedAt: null,
        books: [],
        deadline: new Date("2026-08-07T00:00:00.000Z"),
        goalStartDate,
        now,
        targetCount,
      });
      const longWindow = buildReadingGoalCheckpoints({
        archivedAt: null,
        books: [],
        deadline: new Date("2026-12-31T00:00:00.000Z"),
        goalStartDate: new Date("2026-09-01T00:00:00.000Z"),
        now: new Date("2026-09-10T12:00:00.000Z"),
        targetCount,
      });

      expect(shortWindow.at(-1)).toMatchObject({ dueDate: "2026-08-07", targetCount });
      expect(longWindow.at(-1)).toMatchObject({ dueDate: "2026-12-31", targetCount });
    },
  );

  it("never places a checkpoint before the goal started on a two day window", () => {
    const checkpoints = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [],
      deadline: new Date("2026-08-02T00:00:00.000Z"),
      goalStartDate,
      now: new Date("2026-08-01T09:00:00.000Z"),
      targetCount: 5,
    });

    expect(checkpoints.map((checkpoint) => checkpoint.dueDate)).toEqual([
      "2026-08-01",
      "2026-08-01",
      "2026-08-01",
      "2026-08-02",
      "2026-08-02",
    ]);
  });

  it("collapses a single day goal onto its only day", () => {
    const checkpoints = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [],
      deadline: goalStartDate,
      goalStartDate,
      now: new Date("2026-08-01T09:00:00.000Z"),
      targetCount: 3,
    });

    expect(checkpoints.map((checkpoint) => checkpoint.dueDate)).toEqual([
      "2026-08-01",
      "2026-08-01",
      "2026-08-01",
    ]);
  });
});

describe("buildReadingGoalCheckpoints status", () => {
  it("reports the whole schedule of a partially finished goal", () => {
    const checkpoints = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [
        book("book-c", "2026-08-05T08:00:00.000Z"),
        book("book-a", "2026-08-01T09:00:00.000Z"),
        book("book-b", "2026-08-02T18:00:00.000Z"),
      ],
      deadline,
      goalStartDate,
      now,
      targetCount: 10,
    });

    expect(checkpoints).toEqual([
      {
        achievedAt: "2026-08-02",
        currentCompletedCount: 3,
        dueDate: "2026-08-02",
        status: "achieved",
        targetCount: 2,
      },
      {
        achievedAt: null,
        currentCompletedCount: 3,
        dueDate: "2026-08-04",
        status: "missed",
        targetCount: 4,
      },
      {
        achievedAt: null,
        currentCompletedCount: 3,
        dueDate: "2026-08-06",
        status: "upcoming",
        targetCount: 6,
      },
      {
        achievedAt: null,
        currentCompletedCount: 3,
        dueDate: "2026-08-08",
        status: "upcoming",
        targetCount: 8,
      },
      {
        achievedAt: null,
        currentCompletedCount: 3,
        dueDate: "2026-08-10",
        status: "upcoming",
        targetCount: 10,
      },
    ]);
  });

  it("achieves a checkpoint reached late in the evening of its own dueDate", () => {
    const [firstCheckpoint] = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [book("book-a", "2026-08-02T23:59:00.000Z")],
      deadline,
      goalStartDate,
      now,
      targetCount: 5,
    });

    expect(firstCheckpoint).toMatchObject({
      achievedAt: "2026-08-02",
      dueDate: "2026-08-02",
      status: "achieved",
    });
  });

  it("misses a checkpoint whose dueDate passed with the target unreached", () => {
    const checkpoints = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [book("book-a", "2026-08-01T09:00:00.000Z")],
      deadline,
      goalStartDate,
      now,
      targetCount: 10,
    });

    expect(checkpoints[1]).toEqual({
      achievedAt: null,
      currentCompletedCount: 1,
      dueDate: "2026-08-04",
      status: "missed",
      targetCount: 4,
    });
  });

  it("leaves a checkpoint upcoming while its dueDate is still today", () => {
    const checkpoints = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [],
      deadline,
      goalStartDate,
      now: new Date("2026-08-06T23:00:00.000Z"),
      targetCount: 10,
    });

    expect(checkpoints[2]).toMatchObject({ dueDate: "2026-08-06", status: "upcoming" });
  });

  it("misses every early checkpoint when the books were all finished in one late burst", () => {
    const checkpoints = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [
        book("book-a", "2026-08-05T09:00:00.000Z"),
        book("book-b", "2026-08-05T10:00:00.000Z"),
        book("book-c", "2026-08-05T11:00:00.000Z"),
        book("book-d", "2026-08-05T12:00:00.000Z"),
      ],
      deadline,
      goalStartDate,
      now,
      targetCount: 10,
    });

    expect(checkpoints.map((checkpoint) => checkpoint.status)).toEqual([
      "missed",
      "missed",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(checkpoints.map((checkpoint) => checkpoint.achievedAt)).toEqual([
      "2026-08-05",
      "2026-08-05",
      null,
      null,
      null,
    ]);
    expect(checkpoints.map((checkpoint) => checkpoint.currentCompletedCount)).toEqual([
      4, 4, 4, 4, 4,
    ]);
  });

  it("resolves achievedAt through the qualifying order rather than the input order", () => {
    const [firstCheckpoint] = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [
        book("book-z", "2026-08-04T10:00:00.000Z"),
        book("book-a", "2026-08-01T10:00:00.000Z"),
      ],
      deadline,
      goalStartDate,
      now,
      targetCount: 5,
    });

    expect(firstCheckpoint).toMatchObject({ achievedAt: "2026-08-01", targetCount: 1 });
  });

  it("ignores books finished outside the qualification window", () => {
    const checkpoints = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [
        book("too-early", "2026-07-31T22:00:00.000Z"),
        book("unfinished", null),
        book("too-late", "2026-08-11T09:00:00.000Z"),
        book("counted", "2026-08-01T10:00:00.000Z"),
      ],
      deadline,
      goalStartDate,
      now: new Date("2026-08-12T09:00:00.000Z"),
      targetCount: 5,
    });

    expect(checkpoints[0]).toEqual({
      achievedAt: "2026-08-01",
      currentCompletedCount: 1,
      dueDate: "2026-08-02",
      status: "achieved",
      targetCount: 1,
    });
    expect(checkpoints[1]).toMatchObject({ achievedAt: null, status: "missed" });
  });

  it("matches the shared checkpoint contract", () => {
    const checkpoints = buildReadingGoalCheckpoints({
      archivedAt: null,
      books: [book("book-a", "2026-08-02T09:00:00.000Z")],
      deadline,
      goalStartDate,
      now,
      targetCount: 12,
    });

    expect(ReadingGoalCheckpointSchema.array().safeParse(checkpoints).success).toBe(true);
  });
});
