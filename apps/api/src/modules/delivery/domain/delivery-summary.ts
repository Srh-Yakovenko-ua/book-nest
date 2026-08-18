import type {
  Currency,
  CurrencyTotal,
  InTransitSummaryView,
  NextShipmentView,
  Nullable,
} from "@app/shared";

import { CurrencySchema, DEFAULT_CURRENCY } from "@app/shared";

export const IN_TRANSIT_ATTENTION_CATEGORIES = [
  "delayed",
  "withoutExpectedDate",
  "withoutTrackingNumber",
  "withoutPrice",
] as const;

export type InTransitCurrencyTotal = {
  currency: Nullable<string>;
  total: number;
};

export type InTransitSummaryData = {
  activeBooksCount: number;
  activeOrdersCount: number;
  activeShipmentsCount: number;
  arrivingSoonCount: number;
  attentionCount: number;
  bookTotals: InTransitCurrencyTotal[];
  delayedCount: number;
  expectedThisWeekCount: number;
  inTransitCount: number;
  nextExpectedDelivery: Nullable<string>;
  nextExpectedThisWeek: Nullable<string>;
  orderedCount: number;
  ordersWithKnownTotalCount: number;
  orderTotals: InTransitCurrencyTotal[];
  readyForPickupCount: number;
  splitOrdersCount: number;
  uniqueStoresCount: number;
  withoutExpectedDateCount: number;
  withoutPriceCount: number;
  withoutTrackingCount: number;
};

export type InTransitSummaryInput = InTransitSummaryData & {
  nextShipment: Nullable<NextShipmentView>;
};

export function buildInTransitSummaryView(data: InTransitSummaryInput): InTransitSummaryView {
  return {
    activeBooksCount: data.activeBooksCount,
    activeBooksTotalByCurrency: toCurrencyTotals(data.bookTotals),
    activeOrdersCount: data.activeOrdersCount,
    activeOrdersTotalByCurrency: toCurrencyTotals(data.orderTotals),
    activeShipmentsCount: data.activeShipmentsCount,
    arrivingSoonCount: data.arrivingSoonCount,
    attentionCount: data.attentionCount,
    delayedCount: data.delayedCount,
    expectedThisWeekCount: data.expectedThisWeekCount,
    inTransitCount: data.inTransitCount,
    nextExpectedDelivery: data.nextExpectedDelivery,
    nextExpectedThisWeek: data.nextExpectedThisWeek,
    nextShipment: data.nextShipment,
    orderedCount: data.orderedCount,
    ordersWithKnownTotalCount: data.ordersWithKnownTotalCount,
    readyForPickupCount: data.readyForPickupCount,
    splitOrdersCount: data.splitOrdersCount,
    uniqueStoresCount: data.uniqueStoresCount,
    withoutExpectedDateCount: data.withoutExpectedDateCount,
    withoutPriceCount: data.withoutPriceCount,
    withoutTrackingCount: data.withoutTrackingCount,
  };
}

export function toCurrencyTotals(totals: InTransitCurrencyTotal[]): CurrencyTotal[] {
  const merged = new Map<Currency, number>();
  for (const entry of totals) {
    const currency =
      entry.currency === null ? DEFAULT_CURRENCY : CurrencySchema.parse(entry.currency);
    merged.set(currency, (merged.get(currency) ?? 0) + entry.total);
  }

  const result: CurrencyTotal[] = [];
  for (const currency of CurrencySchema.options) {
    const total = merged.get(currency);
    if (total === undefined) {
      continue;
    }
    result.push({ currency, total });
  }

  return result;
}
