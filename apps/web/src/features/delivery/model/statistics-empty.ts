import type { BookOrderHistorySummaryView } from "@app/shared";

import type { StatisticsScopeState } from "./statistics-scope-state";

export type StatisticsCompletedOrders =
  { count: number; status: "success" } | { status: "error" } | { status: "pending" };

export type StatisticsEmptyKind = "filters" | "no_orders" | "pending" | "period";

export function statisticsEmptyKind({
  activeOrdersCount,
  completedOrders,
  hasActiveFilters,
}: {
  activeOrdersCount: number;
  completedOrders: StatisticsCompletedOrders;
  hasActiveFilters: boolean;
}): StatisticsEmptyKind {
  if (hasActiveFilters) {
    return "filters";
  }
  if (activeOrdersCount > 0) {
    return "period";
  }
  switch (completedOrders.status) {
    case "error":
      return "period";
    case "pending":
      return "pending";
    case "success":
      return completedOrders.count > 0 ? "period" : "no_orders";
  }
}

export function toStatisticsCompletedOrders(
  summary: Pick<StatisticsScopeState<BookOrderHistorySummaryView>, "data" | "isInitialError">,
): StatisticsCompletedOrders {
  if (summary.data !== undefined) {
    return { count: summary.data.completedOrdersCount, status: "success" };
  }
  return summary.isInitialError ? { status: "error" } : { status: "pending" };
}
