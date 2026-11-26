import type { ReadingStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import { resolveGoalPrimaryAction } from "./goal-primary-action";
import { makeReadingGoalBook, makeReadingGoalDetail } from "./reading-goals.fixtures";

function remainingBook({ id, status }: { id: string; status: ReadingStatus }) {
  return makeReadingGoalBook({
    countedFinishedAt: null,
    id,
    qualifies: false,
    reading: { currentPage: null, finishedAt: null, pagesCount: 320, startedAt: null, status },
  });
}

describe("resolveGoalPrimaryAction", () => {
  it("continues the first book being read in list order when two are in progress", () => {
    const goal = makeReadingGoalDetail({
      remainingBooks: [
        remainingBook({ id: "book-reading-first", status: "reading" }),
        remainingBook({ id: "book-reading-second", status: "reading" }),
        remainingBook({ id: "book-unread", status: "want_to_read" }),
      ],
      status: "active",
    });

    expect(resolveGoalPrimaryAction(goal)).toEqual({
      bookId: "book-reading-first",
      kind: "continue",
    });
  });

  it("opens the goal's books when no remaining book is being read", () => {
    const goal = makeReadingGoalDetail({
      remainingBooks: [
        remainingBook({ id: "book-finished-early", status: "finished" }),
        remainingBook({ id: "book-wanted", status: "want_to_read" }),
        remainingBook({ id: "book-not-started", status: "not_started" }),
      ],
      status: "active",
    });

    expect(resolveGoalPrimaryAction(goal)).toEqual({ kind: "books" });
  });

  it.each(["completed", "expired", "archived"] as const)(
    "offers no action for a %s goal even with a book being read",
    (status) => {
      const goal = makeReadingGoalDetail({
        remainingBooks: [remainingBook({ id: "book-reading", status: "reading" })],
        status,
      });

      expect(resolveGoalPrimaryAction(goal)).toBeNull();
    },
  );
});
