import { READING_GOAL_PAGE_SIZE } from "@app/shared";

export const ACTIVE_LIST_GOAL_INDEX = "reading_goals_active_list_idx";

export const READING_GOAL_MESSAGE = {
  activeGoalExists: "This list already has an active reading goal",
  archivedIsReadOnly: "Archived goal cannot be changed",
  deadlineNotInFuture: "Deadline must be later than today",
  notFound: "Reading goal not found",
  targetAboveListSize: "Target cannot exceed the number of books in the list",
} as const;

export const INCLUSIVE_DAY = 1;

export const READING_GOAL_LIMITS = Object.freeze({
  activityPreview: 5,
  catalogScan: 500,
  detailBooksPreview: READING_GOAL_PAGE_SIZE.max,
});

export const READING_GOAL_ATTENTION = Object.freeze({
  maxItems: 5,
});

export const READING_GOAL_PACE = Object.freeze({
  aheadBooks: 0.5,
  behindBooks: -0.5,
  criticalDaysLeft: 7,
  criticalElapsedPercent: 80,
  criticalProgressGapPercent: 20,
  criticalRemainingBooks: 2,
});

export const READING_GOAL_RISK = Object.freeze({
  deadlineSoonDays: 7,
  levelMinimumReasons: Object.freeze({ high: 2, medium: 1 }),
  lowRiskProjectedDeltaMax: 3,
  noRecentProgressDays: 14,
  noRecentProgressElapsedDays: 14,
  requiredPaceMultiplier: 1.5,
  requiredPaceZeroElapsedPercent: 50,
});

export const READING_GOAL_PROJECTION = Object.freeze({
  confidenceMinimumCounted: Object.freeze({ high: 4, low: 1, medium: 2 }),
});

export const READING_GOAL_CHECKPOINTS = Object.freeze({
  fractions: Object.freeze([0.2, 0.4, 0.6, 0.8, 1]),
  maxCount: 5,
});

export const READING_GOAL_ROUNDING = Object.freeze({
  booksDelta: 2,
  daysPerBook: 1,
  percent: 1,
  perDayRate: 3,
  successRate: 0,
});

const DECIMAL_BASE = 10;

export function roundTo({ decimals, value }: { decimals: number; value: number }): number {
  const factor = DECIMAL_BASE ** decimals;
  return Math.round(value * factor) / factor;
}
