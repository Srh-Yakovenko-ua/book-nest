import type { Currency, DeliveryStatisticsView, DeliveryTopOrder, Nullable } from "@app/shared";

import { CurrencySchema } from "@app/shared";

import type { BarChartDatum } from "@/components/ui/charts/bar-chart";
import type { StatusEntry } from "@/lib/book-status";

import { deliveryStatuses } from "@/lib/book-status";

const CURRENCY_ORDER: readonly Currency[] = CurrencySchema.options;
const MONTH_KEY_LENGTH = 7;

export type MonthlyCurrencySeries = {
  currency: Currency;
  data: BarChartDatum[];
  total: number;
};

export type StatusBreakdownEntry = {
  badge: StatusEntry;
  count: number;
  key: "active" | "cancelled" | "received";
  totalsByCurrency: DeliveryStatisticsView["statusBreakdown"]["active"]["totalsByCurrency"];
};

export type StoreBreakdownRow = {
  ordersCount: number;
  share: number;
  store: string;
  totalsByCurrency: DeliveryStatisticsView["byStore"][number]["totalsByCurrency"];
};

export type TopOrderRow = {
  badge: StatusEntry;
  bookId: string;
  bookTitle: string;
  orderDate: DeliveryTopOrder["orderDate"];
  priceAmount: number;
  priceCurrency: Nullable<Currency>;
  status: DeliveryTopOrder["status"];
  storeName: DeliveryTopOrder["storeName"];
};

export function buildMonthlyOrdersSeries(
  view: DeliveryStatisticsView,
  locale: string,
): BarChartDatum[] {
  return view.monthly.map((month) => ({
    fullLabel: formatMonthLong(month.month, locale),
    label: formatMonthShort(month.month, locale),
    value: month.ordersCount,
  }));
}

export function buildMonthlySpendingSeries(
  view: DeliveryStatisticsView,
  locale: string,
): MonthlyCurrencySeries[] {
  return monthlyCurrencies(view).map((currency) => {
    const data = view.monthly.map((month) => ({
      fullLabel: formatMonthLong(month.month, locale),
      label: formatMonthShort(month.month, locale),
      value: month.totalsByCurrency.find((entry) => entry.currency === currency)?.total ?? 0,
    }));
    return {
      currency,
      data,
      total: data.reduce((sum, datum) => sum + datum.value, 0),
    };
  });
}

export function buildStatusBreakdown(
  view: DeliveryStatisticsView,
  label: (key: "active" | "cancelled" | "received") => string,
): StatusBreakdownEntry[] {
  const entries = [
    { key: "active", statusValue: "in_transit" },
    { key: "received", statusValue: "received" },
    { key: "cancelled", statusValue: "cancelled" },
  ] as const;

  return entries.map(({ key, statusValue }) => {
    const group = view.statusBreakdown[key];
    const base =
      deliveryStatuses.find((entry) => entry.value === statusValue) ?? deliveryStatuses[0];
    return {
      badge: { ...base, label: label(key) },
      count: group.count,
      key,
      totalsByCurrency: group.totalsByCurrency,
    };
  });
}

export function buildStoreRows(view: DeliveryStatisticsView): StoreBreakdownRow[] {
  const totalOrders = view.byStore.reduce((sum, store) => sum + store.ordersCount, 0);
  return view.byStore.map((store) => ({
    ordersCount: store.ordersCount,
    share: totalOrders === 0 ? 0 : store.ordersCount / totalOrders,
    store: store.store,
    totalsByCurrency: store.totalsByCurrency,
  }));
}

export function buildTopOrders(
  view: DeliveryStatisticsView,
  label: (status: DeliveryTopOrder["status"]) => string,
): TopOrderRow[] {
  return view.topOrders.map((order) => {
    const base =
      deliveryStatuses.find((entry) => entry.value === order.status) ?? deliveryStatuses[0];
    return {
      badge: { ...base, label: label(order.status) },
      bookId: order.bookId,
      bookTitle: order.bookTitle,
      orderDate: order.orderDate,
      priceAmount: order.price,
      priceCurrency: order.currency,
      status: order.status,
      storeName: order.storeName,
    };
  });
}

export function hasAnyOrders(view: DeliveryStatisticsView): boolean {
  return pricedOrderCount(view) > 0 || view.monthly.length > 0;
}

export function hasPricedData(view: DeliveryStatisticsView): boolean {
  return pricedOrderCount(view) > 0;
}

export function monthlyCurrencies(view: DeliveryStatisticsView): Currency[] {
  const present = new Set<Currency>();
  for (const month of view.monthly) {
    for (const entry of month.totalsByCurrency) present.add(entry.currency);
  }
  return CURRENCY_ORDER.filter((currency) => present.has(currency));
}

export function pricedOrderCount(view: DeliveryStatisticsView): number {
  const { active, cancelled, received } = view.statusBreakdown;
  return active.count + received.count + cancelled.count;
}

function formatMonthLong(monthKey: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    monthDate(monthKey),
  );
}

function formatMonthShort(monthKey: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(monthDate(monthKey));
}

function monthDate(monthKey: string): Date {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, MONTH_KEY_LENGTH));
  return new Date(year, month - 1, 1);
}
