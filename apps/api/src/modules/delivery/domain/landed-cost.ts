import type {
  BookOrderStatisticsLanded,
  BookOrderStatisticsLandedCost,
  Currency,
  Nullable,
} from "@app/shared";

import { CurrencySchema } from "@app/shared";

import type { ClassifiedOrder, OrderStatisticsItemRecord } from "./statistics-scope.js";

import { distributeMinorUnits, fromMinorUnits, toMinorUnits } from "./money-minor-units.js";

const FULL_COVERAGE_PERCENT = 100;
const EMPTY_COVERAGE_PERCENT = 0;

export type LandedCostAllocation = {
  adjustmentShare: number;
  deliveryShare: number;
  discountShare: number;
  itemId: string;
  rawPrice: number;
  realCost: number;
};

export type LandedCostResult =
  { allocations: LandedCostAllocation[]; status: "allocated" } | { status: "unavailable" };

type CurrencyLandedBucket = {
  countedBooksCount: number;
  landedMinorUnits: number;
  rawPricedBooksCount: number;
  rawPriceMinorUnits: number;
  realCostBooksCount: number;
};

export function allocateLandedCost({
  countedItems,
  deliveryPrice,
  discount,
  effectiveTotalAmount,
}: {
  countedItems: readonly OrderStatisticsItemRecord[];
  deliveryPrice: Nullable<number>;
  discount: Nullable<number>;
  effectiveTotalAmount: Nullable<number>;
}): LandedCostResult {
  if (effectiveTotalAmount === null || countedItems.length === 0) {
    return { status: "unavailable" };
  }

  const items = [...countedItems].sort((left, right) => left.id.localeCompare(right.id));
  const totalMinorUnits = toMinorUnits(effectiveTotalAmount);
  const deliveryMinorUnits = toMinorUnits(deliveryPrice ?? 0);
  const discountMinorUnits = toMinorUnits(discount ?? 0);

  const soleItem = items.at(0);
  const hasUnpricedItem = items.some((item) => item.price === null);
  if (hasUnpricedItem && (items.length > 1 || soleItem === undefined)) {
    return { status: "unavailable" };
  }

  if (hasUnpricedItem && soleItem !== undefined) {
    const allocation = wholeTotalAllocation({
      deliveryMinorUnits,
      discountMinorUnits,
      item: soleItem,
      totalMinorUnits,
    });
    return { allocations: [allocation], status: "allocated" };
  }

  const rawPrices = items.map((item) => toMinorUnits(item.price ?? 0));
  const subtotalMinorUnits = rawPrices.reduce((sum, price) => sum + price, 0);
  const expectedMinorUnits = subtotalMinorUnits + deliveryMinorUnits - discountMinorUnits;

  const discountShares = distributeMinorUnits({
    totalMinorUnits: discountMinorUnits,
    weights: rawPrices,
  });
  const deliveryShares = distributeMinorUnits({
    totalMinorUnits: deliveryMinorUnits,
    weights: rawPrices.map(() => 1),
  });
  const adjustmentShares = distributeMinorUnits({
    totalMinorUnits: totalMinorUnits - expectedMinorUnits,
    weights: rawPrices,
  });

  return {
    allocations: items.map((item, index) => {
      const adjustmentShare = adjustmentShares[index] ?? 0;
      const deliveryShare = deliveryShares[index] ?? 0;
      const discountShare = discountShares[index] ?? 0;
      const rawPrice = rawPrices[index] ?? 0;

      return {
        adjustmentShare,
        deliveryShare,
        discountShare,
        itemId: item.id,
        rawPrice,
        realCost: rawPrice - discountShare + deliveryShare + adjustmentShare,
      };
    }),
    status: "allocated",
  };
}

export function buildLandedCostSummary(
  orders: readonly ClassifiedOrder[],
): BookOrderStatisticsLanded {
  const buckets = new Map<Currency, CurrencyLandedBucket>();

  for (const order of orders) {
    const bucket = buckets.get(order.currency) ?? emptyBucket();
    bucket.countedBooksCount += order.countedItems.length;

    for (const item of order.countedItems) {
      if (item.price === null) {
        continue;
      }
      bucket.rawPriceMinorUnits += toMinorUnits(item.price);
      bucket.rawPricedBooksCount += 1;
    }

    const landed = allocateLandedCost({
      countedItems: order.countedItems,
      deliveryPrice: order.record.deliveryPrice,
      discount: order.record.discount,
      effectiveTotalAmount: order.amount,
    });

    if (landed.status === "allocated") {
      for (const allocation of landed.allocations) {
        bucket.landedMinorUnits += allocation.realCost;
        bucket.realCostBooksCount += 1;
      }
    }

    buckets.set(order.currency, bucket);
  }

  return CurrencySchema.options.flatMap((currency) => {
    const bucket = buckets.get(currency);
    return bucket === undefined ? [] : [toLandedCostRow({ bucket, currency })];
  });
}

function emptyBucket(): CurrencyLandedBucket {
  return {
    countedBooksCount: 0,
    landedMinorUnits: 0,
    rawPricedBooksCount: 0,
    rawPriceMinorUnits: 0,
    realCostBooksCount: 0,
  };
}

function toCoveragePercent(bucket: CurrencyLandedBucket): number {
  if (bucket.countedBooksCount === 0) {
    return EMPTY_COVERAGE_PERCENT;
  }
  return Math.min(
    FULL_COVERAGE_PERCENT,
    (bucket.realCostBooksCount / bucket.countedBooksCount) * FULL_COVERAGE_PERCENT,
  );
}

function toLandedCostRow({
  bucket,
  currency,
}: {
  bucket: CurrencyLandedBucket;
  currency: Currency;
}): BookOrderStatisticsLandedCost {
  const averageLandedBookCost =
    bucket.realCostBooksCount === 0
      ? null
      : fromMinorUnits(bucket.landedMinorUnits / bucket.realCostBooksCount);
  const averageRawBookPrice =
    bucket.rawPricedBooksCount === 0
      ? null
      : fromMinorUnits(bucket.rawPriceMinorUnits / bucket.rawPricedBooksCount);

  return {
    averageLandedBookCost,
    countedBooksCount: bucket.countedBooksCount,
    coveragePercent: toCoveragePercent(bucket),
    currency,
    differenceVsAverageRawBookPrice:
      averageLandedBookCost === null || averageRawBookPrice === null
        ? null
        : fromMinorUnits(toMinorUnits(averageLandedBookCost) - toMinorUnits(averageRawBookPrice)),
    eligibleBooksCount: bucket.realCostBooksCount,
  };
}

function wholeTotalAllocation({
  deliveryMinorUnits,
  discountMinorUnits,
  item,
  totalMinorUnits,
}: {
  deliveryMinorUnits: number;
  discountMinorUnits: number;
  item: OrderStatisticsItemRecord;
  totalMinorUnits: number;
}): LandedCostAllocation {
  return {
    adjustmentShare: totalMinorUnits + discountMinorUnits - deliveryMinorUnits,
    deliveryShare: deliveryMinorUnits,
    discountShare: discountMinorUnits,
    itemId: item.id,
    rawPrice: 0,
    realCost: totalMinorUnits,
  };
}
