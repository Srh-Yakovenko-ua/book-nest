import type {
  BookOrderStatisticsCosts,
  BookOrderStatisticsCurrencyCosts,
  Currency,
  Nullable,
} from "@app/shared";

import { CurrencySchema } from "@app/shared";

import type { ClassifiedOrder } from "./statistics-scope.js";

import { fromMinorUnits, toMinorUnits } from "./money-minor-units.js";

const COST_RULES = Object.freeze({
  chargedThreshold: 0,
  percentMultiplier: 100,
  undefinedDenominator: 0,
});

const CURRENCY_ORDER: readonly Currency[] = CurrencySchema.options;

type CurrencyCostBucket = {
  countedBooksCount: number;
  deliveryMinorUnits: number;
  discountMinorUnits: number;
  ordersWithDeliveryCount: number;
  ordersWithDiscountCount: number;
  rawSubtotalMinorUnits: number;
  spendMinorUnits: number;
};

export function computeStatisticsCosts(
  orders: readonly ClassifiedOrder[],
): BookOrderStatisticsCosts {
  const buckets = new Map<Currency, CurrencyCostBucket>();
  for (const order of orders) {
    const bucket = buckets.get(order.currency) ?? emptyBucket();
    accumulateOrderCosts({ bucket, order });
    buckets.set(order.currency, bucket);
  }

  return CURRENCY_ORDER.flatMap((currency) => {
    const bucket = buckets.get(currency);
    return bucket === undefined ? [] : [toCurrencyCosts({ bucket, currency })];
  });
}

function accumulateOrderCosts({
  bucket,
  order,
}: {
  bucket: CurrencyCostBucket;
  order: ClassifiedOrder;
}): void {
  const { deliveryPrice, discount } = order.record;

  bucket.countedBooksCount += order.countedItems.length;
  bucket.deliveryMinorUnits += toMinorUnits(deliveryPrice ?? 0);
  bucket.discountMinorUnits += toMinorUnits(discount ?? 0);
  bucket.rawSubtotalMinorUnits += sumKnownItemPricesInMinorUnits(order);
  bucket.spendMinorUnits += order.amount === null ? 0 : toMinorUnits(order.amount);

  if (isChargedAmount(deliveryPrice)) {
    bucket.ordersWithDeliveryCount += 1;
  }
  if (isChargedAmount(discount)) {
    bucket.ordersWithDiscountCount += 1;
  }
}

function emptyBucket(): CurrencyCostBucket {
  return {
    countedBooksCount: 0,
    deliveryMinorUnits: 0,
    discountMinorUnits: 0,
    ordersWithDeliveryCount: 0,
    ordersWithDiscountCount: 0,
    rawSubtotalMinorUnits: 0,
    spendMinorUnits: 0,
  };
}

function isChargedAmount(value: Nullable<number>): boolean {
  return value !== null && value > COST_RULES.chargedThreshold;
}

function sumKnownItemPricesInMinorUnits(order: ClassifiedOrder): number {
  return order.countedItems.reduce(
    (sum, item) => (item.price === null ? sum : sum + toMinorUnits(item.price)),
    0,
  );
}

function toCurrencyCosts({
  bucket,
  currency,
}: {
  bucket: CurrencyCostBucket;
  currency: Currency;
}): BookOrderStatisticsCurrencyCosts {
  const deliveryTotal = fromMinorUnits(bucket.deliveryMinorUnits);

  return {
    currency,
    deliveryCostPerBook:
      bucket.countedBooksCount === COST_RULES.undefinedDenominator
        ? null
        : deliveryTotal / bucket.countedBooksCount,
    deliveryShareOfSpendPercent:
      bucket.spendMinorUnits <= COST_RULES.undefinedDenominator
        ? null
        : toPercent({ part: bucket.deliveryMinorUnits, whole: bucket.spendMinorUnits }),
    deliveryTotal,
    discountShareOfRawSubtotalPercent:
      bucket.rawSubtotalMinorUnits === COST_RULES.undefinedDenominator
        ? null
        : toPercent({ part: bucket.discountMinorUnits, whole: bucket.rawSubtotalMinorUnits }),
    discountTotal: fromMinorUnits(bucket.discountMinorUnits),
    ordersWithDeliveryCount: bucket.ordersWithDeliveryCount,
    ordersWithDiscountCount: bucket.ordersWithDiscountCount,
  };
}

function toPercent({ part, whole }: { part: number; whole: number }): number {
  return (part / whole) * COST_RULES.percentMultiplier;
}
