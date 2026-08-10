import type { ReadingStatus } from "@app/shared";

import { ReadingStatusSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import { resolveListBookStatuses, TAB_STATUSES, toListStatusCounts } from "./list-status-counts.js";

describe("TAB_STATUSES", () => {
  it("counts a wanted book as not started", () => {
    expect(TAB_STATUSES.not_started).toEqual(["not_started", "want_to_read"]);
  });

  it("counts a reread as currently reading", () => {
    expect(TAB_STATUSES.reading).toEqual(["reading", "rereading"]);
  });

  it("counts only a finished book as finished", () => {
    expect(TAB_STATUSES.finished).toEqual(["finished"]);
  });

  it("asks for no status at all on the all tab", () => {
    expect(TAB_STATUSES.all).toBeUndefined();
  });

  it("leaves exactly the paused and abandoned books outside every tab", () => {
    const covered = new Set<ReadingStatus>(
      Object.values(TAB_STATUSES).flatMap((statuses) => statuses ?? []),
    );

    expect(ReadingStatusSchema.options.filter((status) => !covered.has(status))).toEqual([
      "paused",
      "dnf",
    ]);
  });
});

describe("resolveListBookStatuses", () => {
  it("keeps an explicit status selection instead of the statuses of the active tab", () => {
    expect(resolveListBookStatuses({ status: ["paused"], tab: "reading" })).toEqual(["paused"]);
  });

  it("keeps an explicit status selection even on the all tab", () => {
    expect(resolveListBookStatuses({ status: ["dnf"], tab: "all" })).toEqual(["dnf"]);
  });

  it("falls back to the tab when the status selection is cleared", () => {
    expect(resolveListBookStatuses({ status: [], tab: "reading" })).toEqual([
      "reading",
      "rereading",
    ]);
  });

  it("falls back to the tab when no status is selected", () => {
    expect(resolveListBookStatuses({ status: undefined, tab: "not_started" })).toEqual([
      "not_started",
      "want_to_read",
    ]);
  });

  it("resolves the finished tab to the finished status", () => {
    expect(resolveListBookStatuses({ status: undefined, tab: "finished" })).toEqual(["finished"]);
  });

  it("filters by no status on the all tab so every book of the list stays visible", () => {
    expect(resolveListBookStatuses({ status: [], tab: "all" })).toBeUndefined();
  });
});

describe("toListStatusCounts", () => {
  it("reports the not started counter under the snake case response key", () => {
    expect(toListStatusCounts({ all: 9, finished: 4, notStarted: 3, reading: 2 })).toEqual({
      all: 9,
      finished: 4,
      not_started: 3,
      reading: 2,
    });
  });

  it("reports the whole list as the total even though the tab counters add up to less", () => {
    const counts = toListStatusCounts({ all: 12, finished: 4, notStarted: 3, reading: 2 });

    expect(counts.all).toBe(12);
    expect(counts.finished + counts.not_started + counts.reading).toBe(9);
  });
});
