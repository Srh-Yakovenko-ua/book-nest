import type {
  BookOrderStatisticsMonth,
  BookOrderStatisticsMostActiveStore,
  BookOrderStatisticsRecordMonth,
  BookOrderStatisticsRecords,
  BookOrderStatisticsRecordScope,
  BookOrderStatisticsStore,
  BookOrderStatisticsStoreLeader,
  BookOrderStatisticsTopOrder,
  BookOrderStatisticsTopOrdersByCurrency,
  Nullable,
} from "@app/shared";

import { CurrencySchema } from "@app/shared";

import type { ClassifiedOrder } from "./statistics-scope.js";

import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import { buildBestValueStoreByCurrency } from "./statistics-stores.js";

export function buildPurchaseRecords({
  byStore,
  includedOrders,
  monthly,
  scope,
  topOrdersByCurrency,
}: {
  byStore: readonly BookOrderStatisticsStore[];
  includedOrders: readonly ClassifiedOrder[];
  monthly: readonly BookOrderStatisticsMonth[];
  scope: BookOrderStatisticsRecordScope;
  topOrdersByCurrency: BookOrderStatisticsTopOrdersByCurrency;
}): BookOrderStatisticsRecords {
  return {
    bestValueStoreByCurrency: buildBestValueStoreByCurrency(includedOrders),
    largestOrderByCurrency: topOrdersByCurrency.flatMap((group) => {
      const largest = group.orders.at(0);
      return largest === undefined ? [] : [{ currency: group.currency, order: largest }];
    }),
    mostActiveStore: buildMostActiveStore(byStore),
    mostBooksInOrder: buildMostBooksInOrder(topOrdersByCurrency),
    recordMonthByCurrency: buildRecordMonthByCurrency(monthly),
    scope,
  };
}

function buildMostActiveStore(
  byStore: readonly BookOrderStatisticsStore[],
): BookOrderStatisticsMostActiveStore {
  return {
    byBooks: pickStoreLeader({ byStore, metric: "booksCount" }),
    byOrders: pickStoreLeader({ byStore, metric: "ordersCount" }),
  };
}

function buildMostBooksInOrder(
  topOrdersByCurrency: BookOrderStatisticsTopOrdersByCurrency,
): Nullable<BookOrderStatisticsTopOrder> {
  const orders = topOrdersByCurrency.flatMap((group) => group.orders);

  return (
    [...orders].sort(
      (left, right) =>
        right.booksCount - left.booksCount ||
        (right.orderDate ?? "").localeCompare(left.orderDate ?? "") ||
        left.id.localeCompare(right.id),
    )[0] ?? null
  );
}

function buildRecordMonthByCurrency(
  monthly: readonly BookOrderStatisticsMonth[],
): BookOrderStatisticsRecordMonth[] {
  const best = new Map<string, BookOrderStatisticsRecordMonth>();

  for (const bucket of monthly) {
    for (const { currency, total } of bucket.totalsByCurrency) {
      const candidate: BookOrderStatisticsRecordMonth = {
        booksCount: bucket.booksCount,
        currency,
        month: bucket.month,
        ordersCount: bucket.ordersCount,
        total,
      };
      const current = best.get(currency);
      if (current === undefined || isBetterRecordMonth({ candidate, current })) {
        best.set(currency, candidate);
      }
    }
  }

  return CurrencySchema.options.flatMap((currency) => {
    const record = best.get(currency);
    return record === undefined ? [] : [record];
  });
}

function isBetterRecordMonth({
  candidate,
  current,
}: {
  candidate: BookOrderStatisticsRecordMonth;
  current: BookOrderStatisticsRecordMonth;
}): boolean {
  if (candidate.total !== current.total) {
    return candidate.total > current.total;
  }
  return candidate.month.localeCompare(current.month) > 0;
}

function pickStoreLeader({
  byStore,
  metric,
}: {
  byStore: readonly BookOrderStatisticsStore[];
  metric: "booksCount" | "ordersCount";
}): Nullable<BookOrderStatisticsStoreLeader> {
  const leader = [...byStore].sort(
    (left, right) =>
      right[metric] - left[metric] || UKRAINIAN_COLLATION.compare(left.store, right.store),
  )[0];

  if (leader === undefined || leader[metric] === 0) {
    return null;
  }

  return {
    booksCount: leader.booksCount,
    ordersCount: leader.ordersCount,
    store: leader.store,
  };
}
