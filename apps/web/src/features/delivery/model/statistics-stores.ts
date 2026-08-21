import type { BookOrderStatisticsStore, Currency, Nullable } from "@app/shared";

import { BOOK_ORDER_BEST_VALUE_STORE_RULES } from "@app/shared";

import { currencyAverageOf, currencyTotalOf } from "./statistics-currency";

export const STORE_METRICS = ["spend", "orders", "books"] as const;

export type StoreMetric = (typeof STORE_METRICS)[number];

export type StoreRow = {
  averageBookPrice: Nullable<number>;
  averageLandedBookCost: Nullable<number>;
  averageOrderAmount: Nullable<number>;
  booksCount: number;
  deltaPercent: Nullable<number>;
  deltaValue: Nullable<number>;
  ordersCount: number;
  share: number;
  store: string;
  value: number;
};

export type StoreScatter = {
  points: StoreScatterPoint[];
  withoutLandedData: string[];
};

export type StoreScatterPoint = {
  averageLandedBookCost: number;
  averageOrderAmount: number;
  booksCount: number;
  coveragePercent: number;
  ordersCount: number;
  store: string;
};

export function storeRows({
  comparisonStores,
  currency,
  metric,
  stores,
}: {
  comparisonStores: Nullable<readonly BookOrderStatisticsStore[]>;
  currency: Currency;
  metric: StoreMetric;
  stores: readonly BookOrderStatisticsStore[];
}): StoreRow[] {
  const previousByStore = new Map(
    (comparisonStores ?? []).map((store) => [
      store.store,
      storeMetricValue({ currency, metric, store }),
    ]),
  );

  const rows = stores
    .map((store) => {
      const value = storeMetricValue({ currency, metric, store });
      const previous = comparisonStores === null ? null : (previousByStore.get(store.store) ?? 0);

      return {
        averageBookPrice: currencyAverageOf(store.averageBookPriceByCurrency, currency),
        averageLandedBookCost: currencyAverageOf(store.averageLandedBookCostByCurrency, currency),
        averageOrderAmount: currencyAverageOf(store.averageOrderAmountByCurrency, currency),
        booksCount: store.booksCount,
        deltaPercent:
          previous === null || previous === 0 ? null : ((value - previous) / previous) * 100,
        deltaValue: previous === null ? null : value - previous,
        ordersCount: store.ordersCount,
        share: 0,
        store: store.store,
        value,
      };
    })
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value);

  const peak = rows[0]?.value ?? 0;
  return rows.map((row) => ({ ...row, share: peak === 0 ? 0 : row.value / peak }));
}

export function storeScatter({
  currency,
  stores,
}: {
  currency: Currency;
  stores: readonly BookOrderStatisticsStore[];
}): StoreScatter {
  const points: StoreScatterPoint[] = [];
  const withoutLandedData: string[] = [];

  for (const store of stores) {
    const averageLandedBookCost = currencyAverageOf(
      store.averageLandedBookCostByCurrency,
      currency,
    );
    const averageOrderAmount = currencyAverageOf(store.averageOrderAmountByCurrency, currency);
    const coverage = store.landedCoverageByCurrency.find((entry) => entry.currency === currency);
    const eligibleBooksCount =
      store.landedEligibleBooksCountByCurrency.find((entry) => entry.currency === currency)
        ?.count ?? 0;

    if (
      averageLandedBookCost === null ||
      averageOrderAmount === null ||
      coverage === undefined ||
      eligibleBooksCount < BOOK_ORDER_BEST_VALUE_STORE_RULES.minimumEligibleBooks
    ) {
      if (store.ordersCount > 0) withoutLandedData.push(store.store);
      continue;
    }

    points.push({
      averageLandedBookCost,
      averageOrderAmount,
      booksCount: coverage.countedBooksCount,
      coveragePercent: coverage.coveragePercent,
      ordersCount: store.ordersCount,
      store: store.store,
    });
  }

  return { points, withoutLandedData };
}

function storeMetricValue({
  currency,
  metric,
  store,
}: {
  currency: Currency;
  metric: StoreMetric;
  store: BookOrderStatisticsStore;
}): number {
  if (metric === "books") return store.booksCount;
  if (metric === "orders") return store.ordersCount;
  return currencyTotalOf(store.totalsByCurrency, currency) ?? 0;
}
