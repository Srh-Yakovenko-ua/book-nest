import type { InTransitSummaryView, Nullable } from "@app/shared";

import { isToday, isTomorrow } from "date-fns";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { formatDayMonth, formatNumber, parseIsoDay } from "@/lib/format";

import { formatCurrencyTotals } from "./money-format";

export type DeliverySummaryLabels = {
  active: {
    empty: string;
    inTransit: (count: number) => string;
    label: string;
    ordered: (count: number) => string;
    readyForPickup: (count: number) => string;
  };
  activeOrders: {
    empty: string;
    label: string;
    noShipments: string;
    shipments: (count: number) => string;
    split: (count: number) => string;
  };
  expectedThisWeek: {
    empty: string;
    label: string;
    onDate: (date: string) => string;
    today: string;
    tomorrow: string;
  };
  mobile: (key: DeliverySummaryCardKey) => { compact: string; detailed: string };
  ordersTotal: {
    coverageAll: (count: number) => string;
    coverageNone: (count: number) => string;
    coveragePartial: (known: number, total: number) => string;
    empty: string;
    label: string;
  };
  units: {
    books: (count: number) => string;
    orders: (count: number) => string;
  };
};

type DeliverySummaryCardKey = "active" | "activeOrders" | "expectedThisWeek" | "ordersTotal";

type SummaryCardOptions = {
  labels: DeliverySummaryLabels;
  locale: string;
  summary: Nullable<InTransitSummaryView>;
};

const MICROFACT_SEPARATOR = " · ";

export function buildDeliverySummaryCards(options: SummaryCardOptions): LibrarySummaryCard[] {
  return [
    toActiveCard(options),
    toExpectedThisWeekCard(options),
    toActiveOrdersCard(options),
    toOrdersTotalCard(options),
  ];
}

function toActiveCard({ labels, locale, summary }: SummaryCardOptions): LibrarySummaryCard {
  const count = summary?.activeBooksCount ?? 0;

  return {
    icon: "truck",
    iconTone: "primary",
    label: labels.active.label,
    microfact: summary === null ? undefined : toActiveMicrofact(summary, labels),
    mobileLabels: labels.mobile("active"),
    unit: labels.units.books(count),
    value: formatNumber(count, locale),
  };
}

function toActiveMicrofact(summary: InTransitSummaryView, labels: DeliverySummaryLabels): string {
  const parts = [
    summary.orderedCount > 0 ? labels.active.ordered(summary.orderedCount) : null,
    summary.inTransitCount > 0 ? labels.active.inTransit(summary.inTransitCount) : null,
    summary.readyForPickupCount > 0
      ? labels.active.readyForPickup(summary.readyForPickupCount)
      : null,
  ].filter((part) => part !== null);

  if (parts.length === 0) return labels.active.empty;
  return parts.join(MICROFACT_SEPARATOR);
}

function toActiveOrdersCard({ labels, locale, summary }: SummaryCardOptions): LibrarySummaryCard {
  const count = summary?.activeOrdersCount ?? 0;

  return {
    icon: "shopping-bag",
    iconTone: "ink",
    label: labels.activeOrders.label,
    microfact: summary === null ? undefined : toActiveOrdersMicrofact(summary, labels),
    mobileLabels: labels.mobile("activeOrders"),
    unit: labels.units.orders(count),
    value: formatNumber(count, locale),
  };
}

function toActiveOrdersMicrofact(
  summary: InTransitSummaryView,
  labels: DeliverySummaryLabels,
): string {
  if (summary.activeOrdersCount === 0) return labels.activeOrders.empty;
  if (summary.activeShipmentsCount === 0) return labels.activeOrders.noShipments;

  const shipments = labels.activeOrders.shipments(summary.activeShipmentsCount);
  if (summary.splitOrdersCount === 0) return shipments;
  return [shipments, labels.activeOrders.split(summary.splitOrdersCount)].join(MICROFACT_SEPARATOR);
}

function toExpectedThisWeekCard({
  labels,
  locale,
  summary,
}: SummaryCardOptions): LibrarySummaryCard {
  const count = summary?.expectedThisWeekCount ?? 0;

  return {
    icon: "clock",
    iconTone: "info",
    label: labels.expectedThisWeek.label,
    microfact: summary === null ? undefined : toExpectedThisWeekMicrofact(summary, labels, locale),
    mobileLabels: labels.mobile("expectedThisWeek"),
    unit: labels.units.books(count),
    value: formatNumber(count, locale),
  };
}

function toExpectedThisWeekMicrofact(
  summary: InTransitSummaryView,
  labels: DeliverySummaryLabels,
  locale: string,
): string {
  const nextExpected = summary.nextExpectedThisWeek;
  if (summary.expectedThisWeekCount === 0 || nextExpected === null) {
    return labels.expectedThisWeek.empty;
  }

  const day = parseIsoDay(nextExpected);
  if (isToday(day)) return labels.expectedThisWeek.today;
  if (isTomorrow(day)) return labels.expectedThisWeek.tomorrow;
  return labels.expectedThisWeek.onDate(formatDayMonth(nextExpected, locale));
}

function toOrdersTotalCard({ labels, locale, summary }: SummaryCardOptions): LibrarySummaryCard {
  return {
    icon: "wallet",
    iconTone: "success",
    label: labels.ordersTotal.label,
    microfact: summary === null ? undefined : toOrdersTotalMicrofact(summary, labels),
    mobileLabels: labels.mobile("ordersTotal"),
    value: formatCurrencyTotals(summary?.activeOrdersTotalByCurrency ?? [], locale),
  };
}

function toOrdersTotalMicrofact(
  summary: InTransitSummaryView,
  labels: DeliverySummaryLabels,
): string {
  const { activeOrdersCount, ordersWithKnownTotalCount } = summary;

  if (activeOrdersCount === 0) return labels.ordersTotal.empty;
  if (ordersWithKnownTotalCount === 0) return labels.ordersTotal.coverageNone(activeOrdersCount);
  if (ordersWithKnownTotalCount === activeOrdersCount) {
    return labels.ordersTotal.coverageAll(activeOrdersCount);
  }
  return labels.ordersTotal.coveragePartial(ordersWithKnownTotalCount, activeOrdersCount);
}
