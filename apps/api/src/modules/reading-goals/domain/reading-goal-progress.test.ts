import { describe, expect, it } from "vitest";

import type { ReadingGoalCandidateBook } from "./reading-goal-progress.js";

import {
  calculateReadingGoalProgress,
  qualifiesForReadingGoal,
  resolveReadingGoalResult,
  resolveReadingGoalStatus,
  selectQualifyingReadingGoalBooks,
} from "./reading-goal-progress.js";

const now = new Date("2026-08-08T18:30:00.000Z");
const goalStartDate = new Date("2026-08-01T00:00:00.000Z");

function book(bookId: string, finishedAt: null | string): ReadingGoalCandidateBook {
  return { bookId, finishedAt: finishedAt === null ? null : new Date(finishedAt) };
}

describe("resolveReadingGoalStatus", () => {
  it("is active while the target is unmet and the deadline is still ahead", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: null,
        completedCount: 1,
        deadline: new Date("2026-08-20T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("active");
  });

  it("is active when the deadline falls exactly on the current UTC day", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: null,
        completedCount: 1,
        deadline: new Date("2026-08-08T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("active");
  });

  it("is completed once the counted books exactly meet the target", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: null,
        completedCount: 3,
        deadline: new Date("2026-08-20T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("completed");
  });

  it("is expired when the deadline is before the current UTC day and the target is unmet", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: null,
        completedCount: 2,
        deadline: new Date("2026-08-07T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("expired");
  });

  it("is archived when archivedAt is set", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: new Date("2026-08-05T09:00:00.000Z"),
        completedCount: 1,
        deadline: new Date("2026-08-20T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("archived");
  });

  it("prefers completed over expired when the target was met after the deadline passed", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: null,
        completedCount: 3,
        deadline: new Date("2026-08-01T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("completed");
  });

  it("prefers archived over completed when an archived goal has met its target", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: new Date("2026-08-05T09:00:00.000Z"),
        completedCount: 4,
        deadline: new Date("2026-08-20T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("archived");
  });

  it("prefers archived over expired when an archived goal is past its deadline", () => {
    expect(
      resolveReadingGoalStatus({
        archivedAt: new Date("2026-08-05T09:00:00.000Z"),
        completedCount: 0,
        deadline: new Date("2026-08-01T00:00:00.000Z"),
        now,
        targetCount: 3,
      }),
    ).toBe("archived");
  });
});

describe("qualifiesForReadingGoal", () => {
  it("rejects a book that was never finished", () => {
    expect(
      qualifiesForReadingGoal({
        countingEndsAt: new Date("2026-08-20T00:00:00.000Z"),
        finishedAt: null,
        goalStartDate,
      }),
    ).toBe(false);
  });

  it("rejects a book finished the day before the goal started", () => {
    expect(
      qualifiesForReadingGoal({
        countingEndsAt: new Date("2026-08-20T00:00:00.000Z"),
        finishedAt: new Date("2026-07-31T23:00:00.000Z"),
        goalStartDate,
      }),
    ).toBe(false);
  });

  it("rejects a book finished the day after the window closed", () => {
    expect(
      qualifiesForReadingGoal({
        countingEndsAt: new Date("2026-08-10T00:00:00.000Z"),
        finishedAt: new Date("2026-08-11T09:00:00.000Z"),
        goalStartDate,
      }),
    ).toBe(false);
  });
});

describe("selectQualifyingReadingGoalBooks", () => {
  it("orders by finishedAt ascending and breaks ties on bookId ascending", () => {
    const qualifying = selectQualifyingReadingGoalBooks({
      books: [
        book("book-c", "2026-08-05T10:00:00.000Z"),
        book("book-b", "2026-08-02T10:00:00.000Z"),
        book("book-a", "2026-08-02T10:00:00.000Z"),
      ],
      countingEndsAt: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
    });

    expect(qualifying.map((entry) => entry.bookId)).toEqual(["book-a", "book-b", "book-c"]);
  });

  it("drops books outside the qualification window", () => {
    const qualifying = selectQualifyingReadingGoalBooks({
      books: [
        book("too-early", "2026-07-25T10:00:00.000Z"),
        book("unfinished", null),
        book("too-late", "2026-08-21T10:00:00.000Z"),
        book("counted", "2026-08-04T10:00:00.000Z"),
      ],
      countingEndsAt: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
    });

    expect(qualifying.map((entry) => entry.bookId)).toEqual(["counted"]);
  });
});

