import type { BookOrderStatisticsLifecycle } from "@app/shared";

import { describe, expect, it } from "vitest";

import { lifecycleBreakdown } from "./statistics-lifecycle";

const ORDERS = {
  active: 14,
  cancelled: 11,
  partially_received: 1,
  partially_shipped: 1,
  received: 20,
  shipped: 15,
  total: 62,
};

const BOOKS = { ...ORDERS, active: 30, received: 44, total: 100 };

const LIFECYCLE: BookOrderStatisticsLifecycle = {
  books: BOOKS,
  comparison: null,
  orders: ORDERS,
};

const WITH_COMPARISON: BookOrderStatisticsLifecycle = {
  ...LIFECYCLE,
  comparison: {
    books: {
      delta: { ...ORDERS, active: 0, received: 0, total: 0 },
      previous: BOOKS,
    },
    orders: {
      delta: {
        active: 14,
        cancelled: 0,
        partially_received: 1,
        partially_shipped: 1,
        received: -2,
        shipped: 15,
        total: 29,
      },
      previous: { ...ORDERS, active: 0, received: 22, total: 33 },
    },
  },
};

describe("lifecycleBreakdown", () => {
  it("keeps the canonical stage order instead of sorting by size", () => {
    expect(lifecycleBreakdown(LIFECYCLE, "orders").stages.map((row) => row.stage)).toEqual([
      "active",
      "partially_shipped",
      "shipped",
      "partially_received",
      "received",
    ]);
  });

  it("measures every share against the reported total, never against the busiest stage", () => {
    const { stages } = lifecycleBreakdown(LIFECYCLE, "orders");

    expect(stages.find((row) => row.stage === "received")?.totalShare).toBeCloseTo(20 / 62);
    expect(stages.find((row) => row.stage === "active")?.totalShare).toBeCloseTo(14 / 62);
  });

  it("shares the same denominator with the cancelled row", () => {
    const breakdown = lifecycleBreakdown(LIFECYCLE, "orders");

    expect(breakdown.cancelled.totalShare).toBeCloseTo(11 / 62);
    expect(breakdown.total).toBe(62);
  });

  it("never mixes the two units in one view", () => {
    expect(lifecycleBreakdown(LIFECYCLE, "books").stages[0]?.count).toBe(30);
    expect(lifecycleBreakdown(LIFECYCLE, "orders").stages[0]?.count).toBe(14);
  });

  it("keeps cancelled out of the main path", () => {
    const breakdown = lifecycleBreakdown(LIFECYCLE, "orders");

    expect(breakdown.stages.some((row) => row.stage === "cancelled")).toBe(false);
    expect(breakdown.cancelled.count).toBe(11);
  });

  it("has no comparison figures until a comparison is requested", () => {
    const breakdown = lifecycleBreakdown(LIFECYCLE, "orders");

    expect(breakdown.hasComparison).toBe(false);
    expect(breakdown.stages.every((row) => row.delta === null)).toBe(true);
    expect(breakdown.stages.every((row) => row.previous === null)).toBe(true);
    expect(breakdown.cancelled.delta).toBeNull();
  });

  it("passes the per-stage delta through, sign and all", () => {
    const { hasComparison, stages } = lifecycleBreakdown(WITH_COMPARISON, "orders");

    expect(hasComparison).toBe(true);
    expect(stages.find((row) => row.stage === "received")?.delta).toBe(-2);
    expect(stages.find((row) => row.stage === "active")?.delta).toBe(14);
  });

  it("carries the previous count so the delta can name where it came from", () => {
    const { stages } = lifecycleBreakdown(WITH_COMPARISON, "orders");

    expect(stages.find((row) => row.stage === "received")?.previous).toBe(22);
    expect(stages.find((row) => row.stage === "active")?.previous).toBe(0);
  });

  it("drops the unreachable partial stages from the books view", () => {
    expect(lifecycleBreakdown(LIFECYCLE, "books").stages.map((row) => row.stage)).toEqual([
      "active",
      "shipped",
      "received",
    ]);
  });

  it("reports a zero share instead of dividing by an empty total", () => {
    const empty: BookOrderStatisticsLifecycle = {
      books: { ...BOOKS },
      comparison: null,
      orders: {
        active: 0,
        cancelled: 0,
        partially_received: 0,
        partially_shipped: 0,
        received: 0,
        shipped: 0,
        total: 0,
      },
    };

    const breakdown = lifecycleBreakdown(empty, "orders");

    expect(breakdown.stages.every((row) => row.totalShare === 0)).toBe(true);
    expect(breakdown.cancelled.totalShare).toBe(0);
  });
});
