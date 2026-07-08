import type {
  Currency,
  CurrencyAverage,
  CurrencyTotal,
  DeliveryStatisticsMonth,
  DeliveryStatisticsStatusGroup,
  DeliveryStatisticsStore,
  DeliveryStatisticsSummary,
  DeliveryStatisticsView,
  DeliveryStatus,
  DeliveryTopOrder,
} from "@app/shared";

import { collapseSpaces, CurrencySchema, isActiveDeliveryStatus } from "@app/shared";

import { toIsoDate, toNullableIsoDate } from "../../../core/iso-date.js";

export const STATISTICS_TOP_LIMIT = 10;

const DEFAULT_CURRENCY: Currency = "UAH";
const MONTH_KEY_LENGTH = 7;
const CURRENCY_ORDER: readonly Currency[] = CurrencySchema.options;

export type StatisticsRecord = {
  bookId: string;
  bookTitle: string;
  currency: Currency | null;
  orderDate: Date | null;
  price: null | number;
  status: DeliveryStatus;
  storeName: null | string;
};

type PricedStatisticsRecord = StatisticsRecord & { price: number };

export function computeDeliveryStatistics({
  includeCancelled,
  records,
  topLimit,
}: {
  includeCancelled: boolean;
  records: StatisticsRecord[];
  topLimit: number;
}): DeliveryStatisticsView {
  return {
    byStore: buildByStore({ includeCancelled, records }),
    monthly: buildMonthly({ includeCancelled, records }),
    statusBreakdown: buildStatusBreakdown(records),
    summary: buildSummary({ includeCancelled, records }),
    topOrders: buildTopOrders({ includeCancelled, records, topLimit }),
  };
}

function averageByCurrency(records: PricedStatisticsRecord[]): CurrencyAverage[] {
  const accumulators = new Map<Currency, { count: number; sum: number }>();
  for (const record of records) {
    const currency = effectiveCurrency(record);
    const current = accumulators.get(currency) ?? { count: 0, sum: 0 };
    accumulators.set(currency, { count: current.count + 1, sum: current.sum + record.price });
  }

  const result: CurrencyAverage[] = [];
  for (const currency of CURRENCY_ORDER) {
    const accumulator = accumulators.get(currency);
    if (accumulator === undefined) {
      continue;
    }
    result.push({ average: accumulator.sum / accumulator.count, currency });
  }
  return result;
}

function buildByStore({
  includeCancelled,
  records,
}: {
  includeCancelled: boolean;
  records: StatisticsRecord[];
}): DeliveryStatisticsStore[] {
  const buckets = new Map<
    string,
    { ordersCount: number; store: string; totals: Map<Currency, number> }
  >();
  for (const record of records) {
    if (
      !isMainIncluded({ includeCancelled, record }) ||
      !hasPrice(record) ||
      record.storeName === null
    ) {
      continue;
    }
    const store = collapseSpaces(record.storeName);
    if (store.length === 0) {
      continue;
    }
    const key = store.toLowerCase();
    const bucket = buckets.get(key) ?? {
      ordersCount: 0,
      store,
      totals: new Map<Currency, number>(),
    };
    bucket.ordersCount += 1;
    const currency = effectiveCurrency(record);
    bucket.totals.set(currency, (bucket.totals.get(currency) ?? 0) + record.price);
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ordersCount: bucket.ordersCount,
      store: bucket.store,
      totalsByCurrency: toSortedCurrencyTotals(bucket.totals),
    }))
    .sort(
      (left, right) =>
        right.ordersCount - left.ordersCount || left.store.localeCompare(right.store),
    );
}

function buildMonthly({
  includeCancelled,
  records,
}: {
  includeCancelled: boolean;
  records: StatisticsRecord[];
}): DeliveryStatisticsMonth[] {
  const buckets = new Map<string, { ordersCount: number; totals: Map<Currency, number> }>();
  for (const record of records) {
    if (!isMainIncluded({ includeCancelled, record }) || record.orderDate === null) {
      continue;
    }
    const month = toIsoDate(record.orderDate).slice(0, MONTH_KEY_LENGTH);
    const bucket = buckets.get(month) ?? { ordersCount: 0, totals: new Map<Currency, number>() };
    bucket.ordersCount += 1;
    if (hasPrice(record)) {
      const currency = effectiveCurrency(record);
      bucket.totals.set(currency, (bucket.totals.get(currency) ?? 0) + record.price);
    }
    buckets.set(month, bucket);
  }

  return [...buckets.entries()]
    .sort(([leftMonth], [rightMonth]) => leftMonth.localeCompare(rightMonth))
    .map(([month, bucket]) => ({
      month,
      ordersCount: bucket.ordersCount,
      totalsByCurrency: toSortedCurrencyTotals(bucket.totals),
    }));
}

