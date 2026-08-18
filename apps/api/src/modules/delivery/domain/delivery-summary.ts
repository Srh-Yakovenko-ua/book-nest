import type {
  Currency,
  CurrencyTotal,
  InTransitAttention,
  InTransitSummaryView,
  NextShipmentView,
  Nullable,
} from "@app/shared";

import { CurrencySchema, DEFAULT_CURRENCY, InTransitAttentionReasonSchema } from "@app/shared";

import { daysBetweenIsoDates, toIsoDate } from "../../../core/iso-date.js";

const ATTENTION_REASON = InTransitAttentionReasonSchema.enum;

export type InTransitAttentionData = {
  awaitingDispatchOrdersCount: number;
  delayedShipmentsCount: number;
  earliestAwaitingOrderDate: Nullable<string>;
  earliestDelayedDate: Nullable<string>;
  nearestPickupUntil: Nullable<string>;
  pickupExpiredCount: number;
  pickupExpiringCount: number;
  unassignedBooksCount: number;
  unassignedOrderId: Nullable<string>;
  unassignedOrdersCount: number;
  withoutExpectedDateShipmentsCount: number;
  withoutTrackingShipmentsCount: number;
};

export type InTransitAttentionInput = InTransitAttentionData & { today: Date };

export type InTransitCurrencyTotal = {
  currency: Nullable<string>;
  total: number;
};

export type InTransitSummaryData = InTransitAttentionData & {
  activeBooksCount: number;
  activeOrdersCount: number;
  activeShipmentsCount: number;
  arrivingSoonCount: number;
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
  today: Date;
};

export function buildInTransitAttention(input: InTransitAttentionInput): InTransitAttention[] {
  return [
    ...pickupExpiringAttention(input),
    ...delayedAttention(input),
    ...awaitingDispatchAttention(input),
    ...withoutTrackingAttention(input),
    ...withoutExpectedDateAttention(input),
    ...unassignedBooksAttention(input),
  ];
}

export function buildInTransitSummaryView(data: InTransitSummaryInput): InTransitSummaryView {
  return {
    activeBooksCount: data.activeBooksCount,
    activeBooksTotalByCurrency: toCurrencyTotals(data.bookTotals),
    activeOrdersCount: data.activeOrdersCount,
    activeOrdersTotalByCurrency: toCurrencyTotals(data.orderTotals),
    activeShipmentsCount: data.activeShipmentsCount,
    arrivingSoonCount: data.arrivingSoonCount,
    attention: buildInTransitAttention(data),
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

function awaitingDispatchAttention({
  awaitingDispatchOrdersCount,
  earliestAwaitingOrderDate,
  today,
}: InTransitAttentionInput): InTransitAttention[] {
  if (awaitingDispatchOrdersCount === 0 || earliestAwaitingOrderDate === null) {
    return [];
  }

  return [
    {
      count: awaitingDispatchOrdersCount,
      maxWaitingDays: daysBetweenIsoDates({
        endIsoDate: toIsoDate(today),
        startIsoDate: earliestAwaitingOrderDate,
      }),
      reason: ATTENTION_REASON.awaiting_dispatch,
    },
  ];
}

function delayedAttention({
  delayedShipmentsCount,
  earliestDelayedDate,
  today,
}: InTransitAttentionInput): InTransitAttention[] {
  if (delayedShipmentsCount === 0 || earliestDelayedDate === null) {
    return [];
  }

  return [
    {
      count: delayedShipmentsCount,
      maxDelayDays: daysBetweenIsoDates({
        endIsoDate: toIsoDate(today),
        startIsoDate: earliestDelayedDate,
      }),
      reason: ATTENTION_REASON.delayed,
    },
  ];
}

function pickupExpiringAttention({
  nearestPickupUntil,
  pickupExpiredCount,
  pickupExpiringCount,
}: InTransitAttentionData): InTransitAttention[] {
  if (pickupExpiringCount === 0) {
    return [];
  }

  return [
    {
      count: pickupExpiringCount,
      expiredCount: pickupExpiredCount,
      nearestPickupUntil,
      reason: ATTENTION_REASON.pickup_expiring,
    },
  ];
}

function unassignedBooksAttention({
  unassignedBooksCount,
  unassignedOrderId,
  unassignedOrdersCount,
}: InTransitAttentionData): InTransitAttention[] {
  if (unassignedBooksCount === 0) {
    return [];
  }

  return [
    {
      count: unassignedBooksCount,
      ordersCount: unassignedOrdersCount,
      reason: ATTENTION_REASON.unassigned_books,
      revealOrderId: unassignedOrderId,
    },
  ];
}

function withoutExpectedDateAttention({
  withoutExpectedDateShipmentsCount,
}: InTransitAttentionData): InTransitAttention[] {
  if (withoutExpectedDateShipmentsCount === 0) {
    return [];
  }

  return [
    { count: withoutExpectedDateShipmentsCount, reason: ATTENTION_REASON.without_expected_date },
  ];
}

function withoutTrackingAttention({
  withoutTrackingShipmentsCount,
}: InTransitAttentionData): InTransitAttention[] {
  if (withoutTrackingShipmentsCount === 0) {
    return [];
  }

  return [{ count: withoutTrackingShipmentsCount, reason: ATTENTION_REASON.without_tracking }];
}