describe("calculateReadingGoalProgress hard deadline boundaries", () => {
  const deadline = new Date("2026-08-20T00:00:00.000Z");

  it("counts a book finished on the goal creation date", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [book("book-1", "2026-08-01T22:00:00.000Z")],
      deadline,
      goalStartDate,
      now,
      targetCount: 3,
    });

    expect(progress.completedCount).toBe(1);
  });

  it("counts a book finished on the deadline itself", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [book("book-1", "2026-08-20T23:59:00.000Z")],
      deadline,
      goalStartDate,
      now: new Date("2026-08-21T09:00:00.000Z"),
      targetCount: 3,
    });

    expect(progress.completedCount).toBe(1);
  });

  it("does not count a book finished the day after the deadline", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [book("book-1", "2026-08-21T00:00:00.000Z")],
      deadline,
      goalStartDate,
      now: new Date("2026-08-22T09:00:00.000Z"),
      targetCount: 3,
    });

    expect(progress.completedCount).toBe(0);
  });

  it("completes the goal when the target is reached exactly on the deadline", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [
        book("book-1", "2026-08-10T10:00:00.000Z"),
        book("book-2", "2026-08-20T18:00:00.000Z"),
      ],
      deadline,
      goalStartDate,
      now: new Date("2026-08-20T20:00:00.000Z"),
      targetCount: 2,
    });

    expect(progress.status).toBe("completed");
    expect(progress.completedAt).toEqual(new Date("2026-08-20T18:00:00.000Z"));
  });

  it("expires the goal the day after an unreached deadline", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [book("book-1", "2026-08-10T10:00:00.000Z")],
      deadline,
      goalStartDate,
      now: new Date("2026-08-21T00:30:00.000Z"),
      targetCount: 2,
    });

    expect(progress.status).toBe("expired");
  });

  it("leaves an expired goal expired when another book is finished after the deadline", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [
        book("book-1", "2026-08-10T10:00:00.000Z"),
        book("book-2", "2026-08-25T10:00:00.000Z"),
      ],
      deadline,
      goalStartDate,
      now: new Date("2026-08-26T09:00:00.000Z"),
      targetCount: 2,
    });

    expect(progress.status).toBe("expired");
    expect(progress.completedCount).toBe(1);
    expect(progress.completedAt).toBeNull();
  });
});

describe("calculateReadingGoalProgress archived window", () => {
  const deadline = new Date("2026-08-20T00:00:00.000Z");
  const archivedAt = new Date("2026-08-10T09:00:00.000Z");

  it("counts a book finished on the archiving day itself", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt,
      books: [book("book-1", "2026-08-10T21:00:00.000Z")],
      deadline,
      goalStartDate,
      now: new Date("2026-08-15T09:00:00.000Z"),
      targetCount: 3,
    });

    expect(progress.completedCount).toBe(1);
  });

  it("does not count a book finished after the goal was archived", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt,
      books: [
        book("counted", "2026-08-05T10:00:00.000Z"),
        book("after-archiving", "2026-08-12T10:00:00.000Z"),
      ],
      deadline,
      goalStartDate,
      now: new Date("2026-08-15T09:00:00.000Z"),
      targetCount: 3,
    });

    expect(progress.completedCount).toBe(1);
  });

  it("keeps an archived goal's result frozen when the reader finishes the rest of the list later", () => {
    const beforeTheRest = calculateReadingGoalProgress({
      archivedAt,
      books: [book("book-1", "2026-08-05T10:00:00.000Z")],
      deadline,
      goalStartDate,
      now: new Date("2026-08-11T09:00:00.000Z"),
      targetCount: 3,
    });
    const afterTheRest = calculateReadingGoalProgress({
      archivedAt,
      books: [
        book("book-1", "2026-08-05T10:00:00.000Z"),
        book("book-2", "2026-08-12T10:00:00.000Z"),
        book("book-3", "2026-08-15T10:00:00.000Z"),
      ],
      deadline,
      goalStartDate,
      now: new Date("2026-08-16T09:00:00.000Z"),
      targetCount: 3,
    });

    expect(afterTheRest.completedCount).toBe(beforeTheRest.completedCount);
    expect(afterTheRest.result).toBeNull();
    expect(afterTheRest.status).toBe("archived");
  });

  it("still stops counting at the deadline for a goal archived after it had passed", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: new Date("2026-08-25T09:00:00.000Z"),
      books: [
        book("counted", "2026-08-18T10:00:00.000Z"),
        book("after-deadline", "2026-08-22T10:00:00.000Z"),
      ],
      deadline,
      goalStartDate,
      now: new Date("2026-08-26T09:00:00.000Z"),
      targetCount: 3,
    });

    expect(progress.completedCount).toBe(1);
  });
});

