import type { BookOrderStatisticsSnapshot, BookOrderStatisticsView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { StatisticsKpi } from "./statistics-kpi";

const SNAPSHOT: BookOrderStatisticsSnapshot = {
  activeBooksCount: 46,
  activeOrdersCount: 38,
  activeShipmentsCount: 31,
  activeTotalsByCurrency: [
    { currency: "UAH", total: 22198 },
    { currency: "EUR", total: 83.4 },
  ],
};

const SUMMARY: BookOrderStatisticsView["summary"] = {
  activeBooksCount: 46,
  activeShipmentsCount: 31,
  activeTotalsByCurrency: SNAPSHOT.activeTotalsByCurrency,
  averageBookPriceByCurrency: [{ average: 725.06, currency: "UAH" }],
  averageBooksPerOrder: 1.4,
  averageOrderAmountByCurrency: [{ average: 1000.2, currency: "UAH" }],
  booksCount: 70,
  cancelledOrdersCount: 0,
  cancelledTotalsByCurrency: [],
  ordersCount: 51,
  receivedBooksCount: 25,
  receivedTotalsByCurrency: [],
  shipmentsCount: 51,
  totalsByCurrency: [
    { currency: "UAH", total: 40008 },
    { currency: "EUR", total: 170.4 },
  ],
};

function view(comparison: BookOrderStatisticsView["comparison"] = null): BookOrderStatisticsView {
  return {
    bestValueStoreByCurrency: [],
    byStore: [],
    comparison,
    costs: [],
    daily: [],
    landedCost: [],
    lifecycle: {
      books: {
        active: 0,
        cancelled: 0,
        partially_received: 0,
        partially_shipped: 0,
        received: 0,
        shipped: 0,
        total: 0,
      },
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
    },
    meta: {
      comparisonPeriod: null,
      currentPeriod: { from: "2026-01-01", to: "2026-08-21" },
      isTruncated: false,
      loadedOrdersCount: 51,
      maxOrders: 5000,
    },
    monthly: [],
    pulse: [],
    records: {
      bestValueStoreByCurrency: [],
      largestOrderByCurrency: [],
      mostActiveStore: { byBooks: null, byOrders: null },
      mostBooksInOrder: null,
      recordMonthByCurrency: [],
      scope: { isPeriodFiltered: true, isTruncated: false, period: { from: null, to: null } },
    },
    snapshot: SNAPSHOT,
    summary: SUMMARY,
    topOrders: [],
    topOrdersByCurrency: [],
  };
}

const COMPARISON: BookOrderStatisticsView["comparison"] = {
  averageBookPriceByCurrency: [
    {
      absoluteDelta: 292.34,
      currency: "UAH",
      current: 725.06,
      percentDelta: 67.6,
      previous: 432.72,
    },
  ],
  averageBooksPerOrder: { absoluteDelta: null, current: 1.4, percentDelta: null, previous: null },
  averageOrderAmountByCurrency: [],
  booksCount: { absoluteDelta: 25, current: 70, percentDelta: 55.6, previous: 45 },
  ordersCount: { absoluteDelta: 29, current: 51, percentDelta: 131.8, previous: 22 },
  receivedBooksCount: { absoluteDelta: -20, current: 25, percentDelta: -44.4, previous: 45 },
  shipmentsCount: { absoluteDelta: 29, current: 51, percentDelta: 131.8, previous: 22 },
  totalsByCurrency: [
    { absoluteDelta: 24846, currency: "UAH", current: 40008, percentDelta: 163.9, previous: 15162 },
  ],
};

function renderKpi(comparison: BookOrderStatisticsView["comparison"] = null) {
  return renderWithProviders(
    <StatisticsKpi currency="UAH" snapshot={SNAPSHOT} view={view(comparison)} />,
  );
}

describe("StatisticsKpi", () => {
  it("shows the chosen currency as the headline and the rest as a footnote", () => {
    renderKpi();

    expect(screen.getByText("40 008 UAH")).toBeInTheDocument();
    expect(screen.getByText("170,4 EUR")).toBeInTheDocument();
  });

  it("marks the money-in-transit card as a snapshot", () => {
    renderKpi();

    expect(screen.getByText("Станом на зараз")).toBeInTheDocument();
  });

  it("shows no comparison at all until one is asked for", () => {
    renderKpi();

    expect(screen.queryByText(/було/)).not.toBeInTheDocument();
  });

  it("puts the change and the previous value next to each metric", () => {
    renderKpi(COMPARISON);

    expect(screen.getByText("163,9%")).toBeInTheDocument();
    expect(screen.getByText("було 15 162 UAH")).toBeInTheDocument();
  });

  it("never compares the current snapshot against a past period", () => {
    renderKpi(COMPARISON);

    expect(screen.queryByText("було 22 198 UAH")).not.toBeInTheDocument();
  });

  it("carries the deltas into the compact metric row", () => {
    renderKpi(COMPARISON);

    expect(screen.getAllByText("було 22").length).toBe(2);
    expect(screen.getByText("44,4%")).toBeInTheDocument();
  });

  it("shows a dash instead of a zero when the currency has no value", () => {
    renderWithProviders(<StatisticsKpi currency="USD" snapshot={SNAPSHOT} view={view()} />);

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
