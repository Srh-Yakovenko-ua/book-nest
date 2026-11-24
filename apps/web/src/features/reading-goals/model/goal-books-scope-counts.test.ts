import { describe, expect, it } from "vitest";

import { goalBooksScopeCounts } from "./goal-books-scope-counts";

describe("goalBooksScopeCounts", () => {
  it.each([
    {
      behavior: "splits the snapshot into counted and remaining books",
      completedCount: 5,
      expected: { all: 8, counted: 5, remaining: 3 },
      snapshotBookCount: 8,
    },
    {
      behavior: "leaves nothing remaining once every snapshot book is counted",
      completedCount: 8,
      expected: { all: 8, counted: 8, remaining: 0 },
      snapshotBookCount: 8,
    },
    {
      behavior: "never goes below zero remaining when counted books outnumber the snapshot",
      completedCount: 8,
      expected: { all: 6, counted: 8, remaining: 0 },
      snapshotBookCount: 6,
    },
    {
      behavior: "keeps every scope at zero for an empty snapshot",
      completedCount: 0,
      expected: { all: 0, counted: 0, remaining: 0 },
      snapshotBookCount: 0,
    },
  ])("$behavior", ({ completedCount, expected, snapshotBookCount }) => {
    expect(goalBooksScopeCounts({ completedCount, snapshotBookCount })).toEqual(expected);
  });
});
