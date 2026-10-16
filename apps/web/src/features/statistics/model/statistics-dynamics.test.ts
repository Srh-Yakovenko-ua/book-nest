import type { ReadingStatisticsBucket } from "@app/shared";

import { describe, expect, it } from "vitest";

import { dynamicsPoints, isLowerBoundComparison } from "./statistics-dynamics";

function bucket(overrides: Partial<ReadingStatisticsBucket> = {}): ReadingStatisticsBucket {
  return {
    completedReads: 3,
    drilldown: {
      filters: { finishedFrom: "2026-03-01", finishedTo: "2026-03-31" },
      kind: "completed_reads_subset",
      period: { from: "2026-01-01", to: "2026-03-31" },
    },
    end: "2026-03-31",
    pagesRead: 1200,
    start: "2026-03-01",
    uniqueBooksCompleted: 2,
    ...overrides,
  };
}

const CURRENT = bucket();

const COMPARISON = bucket({
  completedReads: 1,
  end: "2025-03-31",
  pagesRead: 400,
  start: "2025-03-01",
});

describe("dynamicsPoints", () => {
  it("carries the paired comparison bucket so its exact dates can be shown", () => {
    const [point] = dynamicsPoints({
      buckets: [CURRENT],
      comparisonBuckets: [COMPARISON],
      granularity: "month",
      isComparisonLowerBound: false,
      locale: "uk",
      metric: "pages",
    });

    expect(point?.comparisonBucket).toEqual(COMPARISON);
    expect(point?.comparisonValue).toBe(400);
  });

  it("drops the page comparison when the comparison history is only a lower bound", () => {
    const [point] = dynamicsPoints({
      buckets: [CURRENT],
      comparisonBuckets: [COMPARISON],
      granularity: "month",
      isComparisonLowerBound: true,
      locale: "uk",
      metric: "pages",
    });

    expect(point?.comparisonBucket).toBeNull();
    expect(point?.comparisonValue).toBeNull();
  });

  it("keeps the read comparison, which does not depend on the activity ledger", () => {
    const [point] = dynamicsPoints({
      buckets: [CURRENT],
      comparisonBuckets: [COMPARISON],
      granularity: "month",
      isComparisonLowerBound: true,
      locale: "uk",
      metric: "reads",
    });

    expect(point?.comparisonValue).toBe(1);
  });

  it("offers a shorter tick label than the full one", () => {
    const [point] = dynamicsPoints({
      buckets: [CURRENT],
      comparisonBuckets: null,
      granularity: "month",
      isComparisonLowerBound: false,
      locale: "en",
      metric: "reads",
    });

    expect(point?.label).toBe("Mar");
    expect(point?.compactLabel).toBe("M");
  });
});

describe("isLowerBoundComparison", () => {
  it("flags a comparison that starts before full tracking began", () => {
    expect(
      isLowerBoundComparison({
        comparison: { from: "2025-01-01", mode: "same_period_last_year", to: "2025-03-31" },
        reliableFrom: "2025-06-01",
      }),
    ).toBe(true);
  });

  it("trusts a comparison that starts on or after the reliable day", () => {
    expect(
      isLowerBoundComparison({
        comparison: { from: "2025-06-01", mode: "previous_period", to: "2025-12-31" },
        reliableFrom: "2025-06-01",
      }),
    ).toBe(false);
    expect(isLowerBoundComparison({ comparison: null, reliableFrom: "2025-06-01" })).toBe(false);
  });
});
