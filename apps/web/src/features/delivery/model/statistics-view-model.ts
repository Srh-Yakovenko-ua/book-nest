import type {
  BookOrderDerivedStatus,
  BookOrderStatisticsTopOrder,
  BookOrderStatisticsView,
  Currency,
  Nullable,
} from "@app/shared";

import { CurrencySchema } from "@app/shared";
import { parse, startOfMonth } from "date-fns";

import type { UiIconName } from "@/components/icons";
import type { BarChartDatum } from "@/components/ui/charts/bar-chart";
import type { StatusEntry, StatusTone } from "@/lib/book-status";

import { deliveryStatuses } from "@/lib/book-status";

const CURRENCY_ORDER: readonly Currency[] = CurrencySchema.options;
const MONTH_KEY_FORMAT = "yyyy-MM";

const ORDER_STATUS_BADGE: Record<BookOrderDerivedStatus, { icon: UiIconName; tone: StatusTone }> = {
  active: { icon: "package", tone: "neutral" },
  cancelled: { icon: "x-circle", tone: "neutral" },
  partially_received: { icon: "check-circle", tone: "info" },
  partially_shipped: { icon: "truck", tone: "info" },
  received: { icon: "check-circle", tone: "success" },
  shipped: { icon: "truck", tone: "info" },
};

export type MonthlyCurrencySeries = {
  currency: Currency;
  data: BarChartDatum[];
  total: number;
};

export type StatusBreakdownEntry = {
  badge: StatusEntry;
  count: number;
  key: "active" | "cancelled" | "received";
  totalsByCurrency: BookOrderStatisticsView["summary"]["totalsByCurrency"];
};

export type StoreBreakdownRow = {
  ordersCount: number;
  share: number;
  store: string;
  totalsByCurrency: BookOrderStatisticsView["byStore"][number]["totalsByCurrency"];
};

export type TopOrderRow = {
  badge: StatusEntry;
  booksCount: number;
  id: string;
  orderDate: BookOrderStatisticsTopOrder["orderDate"];
  orderNumber: BookOrderStatisticsTopOrder["orderNumber"];
  priceAmount: number;
  priceCurrency: Nullable<Currency>;
  storeName: string;
};

export function buildMonthlyOrdersSeries(
  view: BookOrderStatisticsView,
  locale: string,
): BarChartDatum[] {
  return view.monthly.map((month) => ({
    fullLabel: formatMonthLong(month.month, locale),
    label: formatMonthShort(month.month, locale),
    value: month.ordersCount,
  }));
}

export function buildMonthlySpendingSeries(
  view: BookOrderStatisticsView,
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
  view: BookOrderStatisticsView,
  label: (key: "active" | "cancelled" | "received") => string,
): StatusBreakdownEntry[] {
  const { summary } = view;
  const entries = [
    {
      count: summary.activeBooksCount,
      key: "active",
      statusValue: "in_transit",
      totalsByCurrency: summary.activeTotalsByCurrency,
    },
    {
      count: summary.receivedBooksCount,
      key: "received",
      statusValue: "received",
      totalsByCurrency: summary.receivedTotalsByCurrency,
    },
    {
      count: summary.cancelledOrdersCount,
      key: "cancelled",
      statusValue: "cancelled",
      totalsByCurrency: summary.cancelledTotalsByCurrency,
    },
  ] as const;

  return entries.map(({ count, key, statusValue, totalsByCurrency }) => {
    const base =
      deliveryStatuses.find((entry) => entry.value === statusValue) ?? deliveryStatuses[0];
    return {
      badge: { ...base, label: label(key) },
      count,
      key,
      totalsByCurrency,
    };
  });
}

export function buildStoreRows(view: BookOrderStatisticsView): StoreBreakdownRow[] {
  const totalOrders = view.byStore.reduce((sum, store) => sum + store.ordersCount, 0);
  return view.byStore.map((store) => ({
    ordersCount: store.ordersCount,
    share: totalOrders === 0 ? 0 : store.ordersCount / totalOrders,
    store: store.store,
    totalsByCurrency: store.totalsByCurrency,
  }));
}

export function buildTopOrders(
  view: BookOrderStatisticsView,
  label: (status: BookOrderDerivedStatus) => string,
): TopOrderRow[] {
  return view.topOrders.map((order) => {
    const meta = ORDER_STATUS_BADGE[order.derivedStatus];
    return {
      badge: {
        icon: meta.icon,
        label: label(order.derivedStatus),
        tone: meta.tone,
        value: order.derivedStatus,
      },
      booksCount: order.booksCount,
      id: order.id,
      orderDate: order.orderDate,
      orderNumber: order.orderNumber,
      priceAmount: order.totalAmount,
      priceCurrency: order.currency,
      storeName: order.storeName,
    };
  });
}

export function hasAnyOrders(view: BookOrderStatisticsView): boolean {
  return view.summary.ordersCount > 0 || view.monthly.length > 0;
}

export function hasPricedData(view: BookOrderStatisticsView): boolean {
  return (
    view.summary.totalsByCurrency.length > 0 || view.summary.averageBookPriceByCurrency.length > 0
  );
}

export function monthlyCurrencies(view: BookOrderStatisticsView): Currency[] {
  const present = new Set<Currency>();
  for (const month of view.monthly) {
    for (const entry of month.totalsByCurrency) present.add(entry.currency);
  }
  return CURRENCY_ORDER.filter((currency) => present.has(currency));
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
  return startOfMonth(parse(monthKey, MONTH_KEY_FORMAT, new Date()));
}
