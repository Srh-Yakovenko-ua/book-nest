import type {
  Nullable,
  ReadingGoalAttentionItem,
  ReadingGoalAttentionSeverity,
  ReadingGoalListItem,
  ReadingGoalRiskReason,
} from "@app/shared";

import { ReadingGoalAttentionSeveritySchema } from "@app/shared";

import { READING_GOAL_ATTENTION } from "./reading-goal.constants.js";

type AttentionCandidate = {
  item: ReadingGoalListItem;
  severity: ReadingGoalAttentionSeverity;
};

export function buildReadingGoalAttention(
  items: ReadingGoalListItem[],
): ReadingGoalAttentionItem[] {
  return items
    .map((item) => ({ item, severity: toSeverity(item) }))
    .sort(compareCandidates)
    .slice(0, READING_GOAL_ATTENTION.maxItems)
    .map(toAttentionItem);
}

export function needsReadingGoalAttention(item: ReadingGoalListItem): boolean {
  if (item.status !== "active") {
    return false;
  }
  return (
    item.pace === "behind" ||
    item.pace === "critical" ||
    item.riskLevel === "high" ||
    item.riskLevel === "critical"
  );
}

function compareCandidates(left: AttentionCandidate, right: AttentionCandidate): number {
  const bySeverity = severityRank(right.severity) - severityRank(left.severity);
  if (bySeverity !== 0) {
    return bySeverity;
  }
  const byDaysLeft = compareNullableNumbersAscending(left.item.daysLeft, right.item.daysLeft);
  if (byDaysLeft !== 0) {
    return byDaysLeft;
  }
  const byShortfall = shortfall(right.item) - shortfall(left.item);
  if (byShortfall !== 0) {
    return byShortfall;
  }
  const byLastCounted = compareOldestFirst(left.item.lastCountedAt, right.item.lastCountedAt);
  return byLastCounted === 0 ? left.item.id.localeCompare(right.item.id) : byLastCounted;
}

function compareNullableNumbersAscending(left: Nullable<number>, right: Nullable<number>): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}

function compareOldestFirst(left: Nullable<string>, right: Nullable<string>): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return -1;
  }
  if (right === null) {
    return 1;
  }
  return left.localeCompare(right);
}

function definedNumbers(values: Record<string, Nullable<number>>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) => (value === null ? [] : [[key, value]])),
  );
}

function severityRank(severity: ReadingGoalAttentionSeverity): number {
  return ReadingGoalAttentionSeveritySchema.options.indexOf(severity);
}

function shortfall({ completedCount, expectedCompletedCount }: ReadingGoalListItem): number {
  return Math.max(0, expectedCompletedCount - completedCount);
}

function toAttentionItem({ item, severity }: AttentionCandidate): ReadingGoalAttentionItem {
  const reason = toReason(item);
  return {
    goalId: item.id,
    goalName: item.name,
    listName: item.list?.name ?? null,
    messageData: toMessageData({ item, reason }),
    reason,
    severity,
  };
}

function toMessageData({
  item,
  reason,
}: {
  item: ReadingGoalListItem;
  reason: ReadingGoalRiskReason;
}): ReadingGoalAttentionItem["messageData"] {
  const shared = { remainingCount: item.remainingCount, targetCount: item.targetCount };
  switch (reason) {
    case "deadline_soon":
      return { ...shared, ...definedNumbers({ daysLeft: item.daysLeft }) };
    case "no_recent_progress":
      return {
        ...shared,
        ...definedNumbers({ daysSinceLastCounted: item.daysSinceLastCounted }),
        ...(item.lastCountedAt === null ? {} : { lastCountedAt: item.lastCountedAt }),
      };
    case "required_pace_high":
      return {
        ...shared,
        ...definedNumbers({
          daysLeft: item.daysLeft,
          requiredBooksPerDay: item.requiredBooksPerDay,
        }),
      };
    default:
      return {
        ...shared,
        completedCount: item.completedCount,
        expectedCompletedCount: item.expectedCompletedCount,
        ...definedNumbers({ paceDeltaBooks: item.paceDeltaBooks }),
      };
  }
}

function toReason(item: ReadingGoalListItem): ReadingGoalRiskReason {
  return item.riskReasons[0] ?? "behind_schedule";
}

function toSeverity(item: ReadingGoalListItem): ReadingGoalAttentionSeverity {
  if (item.riskLevel === "critical" || item.pace === "critical") {
    return "critical";
  }
  return item.riskLevel === "high" ? "high" : "medium";
}
