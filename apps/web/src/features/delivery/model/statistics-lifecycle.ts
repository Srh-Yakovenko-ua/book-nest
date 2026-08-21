import type { BookOrderDerivedStatus, BookOrderStatisticsLifecycle, Nullable } from "@app/shared";

export const LIFECYCLE_MODES = ["orders", "books"] as const;

export type LifecycleMode = (typeof LIFECYCLE_MODES)[number];

export const LIFECYCLE_STAGES = [
  "active",
  "partially_shipped",
  "shipped",
  "partially_received",
  "received",
] as const satisfies readonly BookOrderDerivedStatus[];

export type LifecycleBreakdown = {
  cancelled: LifecycleRow;
  stages: LifecycleRow[];
  total: number;
};

export type LifecycleRow = {
  count: number;
  delta: Nullable<number>;
  share: number;
  stage: BookOrderDerivedStatus;
};

export function lifecycleBreakdown(
  lifecycle: BookOrderStatisticsLifecycle,
  mode: LifecycleMode,
): LifecycleBreakdown {
  const counts = lifecycle[mode];
  const comparison = lifecycle.comparison === null ? null : lifecycle.comparison[mode];
  const peak = Math.max(...LIFECYCLE_STAGES.map((stage) => counts[stage]), 1);

  const toRow = (stage: BookOrderDerivedStatus, reference: number): LifecycleRow => ({
    count: counts[stage],
    delta: comparison === null ? null : comparison.delta[stage],
    share: reference === 0 ? 0 : counts[stage] / reference,
    stage,
  });

  return {
    cancelled: toRow("cancelled", Math.max(peak, counts.cancelled)),
    stages: LIFECYCLE_STAGES.map((stage) => toRow(stage, peak)),
    total: counts.total,
  };
}
