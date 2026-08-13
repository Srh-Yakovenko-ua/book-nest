import type { Currency, CurrencyTotal, InTransitSummaryView, Nullable } from "@app/shared";

import { CurrencySchema, DEFAULT_CURRENCY } from "@app/shared";

export const IN_TRANSIT_ATTENTION_CATEGORIES = [
  "delayed",
  "withoutExpectedDate",
  "withoutTrackingNumber",
  "withoutPrice",
] as const;

export type InTransitAttentionCategory = (typeof IN_TRANSIT_ATTENTION_CATEGORIES)[number];

export type InTransitCurrencyTotal = {
  currency: Nullable<string>;
  total: number;
};

export type InTransitSummaryData = {
  activeBooksCount: number;
  activeOrdersCount: number;
  activeShipmentsCount: number;
  attentionCount: number;
  bookTotals: InTransitCurrencyTotal[];
  delayedCount: number;
  expectedThisWeekCount: number;
  inTransitCount: number;
  nextExpectedDelivery: Nullable<string>;
  orderedCount: number;
  orderTotals: InTransitCurrencyTotal[];
  readyForPickupCount: number;
  uniqueStoresCount: number;
  withoutExpectedDateCount: number;
  withoutPriceCount: number;
  withoutTrackingCount: number;
};

export function buildInTransitSummaryView(data: InTransitSummaryData): InTransitSummaryView {
  return {
    activeBooksCount: data.activeBooksCount,
    activeBooksTotalByCurrency: toCurrencyTotals(data.bookTotals),
    activeOrdersCount: data.activeOrdersCount,
    activeOrdersTotalByCurrency: toCurrencyTotals(data.orderTotals),
    activeShipmentsCount: data.activeShipmentsCount,
    attentionCount: data.attentionCount,
    delayedCount: data.delayedCount,
    expectedThisWeekCount: data.expectedThisWeekCount,
    inTransitCount: data.inTransitCount,
    nextExpectedDelivery: data.nextExpectedDelivery,
    orderedCount: data.orderedCount,
    readyForPickupCount: data.readyForPickupCount,
    uniqueStoresCount: data.uniqueStoresCount,
    withoutExpectedDateCount: data.withoutExpectedDateCount,
    withoutPriceCount: data.withoutPriceCount,
    withoutTrackingCount: data.withoutTrackingCount,
  };
}

function toCurrencyTotals(totals: InTransitCurrencyTotal[]): CurrencyTotal[] {
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
