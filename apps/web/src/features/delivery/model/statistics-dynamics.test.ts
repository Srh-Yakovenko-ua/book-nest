import type { BookOrderStatisticsMonth } from "@app/shared";

import { describe, expect, it } from "vitest";

import { monthlyPoints } from "./statistics-dynamics";

function month(
  key: string,
  { books = 0, orders = 0, uah = 0 }: { books?: number; orders?: number; uah?: number },
): BookOrderStatisticsMonth {
  return {
    booksCount: books,
    month: key,
    ordersCount: orders,
    totalsByCurrency: uah === 0 ? [] : [{ currency: "UAH", total: uah }],
  };
}

const RANGE = { from: "2026-01-01", to: "2026-04-30" };

describe("monthlyPoints", () => {
  it("fills the months the backend left out, so the chart has no gaps", () => {
    const points = monthlyPoints({
      comparisonMonths: null,
      currency: "UAH",
      metric: "spend",
      months: [month("2026-01", { uah: 500 }), month("2026-04", { uah: 900 })],
      range: RANGE,
    });

    expect(points.map((point) => point.month)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ]);
    expect(points.map((point) => point.value)).toEqual([500, 0, 0, 900]);
  });

  it("reads the chosen currency and never mixes another one in", () => {
    const points = monthlyPoints({
      comparisonMonths: null,
      currency: "EUR",
      metric: "spend",
      months: [month("2026-01", { uah: 500 })],
      range: { from: "2026-01-01", to: "2026-01-31" },
    });

    expect(points[0]?.value).toBe(0);
  });

  it("switches to counts for the non-money metrics", () => {
    const months = [month("2026-01", { books: 7, orders: 3, uah: 500 })];
    const range = { from: "2026-01-01", to: "2026-01-31" };

    expect(
      monthlyPoints({ comparisonMonths: null, currency: "UAH", metric: "orders", months, range })[0]
        ?.value,
    ).toBe(3);
    expect(
      monthlyPoints({ comparisonMonths: null, currency: "UAH", metric: "books", months, range })[0]
        ?.value,
    ).toBe(7);
  });

  it("lines the comparison series up with the end of the current one", () => {
    const points = monthlyPoints({
      comparisonMonths: [month("2025-03", { uah: 100 }), month("2025-04", { uah: 200 })],
      currency: "UAH",
      metric: "spend",
      months: [month("2026-03", { uah: 300 }), month("2026-04", { uah: 400 })],
      range: { from: "2026-03-01", to: "2026-04-30" },
    });

    expect(points).toEqual([
      { comparisonMonth: "2025-03", comparisonValue: 100, month: "2026-03", value: 300 },
      { comparisonMonth: "2025-04", comparisonValue: 200, month: "2026-04", value: 400 },
    ]);
  });

  it("leaves the comparison empty when it was never requested", () => {
    const points = monthlyPoints({
      comparisonMonths: null,
      currency: "UAH",
      metric: "spend",
      months: [month("2026-01", { uah: 500 })],
      range: { from: "2026-01-01", to: "2026-01-31" },
    });

    expect(points[0]?.comparisonValue).toBeNull();
    expect(points[0]?.comparisonMonth).toBeNull();
  });

  it("falls back to the months it was given when the period has no bounds", () => {
    const points = monthlyPoints({
      comparisonMonths: null,
      currency: "UAH",
      metric: "spend",
      months: [month("2025-11", { uah: 100 }), month("2026-01", { uah: 200 })],
      range: { from: null, to: null },
    });

    expect(points.map((point) => point.month)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});
