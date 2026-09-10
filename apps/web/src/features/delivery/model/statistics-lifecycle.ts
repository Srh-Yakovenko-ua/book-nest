import type { BookOrderDerivedStatus, BookOrderStatisticsLifecycle, Nullable } from "@app/shared";

export const LIFECYCLE_MODES = ["orders", "books"] as const;

export type LifecycleMode = (typeof LIFECYCLE_MODES)[number];

export const LIFECYCLE_STAGES = {
  books: ["active", "shipped", "received"],
  orders: ["active", "partially_shipped", "shipped", "partially_received", "received"],
} as const satisfies Record<LifecycleMode, readonly BookOrderDerivedStatus[]>;

export type LifecycleBreakdown = {
  cancelled: LifecycleRow;
  hasComparison: boolean;
  stages: LifecycleRow[];
  total: number;
};

export type LifecycleRow = {
  count: number;
  delta: Nullable<number>;
  previous: Nullable<number>;
  stage: BookOrderDerivedStatus;
  totalShare: number;
};

export function lifecycleBreakdown(
  lifecycle: BookOrderStatisticsLifecycle,
  mode: LifecycleMode,
): LifecycleBreakdown {
  const counts = lifecycle[mode];
  const comparison = lifecycle.comparison === null ? null : lifecycle.comparison[mode];

  const toRow = (stage: BookOrderDerivedStatus): LifecycleRow => ({
    count: counts[stage],
    delta: comparison === null ? null : comparison.delta[stage],
    previous: comparison === null ? null : comparison.previous[stage],
    stage,
    totalShare: counts.total === 0 ? 0 : counts[stage] / counts.total,
  });

  return {
    cancelled: toRow("cancelled"),
    hasComparison: comparison !== null,
    stages: LIFECYCLE_STAGES[mode].map((stage) => toRow(stage)),
    total: counts.total,
  };
}
