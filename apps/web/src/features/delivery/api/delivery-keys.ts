import type {
  BookOrdersControllerActiveMoneyAgeParams,
  BookOrdersControllerStatisticsParams,
  DeliveryReadControllerInTransitQuickCountsParams,
} from "@/shared/api/generated/model";

import { matchesApiRoot } from "@/lib/query-keys";

import type { DeliveryHistoryListParams, DeliveryHistoryTab } from "../model/history-params";
import type { DeliveryListParams } from "../model/in-transit-params";

const DELIVERY_ROOTS = {
  budgets: "/api/delivery/budgets",
  history: "/api/delivery/books/history",
  inTransit: "/api/delivery/books/in-transit",
  root: "/api/delivery",
  statistics: "/api/delivery/orders/statistics",
} as const;

export const deliveryKeys = {
  budgets: [DELIVERY_ROOTS.budgets] as const,
  history: {
    cancelledFollowUp: [DELIVERY_ROOTS.history, "cancelled-follow-up"] as const,
    facets: (tab: DeliveryHistoryTab) => [DELIVERY_ROOTS.history, "facets", tab] as const,
    list: (params: DeliveryHistoryListParams) => [DELIVERY_ROOTS.history, "list", params] as const,
    outcome: [DELIVERY_ROOTS.history, "outcome"] as const,
    summary: [DELIVERY_ROOTS.history, "summary"] as const,
  },
  inTransit: {
    facets: [DELIVERY_ROOTS.inTransit, "facets"] as const,
    impact: [DELIVERY_ROOTS.inTransit, "impact"] as const,
    list: (params: DeliveryListParams) => [DELIVERY_ROOTS.inTransit, "list", params] as const,
    lists: [DELIVERY_ROOTS.inTransit, "list"] as const,
    quickCounts: (params: DeliveryReadControllerInTransitQuickCountsParams) =>
      [DELIVERY_ROOTS.inTransit, "quick-counts", params] as const,
    summary: [DELIVERY_ROOTS.inTransit, "summary"] as const,
  },
  orders: {
    detail: (orderId: string) => [`${DELIVERY_ROOTS.root}/orders/${orderId}`] as const,
  },
  statistics: {
    activeMoneyAge: (params: BookOrdersControllerActiveMoneyAgeParams) =>
      [DELIVERY_ROOTS.statistics, "active-age", params] as const,
    overview: (params: BookOrdersControllerStatisticsParams) =>
      [DELIVERY_ROOTS.statistics, "overview", params] as const,
  },
};

export const matchesDeliveryKey = matchesApiRoot(DELIVERY_ROOTS.root);
