import type {
  BookOrderStatisticsCurrencyBestValueStores,
  BookOrderStatisticsCurrencyLargestOrders,
  BookOrderStatisticsCurrencyRecordMonths,
  BookOrderStatisticsMostActiveStore,
  BookOrderStatisticsOrderIdentity,
  BookOrderStatisticsRecordMonth,
  BookOrderStatisticsRecordMonthRange,
  BookOrderStatisticsRecords,
  BookOrderStatisticsRecordScope,
  BookOrderStatisticsStore,
  BookOrderStatisticsStoreLeader,
  BookOrderStatisticsTopOrder,
  Currency,
  Nullable,
  StatisticsPeriod,
} from "@app/shared";

import { BOOK_ORDER_RECORD_RULES, CurrencySchema } from "@app/shared";
import { endOfMonth, format, max, min, parseISO } from "date-fns";

import type { AmountAccumulator, ClassifiedOrder } from "./statistics-scope.js";

import { toNullableIsoDate } from "../../../core/iso-date.js";
import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import { toMinorUnits } from "./money-minor-units.js";
import { buildDrilldownBreakdown } from "./statistics-drilldown.js";
import { addOrderAmount, totalsFromAmounts } from "./statistics-scope.js";
import { buildBestValueStoreRankingByCurrency, buildStoreScorecards } from "./statistics-stores.js";

const RECORD_MONTH_FORMAT = {
  isoDay: "yyyy-MM-dd",
  monthKeyLength: 7,
} as const;

type MonthCurrencyBucket = {
  booksCount: number;
  currency: Currency;
  month: string;
  orderAmounts: AmountAccumulator;
  orders: ClassifiedOrder[];
  ordersCount: number;
};

type PricedOrder = {
  order: ClassifiedOrder;
  totalAmount: number;
};

export function buildPurchaseRecords({
  recordOrders,
  scope,
}: {
  recordOrders: readonly ClassifiedOrder[];
  scope: BookOrderStatisticsRecordScope;
}): BookOrderStatisticsRecords {
  return {
    bestValueStoreByCurrency: buildBestValueStoreRecords(recordOrders),
    largestOrderByCurrency: buildLargestOrderByCurrency(recordOrders),
    mostActiveStore: buildMostActiveStore(buildStoreScorecards(recordOrders)),
    mostBooksInOrder: buildMostBooksInOrder(recordOrders),
    recordMonthByCurrency: buildRecordMonthByCurrency({
      orders: recordOrders,
      period: scope.period,
    }),
    scope,
  };
}

export function buildRecordMonthByCurrency({
  orders,
  period,
}: {
  orders: readonly ClassifiedOrder[];
  period: StatisticsPeriod;
}): BookOrderStatisticsCurrencyRecordMonths[] {
  const buckets = new Map<string, MonthCurrencyBucket>();

  for (const order of orders) {
    const month = monthOf(order);
    if (month === null) {
      continue;
    }
    const key = `${month}:${order.currency}`;
    const bucket = buckets.get(key) ?? emptyMonthBucket({ currency: order.currency, month });
    bucket.booksCount += order.countedItems.length;
    bucket.orders.push(order);
    bucket.ordersCount += 1;
    addOrderAmount({ accumulator: bucket.orderAmounts, order });
    buckets.set(key, bucket);
  }

  const monthsByCurrency = new Map<Currency, BookOrderStatisticsRecordMonth[]>();
  for (const bucket of buckets.values()) {
    const recordMonth = toRecordMonth({ bucket, period });
    if (recordMonth === null) {
      continue;
    }
    monthsByCurrency.set(bucket.currency, [
      ...(monthsByCurrency.get(bucket.currency) ?? []),
      recordMonth,
    ]);
  }

  return CurrencySchema.options.flatMap((currency) => {
    const months = monthsByCurrency.get(currency);
    if (months === undefined) {
      return [];
    }
    const winners = pickTiedMoneyWinners({
      ranked: months.sort(compareRecordMonths),
      valueOf: (recordMonth) => recordMonth.total,
    });
    return winners.length === 0 ? [] : [{ currency, winners }];
  });
}

