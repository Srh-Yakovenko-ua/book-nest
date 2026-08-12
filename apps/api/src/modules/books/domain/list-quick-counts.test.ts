import type { ReadingStatus } from "@app/shared";

import { LIST_TAB_READING_STATUSES, ReadingStatusSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import { resolveListBookStatuses, toListQuickCountsView } from "./list-quick-counts.js";

const COUNTS = {
  all: 9,
  favorites: 5,
  finished: 4,
  inQueue: 6,
  notStarted: 3,
  reading: 2,
  series: 7,
};

describe("LIST_TAB_READING_STATUSES", () => {
  it("counts a wanted book as not started", () => {
    expect(LIST_TAB_READING_STATUSES.not_started).toEqual(["not_started", "want_to_read"]);
  });

  it("counts a reread as currently reading", () => {
    expect(LIST_TAB_READING_STATUSES.reading).toEqual(["reading", "rereading"]);
  });

  it("counts only a finished book as finished", () => {
    expect(LIST_TAB_READING_STATUSES.finished).toEqual(["finished"]);
  });

  it("asks for no status at all on the all tab", () => {
    expect(LIST_TAB_READING_STATUSES.all).toBeUndefined();
  });

  it("leaves exactly the paused and abandoned books outside every tab", () => {
    const covered = new Set<ReadingStatus>(
      Object.values(LIST_TAB_READING_STATUSES).flatMap((statuses) => statuses ?? []),
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

describe("toListQuickCountsView", () => {
  it("reports the multi word counters under their snake case response keys", () => {
    expect(toListQuickCountsView(COUNTS)).toEqual({
      all: 9,
      favorites: 5,
      finished: 4,
      in_queue: 6,
      not_started: 3,
      reading: 2,
      series: 7,
    });
  });

  it("reports the whole list as the total even though the reading counters add up to less", () => {
    const counts = toListQuickCountsView({ ...COUNTS, all: 12 });

    expect(counts.all).toBe(12);
    expect(counts.finished + counts.not_started + counts.reading).toBe(9);
  });

  it("leaves the favourite, queued and series counters free to overlap the reading counters", () => {
    const counts = toListQuickCountsView({ ...COUNTS, all: 9 });

    expect(counts.favorites + counts.in_queue + counts.series).toBeGreaterThan(counts.all);
  });
});