describe("calculateReadingGoalProgress", () => {
  it("reports completedAt as the finish date of the target-th book, not the last one", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [
        book("book-1", "2026-08-01T10:00:00.000Z"),
        book("book-2", "2026-08-02T10:00:00.000Z"),
        book("book-3", "2026-08-03T10:00:00.000Z"),
        book("book-4", "2026-08-04T10:00:00.000Z"),
        book("book-5", "2026-08-05T10:00:00.000Z"),
      ],
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
      now,
      targetCount: 3,
    });

    expect(progress.completedAt).toEqual(new Date("2026-08-03T10:00:00.000Z"));
  });

  it("resolves completedAt through the tie-broken order rather than the input order", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [
        book("book-z", "2026-08-05T10:00:00.000Z"),
        book("book-a", "2026-08-02T10:00:00.000Z"),
      ],
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
      now,
      targetCount: 1,
    });

    expect(progress.completedAt).toEqual(new Date("2026-08-02T10:00:00.000Z"));
  });

  it("leaves completedAt null while fewer books than the target are counted", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [book("book-1", "2026-08-01T10:00:00.000Z")],
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
      now,
      targetCount: 3,
    });

    expect(progress.completedAt).toBeNull();
  });

  it("counts only the books inside the window, so a book finished before the start never lands in completedCount", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [
        book("before", "2026-07-20T09:00:00.000Z"),
        book("inside", "2026-08-08T09:00:00.000Z"),
      ],
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
      now,
      targetCount: 3,
    });

    expect(progress.completedCount).toBe(1);
  });

  it("returns remainingCount zero rather than a negative number when the target is exceeded", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [
        book("book-1", "2026-08-01T10:00:00.000Z"),
        book("book-2", "2026-08-02T10:00:00.000Z"),
        book("book-3", "2026-08-03T10:00:00.000Z"),
        book("book-4", "2026-08-04T10:00:00.000Z"),
      ],
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
      now,
      targetCount: 2,
    });

    expect(progress.remainingCount).toBe(0);
  });

  it("counts the books still owed while the goal is active", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [book("book-1", "2026-08-01T10:00:00.000Z")],
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
      now,
      targetCount: 4,
    });

    expect(progress.remainingCount).toBe(3);
  });

  it("reports daysLeft as zero when the deadline is the current UTC day", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [],
      deadline: new Date("2026-08-08T00:00:00.000Z"),
      goalStartDate,
      now,
      targetCount: 3,
    });

    expect(progress.daysLeft).toBe(0);
  });

  it("stops counting daysLeft once the goal is expired", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [],
      deadline: new Date("2026-08-05T00:00:00.000Z"),
      goalStartDate,
      now,
      targetCount: 3,
    });

    expect(progress.status).toBe("expired");
    expect(progress.daysLeft).toBeNull();
  });

  it("stops counting daysLeft once the goal is completed", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [
        book("book-1", "2026-08-01T10:00:00.000Z"),
        book("book-2", "2026-08-02T10:00:00.000Z"),
      ],
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
      now,
      targetCount: 2,
    });

    expect(progress.status).toBe("completed");
    expect(progress.daysLeft).toBeNull();
  });

  it("stops counting daysLeft once the goal is archived", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: new Date("2026-08-06T12:00:00.000Z"),
      books: [],
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
      now,
      targetCount: 3,
    });

    expect(progress.status).toBe("archived");
    expect(progress.daysLeft).toBeNull();
  });

  it("never reaches the negative branch of daysLeft, because the deadline day is the last active day", () => {
    const onTheDeadline = calculateReadingGoalProgress({
      archivedAt: null,
      books: [],
      deadline: new Date("2026-08-08T00:00:00.000Z"),
      goalStartDate,
      now,
      targetCount: 3,
    });
    const dayAfterTheDeadline = calculateReadingGoalProgress({
      archivedAt: null,
      books: [],
      deadline: new Date("2026-08-08T00:00:00.000Z"),
      goalStartDate,
      now: new Date("2026-08-09T00:30:00.000Z"),
      targetCount: 3,
    });

    expect(onTheDeadline).toMatchObject({ daysLeft: 0, status: "active" });
    expect(dayAfterTheDeadline).toMatchObject({ daysLeft: null, status: "expired" });
  });

  it("derives daysLeft from the UTC day boundary rather than the moment of day", () => {
    const earlyMorning = calculateReadingGoalProgress({
      archivedAt: null,
      books: [],
      deadline: new Date("2026-08-12T00:00:00.000Z"),
      goalStartDate,
      now: new Date("2026-08-08T00:00:01.000Z"),
      targetCount: 3,
    });
    const lateEvening = calculateReadingGoalProgress({
      archivedAt: null,
      books: [],
      deadline: new Date("2026-08-12T00:00:00.000Z"),
      goalStartDate,
      now: new Date("2026-08-08T23:59:59.000Z"),
      targetCount: 3,
    });

    expect(earlyMorning.daysLeft).toBe(lateEvening.daysLeft);
  });
});