function buildBestValueStoreRecords(
  orders: readonly ClassifiedOrder[],
): BookOrderStatisticsCurrencyBestValueStores[] {
  return buildBestValueStoreRankingByCurrency(orders).flatMap((ranking) => {
    const winners = pickTiedMoneyWinners({
      ranked: ranking.candidates,
      valueOf: (candidate) => candidate.averageLandedBookCost,
    });
    return winners.length === 0 ? [] : [{ currency: ranking.currency, winners }];
  });
}

function buildLargestOrderByCurrency(
  orders: readonly ClassifiedOrder[],
): BookOrderStatisticsCurrencyLargestOrders[] {
  const buckets = new Map<Currency, PricedOrder[]>();

  for (const order of orders) {
    if (order.amount === null) {
      continue;
    }
    const bucket = buckets.get(order.currency) ?? [];
    bucket.push({ order, totalAmount: order.amount });
    buckets.set(order.currency, bucket);
  }

  return CurrencySchema.options.flatMap((currency) => {
    const bucket = buckets.get(currency);
    if (bucket === undefined) {
      return [];
    }
    const winners = pickTiedMoneyWinners({
      ranked: bucket.sort(compareByAmount),
      valueOf: (priced) => priced.totalAmount,
    }).map(toTopOrder);
    return winners.length === 0 ? [] : [{ currency, winners }];
  });
}

function buildMostActiveStore(
  byStore: readonly BookOrderStatisticsStore[],
): BookOrderStatisticsMostActiveStore {
  return {
    byBooks: pickStoreLeaders({ byStore, metric: "booksCount" }),
    byOrders: pickStoreLeaders({ byStore, metric: "ordersCount" }),
  };
}

function buildMostBooksInOrder(
  orders: readonly ClassifiedOrder[],
): BookOrderStatisticsOrderIdentity[] {
  const ranked = orders.filter((order) => order.countedItems.length > 0).sort(compareByBooksCount);

  return pickTiedCountWinners({ ranked, valueOf: (order) => order.countedItems.length }).map(
    toOrderIdentity,
  );
}

function compareByAmount(left: PricedOrder, right: PricedOrder): number {
  return (
    toMinorUnits(right.totalAmount) - toMinorUnits(left.totalAmount) ||
    compareByRecency(left.order, right.order)
  );
}

function compareByBooksCount(left: ClassifiedOrder, right: ClassifiedOrder): number {
  return right.countedItems.length - left.countedItems.length || compareByRecency(left, right);
}

function compareByRecency(left: ClassifiedOrder, right: ClassifiedOrder): number {
  return (
    (toNullableIsoDate(right.record.orderDate) ?? "").localeCompare(
      toNullableIsoDate(left.record.orderDate) ?? "",
    ) || left.record.id.localeCompare(right.record.id)
  );
}

function compareRecordMonths(
  left: BookOrderStatisticsRecordMonth,
  right: BookOrderStatisticsRecordMonth,
): number {
  return (
    toMinorUnits(right.total) - toMinorUnits(left.total) || right.month.localeCompare(left.month)
  );
}

function emptyMonthBucket({
  currency,
  month,
}: {
  currency: Currency;
  month: string;
}): MonthCurrencyBucket {
  return { booksCount: 0, currency, month, orderAmounts: new Map(), orders: [], ordersCount: 0 };
}

function monthOf(order: ClassifiedOrder): Nullable<string> {
  const orderedOn = toNullableIsoDate(order.record.orderDate);
  return orderedOn === null ? null : orderedOn.slice(0, RECORD_MONTH_FORMAT.monthKeyLength);
}

