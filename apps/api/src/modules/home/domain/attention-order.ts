import type {
  HomeAttentionGroup,
  HomeAttentionReason,
  HomeAttentionSeverity,
  Nullable,
} from "@app/shared";

import { compareText, SORT_ORDER } from "./compare-text.js";

const SEVERITY_RANK: Record<HomeAttentionSeverity, number> = {
  critical: 0,
  high: 1,
  low: 3,
  medium: 2,
};

const REASON_RANK: Record<HomeAttentionReason, number> = {
  delivery_awaiting_dispatch: 7,
  delivery_delayed: 2,
  delivery_pickup_expiring: 0,
  delivery_ready_for_pickup: 3,
  delivery_unassigned_books: 9,
  goal_at_risk: 5,
  loan_overdue: 1,
  loan_return_soon: 4,
  queue_deadline: 6,
  reading_stale: 10,
  series_order_issue: 8,
};

export function compareAttentionGroups(
  left: HomeAttentionGroup,
  right: HomeAttentionGroup,
): number {
  return (
    SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] ||
    compareDueDates(left.dueDate, right.dueDate) ||
    REASON_RANK[left.reason] - REASON_RANK[right.reason] ||
    compareText(left.id, right.id)
  );
}

export function sortAttentionGroups(groups: readonly HomeAttentionGroup[]): HomeAttentionGroup[] {
  return groups.filter((group) => group.count > 0).sort(compareAttentionGroups);
}

function compareDueDates(left: Nullable<string>, right: Nullable<string>): number {
  if (left === right) {
    return SORT_ORDER.same;
  }
  if (left === null) {
    return SORT_ORDER.after;
  }
  if (right === null) {
    return SORT_ORDER.before;
  }
  return compareText(left, right);
}
