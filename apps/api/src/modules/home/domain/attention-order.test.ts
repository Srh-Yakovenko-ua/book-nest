import type { HomeAttentionGroup, HomeAttentionSeverity, Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import { sortAttentionGroups } from "./attention-order.js";

function idsOf(groups: readonly HomeAttentionGroup[]): string[] {
  return groups.map((group) => group.id);
}

function overdueLoanGroup({ id }: { id: string }): HomeAttentionGroup {
  return {
    count: 1,
    direction: "borrowed_from_someone",
    dueDate: null,
    id,
    reason: "loan_overdue",
    severity: "medium",
    unit: "books",
  };
}

function seriesGroup({
  count = 1,
  dueDate = null,
  id,
  severity,
}: {
  count?: number;
  dueDate?: Nullable<string>;
  id: string;
  severity: HomeAttentionSeverity;
}): HomeAttentionGroup {
  return {
    count,
    dueDate,
    id,
    reason: "series_order_issue",
    seriesId: null,
    seriesTitle: null,
    severity,
    unit: "issues",
  };
}

describe("sortAttentionGroups", () => {
  it("orders critical before high before medium before low", () => {
    const sorted = sortAttentionGroups([
      seriesGroup({ id: "low", severity: "low" }),
      seriesGroup({ id: "critical", severity: "critical" }),
      seriesGroup({ id: "medium", severity: "medium" }),
      seriesGroup({ id: "high", severity: "high" }),
    ]);

    expect(idsOf(sorted)).toEqual(["critical", "high", "medium", "low"]);
  });

  it("puts severity ahead of an earlier due date", () => {
    const sorted = sortAttentionGroups([
      seriesGroup({ dueDate: "2026-11-24", id: "medium-today", severity: "medium" }),
      seriesGroup({ dueDate: "2026-12-31", id: "high-later", severity: "high" }),
    ]);

    expect(idsOf(sorted)).toEqual(["high-later", "medium-today"]);
  });

  it("orders groups of one severity by due date ascending", () => {
    const sorted = sortAttentionGroups([
      seriesGroup({ dueDate: "2026-11-30", id: "later", severity: "high" }),
      seriesGroup({ dueDate: "2026-11-25", id: "sooner", severity: "high" }),
    ]);

    expect(idsOf(sorted)).toEqual(["sooner", "later"]);
  });

  it("puts a group without a due date after the dated ones", () => {
    const sorted = sortAttentionGroups([
      seriesGroup({ dueDate: null, id: "a-undated", severity: "high" }),
      seriesGroup({ dueDate: "2026-12-20", id: "z-dated", severity: "high" }),
    ]);

    expect(idsOf(sorted)).toEqual(["z-dated", "a-undated"]);
  });

  it("decides by reason before id when severity and due date tie", () => {
    const loanFirstById = sortAttentionGroups([
      overdueLoanGroup({ id: "a" }),
      seriesGroup({ id: "b", severity: "medium" }),
    ]);
    const seriesFirstById = sortAttentionGroups([
      seriesGroup({ id: "a", severity: "medium" }),
      overdueLoanGroup({ id: "b" }),
    ]);

    expect(loanFirstById.map((group) => group.reason)).toEqual(
      seriesFirstById.map((group) => group.reason),
    );
  });

  it("breaks a full tie by id ascending", () => {
    const sorted = sortAttentionGroups([
      seriesGroup({ id: "series_order_issue:b", severity: "low" }),
      seriesGroup({ id: "series_order_issue:a", severity: "low" }),
    ]);

    expect(idsOf(sorted)).toEqual(["series_order_issue:a", "series_order_issue:b"]);
  });

  it("drops a group with nothing to count", () => {
    const sorted = sortAttentionGroups([
      seriesGroup({ count: 0, id: "empty", severity: "critical" }),
      seriesGroup({ id: "kept", severity: "low" }),
    ]);

    expect(idsOf(sorted)).toEqual(["kept"]);
  });
});
