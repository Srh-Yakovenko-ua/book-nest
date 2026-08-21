import type {
  BookOrderStatisticsBestValueStore,
  BookOrderStatisticsBestValueStoreByCurrency,
  BookOrderStatisticsStore,
  Currency,
  CurrencyDelta,
  CurrencyTotal,
} from "@app/shared";

import { BOOK_ORDER_BEST_VALUE_STORE_RULES, collapseSpaces, CurrencySchema } from "@app/shared";

import type { AmountAccumulator, ClassifiedOrder } from "./statistics-scope.js";

import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import { buildLandedCostSummary } from "./landed-cost.js";
import { computeStatisticsCosts } from "./statistics-costs.js";
import { toCurrencyDeltas } from "./statistics-delta.js";
import {
  addItemPrices,
  addOrderAmount,
  averagesFromAmounts,
  totalsFromAmounts,
} from "./statistics-scope.js";

type StoreGroup = {
  orders: ClassifiedOrder[];
  store: string;
};

export function buildBestValueStoreByCurrency(
  orders: readonly ClassifiedOrder[],
): BookOrderStatisticsBestValueStoreByCurrency {
  const groups = groupOrdersByStore(orders);

  return CurrencySchema.options.flatMap((currency) => {
    const candidates = groups.flatMap((group) => toBestValueCandidate({ currency, group }));
    const winner = [...candidates].sort(compareBestValueCandidates).at(0);
    return winner === undefined ? [] : [winner];
  });
}

export function buildStoreScorecards(
  orders: readonly ClassifiedOrder[],
): BookOrderStatisticsStore[] {
  return groupOrdersByStore(orders)
    .map(toStoreScorecard)
    .sort(
      (left, right) =>
        right.ordersCount - left.ordersCount ||
        UKRAINIAN_COLLATION.compare(left.store, right.store),
    );
}

export function buildStoreSpendGrowth({
  current,
  previous,
}: {
  current: readonly ClassifiedOrder[];
  previous: readonly ClassifiedOrder[];
}): (CurrencyDelta & { store: string })[] {
  const previousByStore = new Map(
    groupOrdersByStore(previous).map((group) => [group.store.toLowerCase(), group]),
  );

  return groupOrdersByStore(current)
    .flatMap((group) => {
      const before = previousByStore.get(group.store.toLowerCase());
      const deltas = toCurrencyDeltas({
        current: totalsOf(group.orders),
        previous: before === undefined ? [] : totalsOf(before.orders),
      });
      return deltas.map((delta) => ({ ...delta, store: group.store }));
    })
    .filter((delta) => delta.absoluteDelta !== null && delta.absoluteDelta > 0)
    .sort(
      (left, right) =>
        (right.absoluteDelta ?? 0) - (left.absoluteDelta ?? 0) ||
        UKRAINIAN_COLLATION.compare(left.store, right.store),
    );
}

function compareBestValueCandidates(
  left: BookOrderStatisticsBestValueStore,
  right: BookOrderStatisticsBestValueStore,
): number {
  return (
    left.averageLandedBookCost - right.averageLandedBookCost ||
    right.eligibleBooksCount - left.eligibleBooksCount ||
    UKRAINIAN_COLLATION.compare(left.store, right.store)
  );
}

function groupOrdersByStore(orders: readonly ClassifiedOrder[]): StoreGroup[] {
  const groups = new Map<string, StoreGroup>();

  for (const order of orders) {
    const store = collapseSpaces(order.record.storeName);
    if (store.length === 0) {
      continue;
    }
    const group = groups.get(store.toLowerCase()) ?? { orders: [], store };
    group.orders.push(order);
    groups.set(store.toLowerCase(), group);
  }

  return [...groups.values()];
}

function toBestValueCandidate({
  currency,
  group,
}: {
  currency: Currency;
  group: StoreGroup;
}): BookOrderStatisticsBestValueStore[] {
  const landed = buildLandedCostSummary(group.orders).find((row) => row.currency === currency);
  if (
    landed === undefined ||
    landed.averageLandedBookCost === null ||
    landed.eligibleBooksCount < BOOK_ORDER_BEST_VALUE_STORE_RULES.minimumEligibleBooks
  ) {
    return [];
  }

  return [
    {
      averageLandedBookCost: landed.averageLandedBookCost,
      currency,
      eligibleBooksCount: landed.eligibleBooksCount,
      store: group.store,
    },
  ];
}

function toStoreScorecard(group: StoreGroup): BookOrderStatisticsStore {
  const orderAmounts: AmountAccumulator = new Map();
  const itemPrices: AmountAccumulator = new Map();
  let booksCount = 0;

  for (const order of group.orders) {
    booksCount += order.countedItems.length;
    addOrderAmount({ accumulator: orderAmounts, order });
    addItemPrices({ accumulator: itemPrices, order });
  }

  const landed = buildLandedCostSummary(group.orders);
  const costs = computeStatisticsCosts(group.orders);
  const ordersCount = group.orders.length;

  return {
    averageBookPriceByCurrency: averagesFromAmounts(itemPrices),
    averageBooksPerOrder: ordersCount === 0 ? null : booksCount / ordersCount,
    averageLandedBookCostByCurrency: landed.flatMap((row) =>
      row.averageLandedBookCost === null
        ? []
        : [{ average: row.averageLandedBookCost, currency: row.currency }],
    ),
    averageOrderAmountByCurrency: averagesFromAmounts(orderAmounts),
    booksCount,
    deliveryTotalByCurrency: costs.map((row) => ({
      currency: row.currency,
      total: row.deliveryTotal,
    })),
    discountTotalByCurrency: costs.map((row) => ({
      currency: row.currency,
      total: row.discountTotal,
    })),
    landedCoverageByCurrency: landed.map((row) => ({
      countedBooksCount: row.countedBooksCount,
      coveragePercent: row.coveragePercent,
      currency: row.currency,
      eligibleBooksCount: row.eligibleBooksCount,
    })),
    landedEligibleBooksCountByCurrency: landed.map((row) => ({
      count: row.eligibleBooksCount,
      currency: row.currency,
    })),
    ordersCount,
    store: group.store,
    totalsByCurrency: totalsFromAmounts(orderAmounts),
  };
}

function totalsOf(orders: readonly ClassifiedOrder[]): CurrencyTotal[] {
  const accumulator: AmountAccumulator = new Map();
  for (const order of orders) {
    addOrderAmount({ accumulator, order });
  }
  return totalsFromAmounts(accumulator);
}
