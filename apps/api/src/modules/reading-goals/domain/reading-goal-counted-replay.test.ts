import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type {
  ReadingGoalActivityReplayRow,
  ReadingGoalCountedReplay,
} from "./reading-goal-counted-replay.js";

import { replayReadingGoalCountedOrdinals } from "./reading-goal-counted-replay.js";

type ReplayRow = ReadingGoalActivityReplayRow;

function bookCounted({
  bookId,
  createdAt,
  finishedAt,
  id,
  recorded,
}: {
  bookId: Nullable<string>;
  createdAt: string;
  finishedAt: string;
  id: string;
  recorded: number;
}): ReplayRow {
  return {
    bookId,
    createdAt: new Date(createdAt),
    id,
    metadata: { completedCount: recorded, finishedAt },
    type: "book_counted",
  };
}

function bookUncounted({
  bookId,
  createdAt,
  id,
}: {
  bookId: string;
  createdAt: string;
  id: string;
}): ReplayRow {
  return {
    bookId,
    createdAt: new Date(createdAt),
    id,
    metadata: { previousFinishedAt: "2026-03-01", reason: "finished_date_removed" },
    type: "book_uncounted",
  };
}

function goalActivity({
  createdAt,
  id,
  type,
}: {
  createdAt: string;
  id: string;
  type: string;
}): ReplayRow {
  return { bookId: null, createdAt: new Date(createdAt), id, metadata: {}, type };
}

function goalCreated({ createdAt, id }: { createdAt: string; id: string }): ReplayRow {
  return {
    bookId: null,
    createdAt: new Date(createdAt),
    id,
    metadata: { targetCount: 5 },
    type: "goal_created",
  };
}

function replayedCounts(replay: ReadingGoalCountedReplay): Record<string, number> {
  if (replay.status === "skipped") {
    throw new Error(`expected a replay, got the skip ${replay.skip.reason}`);
  }
  return Object.fromEntries(
    replay.ordinals.map(({ activityId, completedCount }) => [activityId, completedCount]),
  );
}

function sameDayPair({ alphaRecorded }: { alphaRecorded: number }): ReplayRow[] {
  return [
    created,
    bookCounted({
      bookId: "book-zeta",
      createdAt: "2026-03-05T18:00:00.000Z",
      finishedAt: "2026-03-05",
      id: "act-zeta",
      recorded: 1,
    }),
    bookCounted({
      bookId: "book-alpha",
      createdAt: "2026-03-05T18:30:00.000Z",
      finishedAt: "2026-03-05",
      id: "act-alpha",
      recorded: alphaRecorded,
    }),
  ];
}

const created = goalCreated({ createdAt: "2026-03-01T09:00:00.000Z", id: "act-created" });

const backdatedHistory = [
  created,
  bookCounted({
    bookId: "book-march",
    createdAt: "2026-03-02T10:00:00.000Z",
    finishedAt: "2026-03-01",
    id: "act-march",
    recorded: 1,
  }),
  bookCounted({
    bookId: "book-april",
    createdAt: "2026-04-06T10:00:00.000Z",
    finishedAt: "2026-04-05",
    id: "act-april",
    recorded: 2,
  }),
  bookCounted({
    bookId: "book-backdated",
    createdAt: "2026-04-08T10:00:00.000Z",
    finishedAt: "2026-02-10",
    id: "act-backdated",
    recorded: 1,
  }),
];

