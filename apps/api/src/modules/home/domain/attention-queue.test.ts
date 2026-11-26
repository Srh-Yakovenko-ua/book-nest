import type { HomeAttentionGroup, Nullable, QueuePriorityReason } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { QueueDeadlineEntry } from "./attention-queue.js";

import { buildQueueDeadlineAttention } from "./attention-queue.js";

const TODAY = "2026-11-24";

const NO_LOANS_DUE: ReadonlySet<string> = new Set();

function deadlineGroups(entries: QueueDeadlineEntry[]): HomeAttentionGroup[] {
  return buildQueueDeadlineAttention({ entries, loanDueBookIds: NO_LOANS_DUE, today: TODAY });
}

function queueEntry({
  index,
  queuePriorityReason = "book_club",
  targetDate,
}: {
  index: number;
  queuePriorityReason?: Nullable<QueuePriorityReason>;
  targetDate: string;
}): QueueDeadlineEntry {
  return { id: uuidOf(index), queuePriorityReason, targetDate, title: `Queued book ${index}` };
}

function queueReasonsOf(groups: HomeAttentionGroup[]): QueuePriorityReason[][] {
  return groups.flatMap((group) => (group.reason === "queue_deadline" ? [group.queueReasons] : []));
}

function uuidOf(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

describe("buildQueueDeadlineAttention", () => {
  it.each([
    ["today", "2026-11-24"],
    ["tomorrow", "2026-11-25"],
  ])("raises a deadline due %s as high", (_label, targetDate) => {
    expect(deadlineGroups([queueEntry({ index: 1, targetDate })])).toEqual([
      expect.objectContaining({
        count: 1,
        reason: "queue_deadline",
        severity: "high",
        unit: "books",
      }),
    ]);
  });

  it.each([
    ["in two days", "2026-11-26"],
    ["in seven days", "2026-12-01"],
  ])("raises a deadline due %s as medium", (_label, targetDate) => {
    expect(deadlineGroups([queueEntry({ index: 1, targetDate })])).toEqual([
      expect.objectContaining({ count: 1, reason: "queue_deadline", severity: "medium" }),
    ]);
  });

  it.each([
    ["yesterday", "2026-11-23"],
    ["in eight days", "2026-12-02"],
  ])("raises nothing for a deadline %s", (_label, targetDate) => {
    expect(deadlineGroups([queueEntry({ index: 1, targetDate })])).toEqual([]);
  });

  it("groups deadlines per severity", () => {
    const groups = deadlineGroups([
      queueEntry({ index: 1, targetDate: "2026-11-24" }),
      queueEntry({ index: 2, targetDate: "2026-11-28" }),
      queueEntry({ index: 3, targetDate: "2026-11-25" }),
      queueEntry({ index: 4, targetDate: "2026-11-30" }),
      queueEntry({ index: 5, targetDate: "2026-11-27" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ count: 2, severity: "high" }),
        expect.objectContaining({ count: 3, severity: "medium" }),
      ]),
    );
  });

  it("dates each group by its earliest deadline", () => {
    const groups = deadlineGroups([
      queueEntry({ index: 1, targetDate: "2026-11-30" }),
      queueEntry({ index: 2, targetDate: "2026-11-25" }),
      queueEntry({ index: 3, targetDate: "2026-11-27" }),
      queueEntry({ index: 4, targetDate: "2026-11-24" }),
    ]);

    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dueDate: "2026-11-24", severity: "high" }),
        expect.objectContaining({ dueDate: "2026-11-27", severity: "medium" }),
      ]),
    );
  });

  it("lists each queue reason of a group once", () => {
    const groups = deadlineGroups([
      queueEntry({ index: 1, queuePriorityReason: "buddy_read", targetDate: "2026-11-24" }),
      queueEntry({ index: 2, queuePriorityReason: "book_club", targetDate: "2026-11-25" }),
      queueEntry({ index: 3, queuePriorityReason: "buddy_read", targetDate: "2026-11-25" }),
    ]);
    const [reasons] = queueReasonsOf(groups);

    expect(reasons).toHaveLength(2);
    expect(new Set(reasons)).toEqual(new Set(["book_club", "buddy_read"]));
  });

  it("drops a queued book whose borrowed loan is already due", () => {
    const groups = buildQueueDeadlineAttention({
      entries: [
        queueEntry({ index: 1, queuePriorityReason: "return_due", targetDate: "2026-11-25" }),
      ],
      loanDueBookIds: new Set([uuidOf(1)]),
      today: TODAY,
    });

    expect(groups).toEqual([]);
  });

  it("keeps the other queued books when one of them has a due loan", () => {
    const groups = buildQueueDeadlineAttention({
      entries: [
        queueEntry({ index: 1, queuePriorityReason: "return_due", targetDate: "2026-11-25" }),
        queueEntry({ index: 2, targetDate: "2026-11-25" }),
      ],
      loanDueBookIds: new Set([uuidOf(1)]),
      today: TODAY,
    });

    expect(groups).toEqual([expect.objectContaining({ count: 1, severity: "high" })]);
  });
});
