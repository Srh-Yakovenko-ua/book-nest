import type {
  BookOrderDerivedStatus,
  BookOrderStatisticsMonth,
  BookOrderStatisticsStore,
  BookOrderStatisticsSummary,
  BookOrderStatisticsTopOrder,
  BookOrderStatisticsView,
  Currency,
  CurrencyAverage,
  CurrencyTotal,
  Nullable,
  ShipmentStatus,
} from "@app/shared";

import {
  BookOrderDerivedStatusSchema,
  collapseSpaces,
  CurrencySchema,
  DEFAULT_CURRENCY,
  isActiveShipmentStatus,
  resolveOrderFinancials,
} from "@app/shared";

import { assertNever } from "../../../core/assert-never.js";
import { toIsoDate, toNullableIsoDate } from "../../../core/iso-date.js";
import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import { computeBookOrderDerivedStatus } from "./order-derived-status.js";

export const ORDER_STATISTICS_TOP_LIMIT = 10;

const MONTH_KEY_LENGTH = 7;
const CURRENCY_ORDER: readonly Currency[] = CurrencySchema.options;
const DERIVED_STATUS = BookOrderDerivedStatusSchema.enum;

export type OrderStatisticsItemRecord = {
  bookId: string;
  bookTitle: string;
  cancelledAt: Nullable<Date>;
  price: Nullable<number>;
  receivedAt: Nullable<Date>;
  shipmentId: Nullable<string>;
};

export type OrderStatisticsRecord = {
  currency: Nullable<Currency>;
  deliveryPrice: Nullable<number>;
  discount: Nullable<number>;
  id: string;
  isFree: boolean;
  items: OrderStatisticsItemRecord[];
  orderDate: Nullable<Date>;
  orderNumber: Nullable<string>;
  shipments: OrderStatisticsShipmentRecord[];
  storeName: string;
  totalAmount: Nullable<number>;
};

export type OrderStatisticsShipmentRecord = {
  cancelledAt: Nullable<Date>;
  id: string;
  receivedAt: Nullable<Date>;
  status: ShipmentStatus;
};

type AmountAccumulator = Map<Currency, { count: number; sum: number }>;

type ClassifiedOrder = {
  amount: Nullable<number>;
  countedItems: OrderStatisticsItemRecord[];
  currency: Currency;
  derivedStatus: BookOrderDerivedStatus;
  isIncluded: boolean;
  record: OrderStatisticsRecord;
};

type MonthBucket = {
  booksCount: number;
  orderAmounts: AmountAccumulator;
  ordersCount: number;
};

type PricedOrder = {
  order: ClassifiedOrder;
  totalAmount: number;
};

type StoreBucket = {
  booksCount: number;
  itemPrices: AmountAccumulator;
  orderAmounts: AmountAccumulator;
  ordersCount: number;
  store: string;
};

export function computeBookOrderStatistics({
  includeCancelled,
  records,
  topLimit,
}: {
  includeCancelled: boolean;
  records: OrderStatisticsRecord[];
  topLimit: number;
}): BookOrderStatisticsView {
  const orders = records.map((record) => classifyOrder({ includeCancelled, record }));
  const includedOrders = orders.filter((order) => order.isIncluded);

  return {
    byStore: buildOrderByStore(includedOrders),
    monthly: buildOrderMonthly(includedOrders),
    summary: buildOrderSummary({ includedOrders, orders }),
    topOrders: buildTopBookOrders({ includedOrders, topLimit }),
  };
}

function addAmount({
  accumulator,
  amount,
  currency,
}: {
  accumulator: AmountAccumulator;
  amount: number;
  currency: Currency;
}): void {
  const current = accumulator.get(currency) ?? { count: 0, sum: 0 };
  accumulator.set(currency, { count: current.count + 1, sum: current.sum + amount });
}

function addItemPrices({
  accumulator,
  order,
}: {
  accumulator: AmountAccumulator;
  order: ClassifiedOrder;
}): void {
  for (const item of order.countedItems) {
    if (item.price === null) {
      continue;
    }
    addAmount({ accumulator, amount: item.price, currency: order.currency });
  }
}

function addOrderAmount({
  accumulator,
  order,
}: {
  accumulator: AmountAccumulator;
  order: ClassifiedOrder;
}): void {
  if (order.amount === null) {
    return;
  }
  addAmount({ accumulator, amount: order.amount, currency: order.currency });
}

