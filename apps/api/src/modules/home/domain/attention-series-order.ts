import type {
  HomeAttentionGroup,
  HomeAttentionSeverity,
  Nullable,
  SeriesOrderSeverity,
} from "@app/shared";

export type SeriesOrderIssueSignal = {
  series: { id: string; title: string };
  severity: SeriesOrderSeverity;
};

const SERIES_ORDER_SEVERITY: Record<SeriesOrderSeverity, Nullable<HomeAttentionSeverity>> = {
  error: "medium",
  info: null,
  warning: "low",
};

const HOME_SEVERITY_ORDER: readonly HomeAttentionSeverity[] = ["critical", "high", "medium", "low"];

export function buildSeriesOrderAttention(
  issues: readonly SeriesOrderIssueSignal[],
): HomeAttentionGroup[] {
  return HOME_SEVERITY_ORDER.flatMap((severity): HomeAttentionGroup[] => {
    const grouped = issues.filter((issue) => SERIES_ORDER_SEVERITY[issue.severity] === severity);
    const [first] = grouped;
    if (first === undefined) {
      return [];
    }
    const sharedSeries = grouped.every((issue) => issue.series.id === first.series.id)
      ? first.series
      : null;
    return [
      {
        count: grouped.length,
        dueDate: null,
        id: `series_order_issue:${severity}`,
        reason: "series_order_issue",
        seriesId: sharedSeries?.id ?? null,
        seriesTitle: sharedSeries?.title ?? null,
        severity,
        unit: "issues",
      },
    ];
  });
}
