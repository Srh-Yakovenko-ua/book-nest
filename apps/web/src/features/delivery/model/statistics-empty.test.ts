import type { BookOrderHistorySummaryView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { StatisticsCompletedOrders } from "./statistics-empty";

import { statisticsEmptyKind, toStatisticsCompletedOrders } from "./statistics-empty";

const NO_COMPLETED_ORDERS: StatisticsCompletedOrders = { count: 0, status: "success" };

const SUMMARY: BookOrderHistorySummaryView = {
  cancelledBooksCount: 0,
  cancelledOrdersCount: 0,
  completedOrdersCount: 7,
  completedWithCancellationsCount: 0,
  completedWithoutCancellationsCount: 7,
  latestReceipt: null,
  receivedBooksCount: 9,
  receivedOrdersCount: 7,
  receivedSeriesBooksCount: 0,
  receivedSeriesCount: 0,
  receivedShipmentsCount: 7,
  receivedStandaloneBooksCount: 9,
};

describe("statisticsEmptyKind", () => {
  it.each<[string, StatisticsCompletedOrders]>([
    ["no orders at all", NO_COMPLETED_ORDERS],
    ["a pending summary", { status: "pending" }],
  ])("blames the filters first with %s", (_label, completedOrders) => {
    expect(
      statisticsEmptyKind({ activeOrdersCount: 0, completedOrders, hasActiveFilters: true }),
    ).toBe("filters");
  });

  it("calls an unfiltered miss with no active and no completed orders a first-order case", () => {
    expect(
      statisticsEmptyKind({
        activeOrdersCount: 0,
        completedOrders: NO_COMPLETED_ORDERS,
        hasActiveFilters: false,
      }),
    ).toBe("no_orders");
  });

  it.each<[string, number, StatisticsCompletedOrders]>([
    ["an active order", 2, NO_COMPLETED_ORDERS],
    ["a completed order", 0, { count: 3, status: "success" }],
    ["an active order while the summary loads", 1, { status: "pending" }],
    ["a failed summary", 0, { status: "error" }],
  ])("blames the period when there is %s", (_label, activeOrdersCount, completedOrders) => {
    expect(
      statisticsEmptyKind({ activeOrdersCount, completedOrders, hasActiveFilters: false }),
    ).toBe("period");
  });

  it("waits for the summary before calling the history empty", () => {
    expect(
      statisticsEmptyKind({
        activeOrdersCount: 0,
        completedOrders: { status: "pending" },
        hasActiveFilters: false,
      }),
    ).toBe("pending");
  });
});

describe("toStatisticsCompletedOrders", () => {
  it("counts the completed orders of a loaded summary", () => {
    expect(toStatisticsCompletedOrders({ data: SUMMARY, isInitialError: false })).toEqual({
      count: 7,
      status: "success",
    });
  });

  it("reports a summary that failed before any data arrived", () => {
    expect(toStatisticsCompletedOrders({ data: undefined, isInitialError: true })).toEqual({
      status: "error",
    });
  });

  it("reports a summary that is still loading", () => {
    expect(toStatisticsCompletedOrders({ data: undefined, isInitialError: false })).toEqual({
      status: "pending",
    });
  });
});