function amountsForDerivedStatus({
  active,
  cancelled,
  received,
  status,
}: {
  active: AmountAccumulator;
  cancelled: AmountAccumulator;
  received: AmountAccumulator;
  status: BookOrderDerivedStatus;
}): AmountAccumulator {
  switch (status) {
    case DERIVED_STATUS.active:
    case DERIVED_STATUS.partially_received:
    case DERIVED_STATUS.partially_shipped:
    case DERIVED_STATUS.shipped:
      return active;
    case DERIVED_STATUS.cancelled:
      return cancelled;
    case DERIVED_STATUS.received:
      return received;
    default:
      return assertNever(status);
  }
}

function averagesFromAmounts(accumulator: AmountAccumulator): CurrencyAverage[] {
  const result: CurrencyAverage[] = [];
  for (const currency of CURRENCY_ORDER) {
    const amounts = accumulator.get(currency);
    if (amounts === undefined) {
      continue;
    }
    result.push({ average: amounts.sum / amounts.count, currency });
  }
  return result;
}

function buildOrderByStore(orders: ClassifiedOrder[]): BookOrderStatisticsStore[] {
  const buckets = new Map<string, StoreBucket>();
  for (const order of orders) {
    const store = collapseSpaces(order.record.storeName);
    if (store.length === 0) {
      continue;
    }
    const key = store.toLowerCase();
    const bucket = buckets.get(key) ?? {
      booksCount: 0,
      itemPrices: new Map(),
      orderAmounts: new Map(),
      ordersCount: 0,
      store,
    };
    bucket.booksCount += order.countedItems.length;
    bucket.ordersCount += 1;
    addOrderAmount({ accumulator: bucket.orderAmounts, order });
    addItemPrices({ accumulator: bucket.itemPrices, order });
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      averageBookPriceByCurrency: averagesFromAmounts(bucket.itemPrices),
      averageOrderAmountByCurrency: averagesFromAmounts(bucket.orderAmounts),
      booksCount: bucket.booksCount,
      ordersCount: bucket.ordersCount,
      store: bucket.store,
      totalsByCurrency: totalsFromAmounts(bucket.orderAmounts),
    }))
    .sort(
      (left, right) =>
        right.ordersCount - left.ordersCount ||
        UKRAINIAN_COLLATION.compare(left.store, right.store),
    );
}

function buildOrderMonthly(orders: ClassifiedOrder[]): BookOrderStatisticsMonth[] {
  const buckets = new Map<string, MonthBucket>();
  for (const order of orders) {
    const { orderDate } = order.record;
    if (orderDate === null) {
      continue;
    }
    const month = toIsoDate(orderDate).slice(0, MONTH_KEY_LENGTH);
    const bucket = buckets.get(month) ?? {
      booksCount: 0,
      orderAmounts: new Map(),
      ordersCount: 0,
    };
    bucket.booksCount += order.countedItems.length;
    bucket.ordersCount += 1;
    addOrderAmount({ accumulator: bucket.orderAmounts, order });
    buckets.set(month, bucket);
  }

  return [...buckets.entries()]
    .sort(([leftMonth], [rightMonth]) => leftMonth.localeCompare(rightMonth))
    .map(([month, bucket]) => ({
      booksCount: bucket.booksCount,
      month,
      ordersCount: bucket.ordersCount,
      totalsByCurrency: totalsFromAmounts(bucket.orderAmounts),
    }));
}

function buildOrderSummary({
  includedOrders,
  orders,
}: {
  includedOrders: ClassifiedOrder[];
  orders: ClassifiedOrder[];
}): BookOrderStatisticsSummary {
  const orderAmounts: AmountAccumulator = new Map();
  const bookPrices: AmountAccumulator = new Map();
  const active: AmountAccumulator = new Map();
  const cancelled: AmountAccumulator = new Map();
  const received: AmountAccumulator = new Map();
  for (const order of includedOrders) {
    addOrderAmount({ accumulator: orderAmounts, order });
    addItemPrices({ accumulator: bookPrices, order });
    addOrderAmount({
      accumulator: amountsForDerivedStatus({
        active,
        cancelled,
        received,
        status: order.derivedStatus,
      }),
      order,
    });
  }

  return {
    activeBooksCount: countItems({ orders: includedOrders, predicate: isActiveItem }),
    activeShipmentsCount: countActiveShipments(includedOrders),
    activeTotalsByCurrency: totalsFromAmounts(active),
    averageBookPriceByCurrency: averagesFromAmounts(bookPrices),
    averageOrderAmountByCurrency: averagesFromAmounts(orderAmounts),
    booksCount: includedOrders.reduce((count, order) => count + order.countedItems.length, 0),
    cancelledOrdersCount: orders.filter((order) => order.derivedStatus === DERIVED_STATUS.cancelled)
      .length,
    cancelledTotalsByCurrency: totalsFromAmounts(cancelled),
    ordersCount: includedOrders.length,
    receivedBooksCount: countItems({ orders: includedOrders, predicate: isReceivedItem }),
    receivedTotalsByCurrency: totalsFromAmounts(received),
    shipmentsCount: includedOrders.reduce(
      (count, order) => count + order.record.shipments.length,
      0,
    ),
    totalsByCurrency: totalsFromAmounts(orderAmounts),
  };
}