function pickStoreLeaders({
  byStore,
  metric,
}: {
  byStore: readonly BookOrderStatisticsStore[];
  metric: "booksCount" | "ordersCount";
}): BookOrderStatisticsStoreLeader[] {
  const ranked = byStore
    .filter((store) => store[metric] > 0)
    .sort(
      (left, right) =>
        right[metric] - left[metric] || UKRAINIAN_COLLATION.compare(left.store, right.store),
    );

  return pickTiedCountWinners({ ranked, valueOf: (store) => store[metric] }).map(toStoreLeader);
}

function pickTiedCountWinners<Winner>({
  ranked,
  valueOf,
}: {
  ranked: readonly Winner[];
  valueOf: (winner: Winner) => number;
}): Winner[] {
  return pickTiedWinners({ ranked, toComparableValue: (value) => value, valueOf });
}

function pickTiedMoneyWinners<Winner>({
  ranked,
  valueOf,
}: {
  ranked: readonly Winner[];
  valueOf: (winner: Winner) => number;
}): Winner[] {
  return pickTiedWinners({ ranked, toComparableValue: toMinorUnits, valueOf });
}

function pickTiedWinners<Winner>({
  ranked,
  toComparableValue,
  valueOf,
}: {
  ranked: readonly Winner[];
  toComparableValue: (value: number) => number;
  valueOf: (winner: Winner) => number;
}): Winner[] {
  const best = ranked.at(0);
  if (best === undefined) {
    return [];
  }
  const bestValue = toComparableValue(valueOf(best));

  return ranked
    .filter((winner) => toComparableValue(valueOf(winner)) === bestValue)
    .slice(0, BOOK_ORDER_RECORD_RULES.maxTiedWinners);
}

function toNavigableRange({
  month,
  period,
}: {
  month: string;
  period: StatisticsPeriod;
}): BookOrderStatisticsRecordMonthRange {
  const monthStart = parseISO(`${month}-01`);
  const monthEnd = endOfMonth(monthStart);
  const from = period.from === null ? monthStart : max([monthStart, parseISO(period.from)]);
  const to = period.to === null ? monthEnd : min([monthEnd, parseISO(period.to)]);

  return {
    from: format(from, RECORD_MONTH_FORMAT.isoDay),
    to: format(to, RECORD_MONTH_FORMAT.isoDay),
  };
}

function toOrderIdentity(order: ClassifiedOrder): BookOrderStatisticsOrderIdentity {
  return {
    booksCount: order.countedItems.length,
    currency: order.record.currency,
    derivedStatus: order.derivedStatus,
    id: order.record.id,
    orderDate: toNullableIsoDate(order.record.orderDate),
    orderNumber: order.record.orderNumber,
    storeName: order.record.storeName,
    totalAmount: order.amount,
  };
}

function toRecordMonth({
  bucket,
  period,
}: {
  bucket: MonthCurrencyBucket;
  period: StatisticsPeriod;
}): Nullable<BookOrderStatisticsRecordMonth> {
  const total = totalsFromAmounts(bucket.orderAmounts).find(
    (row) => row.currency === bucket.currency,
  );

  return total === undefined
    ? null
    : {
        booksCount: bucket.booksCount,
        currency: bucket.currency,
        drilldown: buildDrilldownBreakdown(bucket.orders),
        month: bucket.month,
        ordersCount: bucket.ordersCount,
        range: toNavigableRange({ month: bucket.month, period }),
        total: total.total,
      };
}

function toStoreLeader(store: BookOrderStatisticsStore): BookOrderStatisticsStoreLeader {
  return {
    booksCount: store.booksCount,
    drilldown: store.drilldown,
    ordersCount: store.ordersCount,
    store: store.store,
    storeKey: store.storeKey,
  };
}

function toTopOrder({ order, totalAmount }: PricedOrder): BookOrderStatisticsTopOrder {
  return { ...toOrderIdentity(order), totalAmount };
}
