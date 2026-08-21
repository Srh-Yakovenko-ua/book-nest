import type {
  ActiveMoneyAgeBucket,
  BookOrderDerivedStatus,
  BookOrderStatisticsTopOrder,
  Currency,
  Nullable,
} from "@app/shared";

import { endOfMonth, format, parse, startOfMonth } from "date-fns";

import { STATISTICS_PERIOD } from "./statistics-period";

export const DELIVERY_ROUTES = {
  history: "/delivery/history",
  inTransit: "/delivery/in-transit",
} as const;

const SETTLED_STATUSES = new Set<BookOrderDerivedStatus>(["cancelled", "received"]);

const MONTH_KEY_FORMAT = "yyyy-MM";

export type StatisticsDrilldownFilters = {
  currency: Nullable<Currency>;
  store: Nullable<string>;
};

export function activeAgeHref(
  bucket: ActiveMoneyAgeBucket,
  filters: StatisticsDrilldownFilters,
): string {
  return withParams(DELIVERY_ROUTES.inTransit, {
    ageBucket: bucket,
    sort: "oldest_orders",
    ...currencyParam(filters.currency),
    ...storeParam(filters.store),
  });
}

export function dayHref(day: string, filters: StatisticsDrilldownFilters): string {
  return withParams(DELIVERY_ROUTES.history, {
    from: day,
    to: day,
    ...currencyParam(filters.currency),
    ...storeParam(filters.store),
  });
}

export function monthHref(monthKey: string, filters: StatisticsDrilldownFilters): string {
  const month = parse(monthKey, MONTH_KEY_FORMAT, new Date());
  return withParams(DELIVERY_ROUTES.history, {
    from: format(startOfMonth(month), STATISTICS_PERIOD.isoDayFormat),
    to: format(endOfMonth(month), STATISTICS_PERIOD.isoDayFormat),
    ...currencyParam(filters.currency),
    ...storeParam(filters.store),
  });
}

export function orderHref(order: BookOrderStatisticsTopOrder): Nullable<string> {
  if (order.orderNumber === null) return null;

  const isSettled = SETTLED_STATUSES.has(order.derivedStatus);
  const route = isSettled ? DELIVERY_ROUTES.history : DELIVERY_ROUTES.inTransit;

  return withParams(route, {
    q: order.orderNumber,
    ...(order.derivedStatus === "cancelled" ? { tab: "cancelled" } : {}),
  });
}

export function storeHref(store: string, filters: StatisticsDrilldownFilters): string {
  return withParams(DELIVERY_ROUTES.history, { store, ...currencyParam(filters.currency) });
}

function currencyParam(currency: Nullable<Currency>): Record<string, string> {
  return currency === null ? {} : { currency };
}

function storeParam(store: Nullable<string>): Record<string, string> {
  return store === null || store.trim() === "" ? {} : { store: store.trim() };
}

function withParams(route: string, params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return search === "" ? route : `${route}?${search}`;
}