function buildTopBookOrders({
  includedOrders,
  topLimit,
}: {
  includedOrders: ClassifiedOrder[];
  topLimit: number;
}): BookOrderStatisticsTopOrder[] {
  const pricedOrders = includedOrders.flatMap((order) =>
    order.amount === null ? [] : [{ order, totalAmount: order.amount }],
  );

  return pricedOrders
    .sort(compareTopBookOrders)
    .slice(0, topLimit)
    .map(({ order, totalAmount }) => ({
      booksCount: order.countedItems.length,
      currency: order.currency,
      derivedStatus: order.derivedStatus,
      id: order.record.id,
      orderDate: toNullableIsoDate(order.record.orderDate),
      orderNumber: order.record.orderNumber,
      storeName: order.record.storeName,
      totalAmount,
    }));
}

function carriesActiveItem({
  order,
  shipment,
}: {
  order: ClassifiedOrder;
  shipment: OrderStatisticsShipmentRecord;
}): boolean {
  return order.record.items.some((item) => item.shipmentId === shipment.id && isActiveItem(item));
}

function classifyOrder({
  includeCancelled,
  record,
}: {
  includeCancelled: boolean;
  record: OrderStatisticsRecord;
}): ClassifiedOrder {
  const derivedStatus = computeBookOrderDerivedStatus({
    items: record.items,
    shipments: record.shipments,
  });
  const countedItems = includeCancelled
    ? record.items
    : record.items.filter((item) => item.cancelledAt === null);

  const financials = resolveOrderFinancials({
    deliveryPrice: record.deliveryPrice,
    discount: record.discount,
    isFree: record.isFree,
    itemPrices: record.items.map((item) => item.price),
    totalAmount: record.totalAmount,
  });

  return {
    amount: financials.effectiveTotalAmount,
    countedItems,
    currency: effectiveCurrency(record.currency),
    derivedStatus,
    isIncluded: includeCancelled || derivedStatus !== DERIVED_STATUS.cancelled,
    record,
  };
}

function compareTopBookOrders(left: PricedOrder, right: PricedOrder): number {
  if (right.totalAmount !== left.totalAmount) {
    return right.totalAmount - left.totalAmount;
  }
  const leftDate = toNullableIsoDate(left.order.record.orderDate) ?? "";
  const rightDate = toNullableIsoDate(right.order.record.orderDate) ?? "";
  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate);
  }
  return left.order.record.id.localeCompare(right.order.record.id);
}

function countActiveShipments(orders: ClassifiedOrder[]): number {
  return orders.reduce(
    (count, order) =>
      count +
      order.record.shipments.filter(
        (shipment) =>
          isActiveShipmentStatus(shipment.status) && carriesActiveItem({ order, shipment }),
      ).length,
    0,
  );
}

function countItems({
  orders,
  predicate,
}: {
  orders: ClassifiedOrder[];
  predicate: (item: OrderStatisticsItemRecord) => boolean;
}): number {
  return orders.reduce((count, order) => count + order.countedItems.filter(predicate).length, 0);
}

function effectiveCurrency(currency: Nullable<Currency>): Currency {
  return currency ?? DEFAULT_CURRENCY;
}

function isActiveItem(item: OrderStatisticsItemRecord): boolean {
  return item.cancelledAt === null && item.receivedAt === null;
}

function isReceivedItem(item: OrderStatisticsItemRecord): boolean {
  return item.receivedAt !== null;
}

function totalsFromAmounts(accumulator: AmountAccumulator): CurrencyTotal[] {
  const result: CurrencyTotal[] = [];
  for (const currency of CURRENCY_ORDER) {
    const amounts = accumulator.get(currency);
    if (amounts === undefined) {
      continue;
    }
    result.push({ currency, total: amounts.sum });
  }
  return result;
}