describe("replayReadingGoalCountedOrdinals corrections", () => {
  it("renumbers two books finished the same day in the order they were recorded", () => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: sameDayPair({ alphaRecorded: 1 }),
      countedTotal: 2,
    });

    expect(replayedCounts(replay)).toStrictEqual({ "act-alpha": 2, "act-zeta": 1 });
  });

  it("reports each recorded value next to its replayed one", () => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: sameDayPair({ alphaRecorded: 1 }),
      countedTotal: 2,
    });

    expect(replay).toStrictEqual({
      ordinals: [
        { activityId: "act-zeta", completedCount: 1, recordedCompletedCount: 1 },
        { activityId: "act-alpha", completedCount: 2, recordedCompletedCount: 1 },
      ],
      status: "replayed",
    });
  });

  it("counts a backdated book as the next total rather than by its reading date", () => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: backdatedHistory,
      countedTotal: 3,
    });

    expect(replayedCounts(replay)).toStrictEqual({
      "act-april": 2,
      "act-backdated": 3,
      "act-march": 1,
    });
  });

  it("replays rows by createdAt whatever order they arrive in", () => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: [...backdatedHistory].reverse(),
      countedTotal: 3,
    });

    expect(replayedCounts(replay)).toStrictEqual({
      "act-april": 2,
      "act-backdated": 3,
      "act-march": 1,
    });
  });

  it("counts a recounted book as the total at the moment it comes back", () => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: [
        created,
        bookCounted({
          bookId: "book-a",
          createdAt: "2026-03-02T10:00:00.000Z",
          finishedAt: "2026-03-01",
          id: "act-a",
          recorded: 1,
        }),
        bookCounted({
          bookId: "book-b",
          createdAt: "2026-03-03T10:00:00.000Z",
          finishedAt: "2026-02-20",
          id: "act-b-first",
          recorded: 1,
        }),
        bookUncounted({
          bookId: "book-b",
          createdAt: "2026-03-04T10:00:00.000Z",
          id: "act-b-out",
        }),
        goalActivity({
          createdAt: "2026-03-05T10:00:00.000Z",
          id: "act-target",
          type: "target_changed",
        }),
        bookCounted({
          bookId: "book-b",
          createdAt: "2026-03-06T10:00:00.000Z",
          finishedAt: "2026-02-20",
          id: "act-b-again",
          recorded: 1,
        }),
      ],
      countedTotal: 2,
    });

    expect(replayedCounts(replay)).toStrictEqual({
      "act-a": 1,
      "act-b-again": 2,
      "act-b-first": 2,
    });
  });

  it("numbers the books of a newly created goal from one, by reading date then book id", () => {
    const createdAt = "2026-03-01T09:00:00.000Z";
    const counted = (bookId: string, finishedAt: string, id: string) =>
      bookCounted({ bookId, createdAt, finishedAt, id, recorded: 1 });
    const replay = replayReadingGoalCountedOrdinals({
      activities: [
        counted("book-d", "2026-02-27", "act-1"),
        counted("book-c", "2026-02-14", "act-2"),
        goalCreated({ createdAt, id: "act-9" }),
        counted("book-a", "2026-02-14", "act-3"),
        counted("book-b", "2026-02-03", "act-4"),
      ],
      countedTotal: 4,
    });

    expect(replayedCounts(replay)).toStrictEqual({
      "act-1": 4,
      "act-2": 3,
      "act-3": 2,
      "act-4": 1,
    });
  });

  it("applies an uncount before the counts recorded in the same operation", () => {
    const sameOperation = "2026-03-10T12:00:00.000Z";
    const replay = replayReadingGoalCountedOrdinals({
      activities: [
        created,
        bookCounted({
          bookId: "book-a",
          createdAt: "2026-03-02T10:00:00.000Z",
          finishedAt: "2026-03-01",
          id: "act-a",
          recorded: 1,
        }),
        bookCounted({
          bookId: "book-d",
          createdAt: sameOperation,
          finishedAt: "2026-03-09",
          id: "act-d",
          recorded: 2,
        }),
        bookCounted({
          bookId: "book-c",
          createdAt: sameOperation,
          finishedAt: "2026-03-08",
          id: "act-c",
          recorded: 1,
        }),
        bookUncounted({ bookId: "book-a", createdAt: sameOperation, id: "act-z-uncount" }),
      ],
      countedTotal: 2,
    });

    expect(replayedCounts(replay)).toStrictEqual({ "act-a": 1, "act-c": 1, "act-d": 2 });
  });

  it("orders a deleted book by reading date when it shares an operation but not a day", () => {
    const sameOperation = "2026-03-10T12:00:00.000Z";
    const replay = replayReadingGoalCountedOrdinals({
      activities: [
        created,
        bookCounted({
          bookId: null,
          createdAt: sameOperation,
          finishedAt: "2026-03-09",
          id: "act-deleted",
          recorded: 1,
        }),
        bookCounted({
          bookId: "book-a",
          createdAt: sameOperation,
          finishedAt: "2026-03-08",
          id: "act-live",
          recorded: 2,
        }),
      ],
      countedTotal: 2,
    });

    expect(replayedCounts(replay)).toStrictEqual({ "act-deleted": 2, "act-live": 1 });
  });

  it("orders a deleted book by recording time when it shares a day but not an operation", () => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: [
        created,
        bookCounted({
          bookId: "book-a",
          createdAt: "2026-03-10T13:00:00.000Z",
          finishedAt: "2026-03-09",
          id: "act-a-live",
          recorded: 1,
        }),
        bookCounted({
          bookId: null,
          createdAt: "2026-03-10T12:00:00.000Z",
          finishedAt: "2026-03-09",
          id: "act-z-deleted",
          recorded: 2,
        }),
      ],
      countedTotal: 2,
    });

    expect(replayedCounts(replay)).toStrictEqual({ "act-a-live": 2, "act-z-deleted": 1 });
  });

  it("replays a goal that never counted a book to no ordinals", () => {
    const replay = replayReadingGoalCountedOrdinals({ activities: [created], countedTotal: 0 });

    expect(replay).toStrictEqual({ ordinals: [], status: "replayed" });
  });
});