function buildStatusBreakdown(
  records: StatisticsRecord[],
): DeliveryStatisticsView["statusBreakdown"] {
  const priced = records.filter(hasPrice);
  return {
    active: buildStatusGroup(priced.filter((record) => isActiveDeliveryStatus(record.status))),
    cancelled: buildStatusGroup(priced.filter((record) => record.status === "cancelled")),
    received: buildStatusGroup(priced.filter((record) => record.status === "received")),
  };
}

function buildStatusGroup(records: PricedStatisticsRecord[]): DeliveryStatisticsStatusGroup {
  return { count: records.length, totalsByCurrency: sumByCurrency(records) };
}

function buildSummary({
  includeCancelled,
  records,
}: {
  includeCancelled: boolean;
  records: StatisticsRecord[];
}): DeliveryStatisticsSummary {
  const priced = records.filter(hasPrice);
  const mainPriced = priced.filter((record) => isMainIncluded({ includeCancelled, record }));

  return {
    activeByCurrency: sumByCurrency(
      priced.filter((record) => isActiveDeliveryStatus(record.status)),
    ),
    averageByCurrency: averageByCurrency(mainPriced),
    cancelledByCurrency: sumByCurrency(priced.filter((record) => record.status === "cancelled")),
    pricedOrdersCount: mainPriced.length,
    receivedByCurrency: sumByCurrency(priced.filter((record) => record.status === "received")),
    totalByCurrency: sumByCurrency(mainPriced),
  };
}

function buildTopOrders({
  includeCancelled,
  records,
  topLimit,
}: {
  includeCancelled: boolean;
  records: StatisticsRecord[];
  topLimit: number;
}): DeliveryTopOrder[] {
  return records
    .filter(hasPrice)
    .filter((record) => isMainIncluded({ includeCancelled, record }))
    .sort(compareTopOrders)
    .slice(0, topLimit)
    .map((record) => ({
      bookId: record.bookId,
      bookTitle: record.bookTitle,
      currency: record.currency,
      orderDate: toNullableIsoDate(record.orderDate),
      price: record.price,
      status: record.status,
      storeName: record.storeName,
    }));
}

function compareTopOrders(left: PricedStatisticsRecord, right: PricedStatisticsRecord): number {
  if (right.price !== left.price) {
    return right.price - left.price;
  }
  const leftDate = toNullableIsoDate(left.orderDate) ?? "";
  const rightDate = toNullableIsoDate(right.orderDate) ?? "";
  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate);
  }
  return left.bookId.localeCompare(right.bookId);
}

function effectiveCurrency(record: StatisticsRecord): Currency {
  return record.currency ?? DEFAULT_CURRENCY;
}

function hasPrice(record: StatisticsRecord): record is PricedStatisticsRecord {
  return record.price !== null;
}

function isMainIncluded({
  includeCancelled,
  record,
}: {
  includeCancelled: boolean;
  record: StatisticsRecord;
}): boolean {
  return record.status !== "cancelled" || includeCancelled;
}

function sumByCurrency(records: PricedStatisticsRecord[]): CurrencyTotal[] {
  const totals = new Map<Currency, number>();
  for (const record of records) {
    const currency = effectiveCurrency(record);
    totals.set(currency, (totals.get(currency) ?? 0) + record.price);
  }
  return toSortedCurrencyTotals(totals);
}

function toSortedCurrencyTotals(totals: Map<Currency, number>): CurrencyTotal[] {
  const result: CurrencyTotal[] = [];
  for (const currency of CURRENCY_ORDER) {
    const total = totals.get(currency);
    if (total === undefined) {
      continue;
    }
    result.push({ currency, total });
  }
  return result;
}
