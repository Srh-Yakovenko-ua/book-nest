import type { Nullable, ReadingStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import { resolveGoalBookState } from "./goal-book-state";
import { makeReadingGoalBook } from "./reading-goals.fixtures";

function uncountedBook({
  currentPage,
  pagesCount,
  status,
}: {
  currentPage: number;
  pagesCount: Nullable<number>;
  status: ReadingStatus;
}) {
  return makeReadingGoalBook({
    countedFinishedAt: null,
    qualifies: false,
    reading: { currentPage, finishedAt: null, pagesCount, startedAt: "2026-10-20", status },
  });
}

describe("resolveGoalBookState", () => {
  it("treats a qualifying book as counted even while it is being read", () => {
    const book = makeReadingGoalBook({
      countedFinishedAt: "2026-11-03",
      qualifies: true,
      reading: {
        currentPage: 123,
        finishedAt: null,
        pagesCount: 368,
        startedAt: "2026-11-10",
        status: "reading",
      },
    });

    expect(resolveGoalBookState(book)).toEqual({
      countedFinishedAt: "2026-11-03",
      kind: "counted",
    });
  });

  it.each([
    { behavior: "rounds a share down", currentPage: 123, expectedPercent: 33 },
    { behavior: "rounds a share up", currentPage: 245, expectedPercent: 67 },
    {
      behavior: "caps a current page past the page count at 100",
      currentPage: 400,
      expectedPercent: 100,
    },
  ])("$behavior when the page count is known", ({ currentPage, expectedPercent }) => {
    const book = uncountedBook({ currentPage, pagesCount: 368, status: "reading" });

    expect(resolveGoalBookState(book)).toEqual({
      kind: "in-progress",
      pages: { current: currentPage, kind: "with-total", percent: expectedPercent, total: 368 },
      status: "reading",
    });
  });

  it.each([
    { behavior: "a missing page count", pagesCount: null },
    { behavior: "a zero page count", pagesCount: 0 },
  ])("shows only the current page for $behavior", ({ pagesCount }) => {
    const book = uncountedBook({ currentPage: 57, pagesCount, status: "reading" });

    expect(resolveGoalBookState(book)).toEqual({
      kind: "in-progress",
      pages: { current: 57, kind: "without-total" },
      status: "reading",
    });
  });

  it.each(["paused", "rereading"] as const)("keeps a %s book in progress", (status) => {
    const book = uncountedBook({ currentPage: 123, pagesCount: 368, status });

    expect(resolveGoalBookState(book)).toEqual({
      kind: "in-progress",
      pages: { current: 123, kind: "with-total", percent: 33, total: 368 },
      status,
    });
  });
});
