import type {
  Nullable,
  ReadingStatisticsBucket,
  ReadingStatisticsComparison,
  ReadingStatisticsGranularity,
} from "@app/shared";

import { isBefore, parseISO } from "date-fns";

import {
  formatDayNumeric,
  formatDayShort,
  formatMonthNarrow,
  formatMonthShort,
} from "./statistics-format";

export const DYNAMICS_METRICS = ["reads", "pages"] as const;

export type DynamicsMetric = (typeof DYNAMICS_METRICS)[number];

export type DynamicsPoint = {
  bucket: ReadingStatisticsBucket;
  compactLabel: string;
  comparisonBucket: Nullable<ReadingStatisticsBucket>;
  comparisonValue: Nullable<number>;
  key: string;
  label: string;
  value: number;
};

export function bucketValue(bucket: ReadingStatisticsBucket, metric: DynamicsMetric): number {
  return metric === "pages" ? bucket.pagesRead : bucket.completedReads;
}

export function canCompareDynamicsMetric({
  isComparisonLowerBound,
  metric,
}: {
  isComparisonLowerBound: boolean;
  metric: DynamicsMetric;
}): boolean {
  return metric === "reads" || !isComparisonLowerBound;
}

export function dynamicsPoints({
  buckets,
  comparisonBuckets,
  granularity,
  isComparisonLowerBound,
  locale,
  metric,
}: {
  buckets: readonly ReadingStatisticsBucket[];
  comparisonBuckets: Nullable<readonly ReadingStatisticsBucket[]>;
  granularity: ReadingStatisticsGranularity;
  isComparisonLowerBound: boolean;
  locale: string;
  metric: DynamicsMetric;
}): DynamicsPoint[] {
  const comparableBuckets = canCompareDynamicsMetric({ isComparisonLowerBound, metric })
    ? comparisonBuckets
    : null;

  return buckets.map((bucket, index) => {
    const comparisonBucket = comparableBuckets?.[index] ?? null;

    return {
      bucket,
      compactLabel: compactBucketLabel({ bucket, granularity, locale }),
      comparisonBucket,
      comparisonValue: comparisonBucket === null ? null : bucketValue(comparisonBucket, metric),
      key: bucket.start,
      label: bucketLabel({ bucket, granularity, locale }),
      value: bucketValue(bucket, metric),
    };
  });
}

export function isLowerBoundComparison({
  comparison,
  reliableFrom,
}: {
  comparison: Nullable<ReadingStatisticsComparison>;
  reliableFrom: string;
}): boolean {
  return comparison !== null && isBefore(parseISO(comparison.from), parseISO(reliableFrom));
}

function bucketLabel({
  bucket,
  granularity,
  locale,
}: {
  bucket: ReadingStatisticsBucket;
  granularity: ReadingStatisticsGranularity;
  locale: string;
}): string {
  switch (granularity) {
    case "day":
      return formatDayShort(bucket.start, locale);
    case "month":
      return formatMonthShort(bucket.start, locale);
    case "week":
      return formatDayShort(bucket.start, locale);
    case "year":
      return bucket.start.slice(0, 4);
  }
}

function compactBucketLabel({
  bucket,
  granularity,
  locale,
}: {
  bucket: ReadingStatisticsBucket;
  granularity: ReadingStatisticsGranularity;
  locale: string;
}): string {
  switch (granularity) {
    case "day":
      return formatDayNumeric(bucket.start, locale);
    case "month":
      return formatMonthNarrow(bucket.start, locale);
    case "week":
      return formatDayNumeric(bucket.start, locale);
    case "year":
      return bucket.start.slice(0, 4);
  }
}
