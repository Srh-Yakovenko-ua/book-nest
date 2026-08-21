import type { BookOrderStatisticsDaily } from "@app/shared";

import type { AmountAccumulator, ClassifiedOrder } from "./statistics-scope.js";

import { toIsoDate } from "../../../core/iso-date.js";
import { addOrderAmount, totalsFromAmounts } from "./statistics-scope.js";

type DayBucket = {
  booksCount: number;
  orderAmounts: AmountAccumulator;
  ordersCount: number;
};

export function buildOrderDaily(orders: ClassifiedOrder[]): BookOrderStatisticsDaily {
  const buckets = new Map<string, DayBucket>();
  for (const order of orders) {
    const { orderDate } = order.record;
    if (orderDate === null) {
      continue;
    }
    const date = toIsoDate(orderDate);
    const bucket = buckets.get(date) ?? {
      booksCount: 0,
      orderAmounts: new Map(),
      ordersCount: 0,
    };
    bucket.booksCount += order.countedItems.length;
    bucket.ordersCount += 1;
    addOrderAmount({ accumulator: bucket.orderAmounts, order });
    buckets.set(date, bucket);
  }

  return [...buckets.entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([date, bucket]) => ({
      booksCount: bucket.booksCount,
      date,
      ordersCount: bucket.ordersCount,
      totalsByCurrency: totalsFromAmounts(bucket.orderAmounts),
    }));
}