describe("resolveReadingGoalResult", () => {
  const deadline = new Date("2026-08-20T00:00:00.000Z");

  it("is null while the goal is still active", () => {
    expect(
      resolveReadingGoalResult({
        archivedAt: null,
        completedCount: 1,
        deadline,
        now,
        targetCount: 3,
      }),
    ).toBeNull();
  });

  it("is completed once the qualifying count reaches the target", () => {
    expect(
      resolveReadingGoalResult({
        archivedAt: null,
        completedCount: 3,
        deadline,
        now,
        targetCount: 3,
      }),
    ).toBe("completed");
  });

  it("is expired when the target is unmet and the deadline has passed", () => {
    expect(
      resolveReadingGoalResult({
        archivedAt: null,
        completedCount: 2,
        deadline,
        now: new Date("2026-08-21T09:00:00.000Z"),
        targetCount: 3,
      }),
    ).toBe("expired");
  });

  it("is completed for an archived goal that met its target", () => {
    expect(
      resolveReadingGoalResult({
        archivedAt: new Date("2026-08-10T09:00:00.000Z"),
        completedCount: 3,
        deadline,
        now: new Date("2026-09-30T09:00:00.000Z"),
        targetCount: 3,
      }),
    ).toBe("completed");
  });

  it("freezes at archivedAt, so a goal archived incomplete before its deadline stays null", () => {
    expect(
      resolveReadingGoalResult({
        archivedAt: new Date("2026-08-10T09:00:00.000Z"),
        completedCount: 1,
        deadline,
        now: new Date("2026-09-30T09:00:00.000Z"),
        targetCount: 3,
      }),
    ).toBeNull();
  });

  it("is expired for a goal archived after its deadline had already passed", () => {
    expect(
      resolveReadingGoalResult({
        archivedAt: new Date("2026-08-25T09:00:00.000Z"),
        completedCount: 1,
        deadline,
        now: new Date("2026-09-30T09:00:00.000Z"),
        targetCount: 3,
      }),
    ).toBe("expired");
  });
});

describe("calculateReadingGoalProgress result", () => {
  it("reports an archived goal that met its target as archived with a completed result", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: new Date("2026-08-10T09:00:00.000Z"),
      books: [
        book("book-1", "2026-08-02T10:00:00.000Z"),
        book("book-2", "2026-08-03T10:00:00.000Z"),
      ],
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
      now: new Date("2026-09-30T09:00:00.000Z"),
      targetCount: 2,
    });

    expect(progress.status).toBe("archived");
    expect(progress.result).toBe("completed");
  });

  it("reports an active goal with no result yet", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [book("book-1", "2026-08-02T10:00:00.000Z")],
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
      now,
      targetCount: 3,
    });

    expect(progress.status).toBe("active");
    expect(progress.result).toBeNull();
  });

  it("reports an expired goal with an expired result", () => {
    const progress = calculateReadingGoalProgress({
      archivedAt: null,
      books: [book("book-1", "2026-08-02T10:00:00.000Z")],
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      goalStartDate,
      now: new Date("2026-08-21T09:00:00.000Z"),
      targetCount: 3,
    });

    expect(progress.status).toBe("expired");
    expect(progress.result).toBe("expired");
  });
});