describe("replayReadingGoalCountedOrdinals idempotency", () => {
  it("replays already-correct rows to exactly their recorded values, so a second run changes nothing", () => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: sameDayPair({ alphaRecorded: 2 }),
      countedTotal: 2,
    });

    expect(replay).toStrictEqual({
      ordinals: [
        { activityId: "act-zeta", completedCount: 1, recordedCompletedCount: 1 },
        { activityId: "act-alpha", completedCount: 2, recordedCompletedCount: 2 },
      ],
      status: "replayed",
    });
  });
});

describe("replayReadingGoalCountedOrdinals skips", () => {
  it("skips a history holding an activity type it does not know", () => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: [
        ...sameDayPair({ alphaRecorded: 1 }),
        goalActivity({ createdAt: "2026-03-06T10:00:00.000Z", id: "act-odd", type: "goal_paused" }),
      ],
      countedTotal: 2,
    });

    expect(replay).toStrictEqual({
      skip: { activityId: "act-odd", reason: "unknown_activity_type", type: "goal_paused" },
      status: "skipped",
    });
  });

  it.each([
    { label: "no metadata", metadata: null },
    { label: "no finishedAt", metadata: { completedCount: 1 } },
    { label: "a textual count", metadata: { completedCount: "1", finishedAt: "2026-03-05" } },
    {
      label: "a finishedAt with a time",
      metadata: { completedCount: 1, finishedAt: "2026-03-05T10:00:00.000Z" },
    },
  ])("skips a book_counted row with $label", ({ metadata }) => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: [
        created,
        {
          bookId: "book-a",
          createdAt: new Date("2026-03-05T18:00:00.000Z"),
          id: "act-malformed",
          metadata,
          type: "book_counted",
        },
      ],
      countedTotal: 1,
    });

    expect(replay).toStrictEqual({
      skip: { activityId: "act-malformed", reason: "unknown_metadata_shape" },
      status: "skipped",
    });
  });

  it("skips a history that has no goal_created", () => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: sameDayPair({ alphaRecorded: 2 }).filter((row) => row !== created),
      countedTotal: 2,
    });

    expect(replay).toStrictEqual({
      skip: { activityId: "act-zeta", reason: "missing_goal_created" },
      status: "skipped",
    });
  });

  it("skips a history whose first count was recorded before its goal_created", () => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: [
        bookCounted({
          bookId: "book-a",
          createdAt: "2026-02-28T10:00:00.000Z",
          finishedAt: "2026-02-27",
          id: "act-early",
          recorded: 1,
        }),
        created,
      ],
      countedTotal: 1,
    });

    expect(replay).toStrictEqual({
      skip: { activityId: "act-early", reason: "missing_goal_created" },
      status: "skipped",
    });
  });

  it("skips a history that uncounts a book it never counted", () => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: [
        created,
        bookUncounted({ bookId: "book-a", createdAt: "2026-03-04T10:00:00.000Z", id: "act-out" }),
      ],
      countedTotal: 0,
    });

    expect(replay).toStrictEqual({
      skip: { activityId: "act-out", reason: "negative_running_count" },
      status: "skipped",
    });
  });

  it("skips a history whose replayed count disagrees with the books counted today", () => {
    const replay = replayReadingGoalCountedOrdinals({
      activities: sameDayPair({ alphaRecorded: 2 }),
      countedTotal: 3,
    });

    expect(replay).toStrictEqual({
      skip: { countedTotal: 3, reason: "final_count_mismatch", replayedCount: 2 },
      status: "skipped",
    });
  });

  it.each([
    { label: "two deleted books", otherBookId: null },
    { label: "a deleted book and a live one", otherBookId: "book-a" },
  ])("skips a history where $label tie on operation and reading day", ({ otherBookId }) => {
    const sameOperation = "2026-03-10T12:00:00.000Z";
    const replay = replayReadingGoalCountedOrdinals({
      activities: [
        created,
        bookCounted({
          bookId: null,
          createdAt: sameOperation,
          finishedAt: "2026-03-09",
          id: "act-deleted",
          recorded: 1,
        }),
        bookCounted({
          bookId: otherBookId,
          createdAt: sameOperation,
          finishedAt: "2026-03-09",
          id: "act-other",
          recorded: 2,
        }),
      ],
      countedTotal: 2,
    });

    expect(replay).toStrictEqual({
      skip: expect.objectContaining({ reason: "ambiguous_deleted_book_tie" }),
      status: "skipped",
    });
  });
});
