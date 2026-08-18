import { InTransitSummaryViewSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { InTransitSummaryData } from "./delivery-summary.js";

import { buildInTransitSummaryView } from "./delivery-summary.js";

function makeSummaryData(overrides: Partial<InTransitSummaryData> = {}): InTransitSummaryData {
  return {
    activeBooksCount: 0,
    activeOrdersCount: 0,
    activeShipmentsCount: 0,
    arrivingSoonCount: 0,
    attentionCount: 0,
    bookTotals: [],
    delayedCount: 0,
    expectedThisWeekCount: 0,
    inTransitCount: 0,
    nextExpectedDelivery: null,
    nextExpectedThisWeek: null,
    orderedCount: 0,
    ordersWithKnownTotalCount: 0,
    orderTotals: [],
    readyForPickupCount: 0,
    splitOrdersCount: 0,
    uniqueStoresCount: 0,
    withoutExpectedDateCount: 0,
    withoutPriceCount: 0,
    withoutTrackingCount: 0,
    ...overrides,
  };
}

const ONE_TROUBLED_BOOK = makeSummaryData({
  activeBooksCount: 1,
  activeOrdersCount: 1,
  activeShipmentsCount: 1,
  attentionCount: 1,
  delayedCount: 1,
  withoutPriceCount: 1,
  withoutTrackingCount: 1,
});

describe("buildInTransitSummaryView", () => {
  it("reports a single book that is late, untracked and priceless as one thing needing attention", () => {
    expect(buildInTransitSummaryView(ONE_TROUBLED_BOOK).attentionCount).toBe(1);
  });

  it("keeps each category counter at one for that same overlapping book", () => {
    const view = buildInTransitSummaryView(ONE_TROUBLED_BOOK);

    expect({
      delayedCount: view.delayedCount,
      withoutExpectedDateCount: view.withoutExpectedDateCount,
      withoutPriceCount: view.withoutPriceCount,
      withoutTrackingCount: view.withoutTrackingCount,
    }).toEqual({
      delayedCount: 1,
      withoutExpectedDateCount: 0,
      withoutPriceCount: 1,
      withoutTrackingCount: 1,
    });
  });

  it("folds an amount stored without a currency into the default currency", () => {
    const view = buildInTransitSummaryView(
      makeSummaryData({ bookTotals: [{ currency: null, total: 120 }] }),
    );

    expect(view.activeBooksTotalByCurrency).toEqual([{ currency: "UAH", total: 120 }]);
  });

  it("merges an amount without a currency into the explicit default-currency amount", () => {
    const view = buildInTransitSummaryView(
      makeSummaryData({
        bookTotals: [
          { currency: null, total: 120 },
          { currency: "UAH", total: 80 },
        ],
      }),
    );

    expect(view.activeBooksTotalByCurrency).toEqual([{ currency: "UAH", total: 200 }]);
  });

  it("orders currency totals by the shared currency list rather than by arrival", () => {
    const view = buildInTransitSummaryView(
      makeSummaryData({
        orderTotals: [
          { currency: "USD", total: 3 },
          { currency: "EUR", total: 2 },
          { currency: "UAH", total: 1 },
        ],
      }),
    );

    expect(view.activeOrdersTotalByCurrency).toEqual([
      { currency: "UAH", total: 1 },
      { currency: "EUR", total: 2 },
      { currency: "USD", total: 3 },
    ]);
  });

  it("omits a currency nobody spent anything in", () => {
    const view = buildInTransitSummaryView(
      makeSummaryData({ orderTotals: [{ currency: "EUR", total: 42 }] }),
    );

    expect(view.activeOrdersTotalByCurrency).toEqual([{ currency: "EUR", total: 42 }]);
  });

  it("returns an empty total list when nothing in transit carries a price", () => {
    const view = buildInTransitSummaryView(makeSummaryData());

    expect(view.activeBooksTotalByCurrency).toEqual([]);
  });

  it("rejects an amount stored in a currency the shared contract does not know", () => {
    expect(() =>
      buildInTransitSummaryView(makeSummaryData({ bookTotals: [{ currency: "GBP", total: 10 }] })),
    ).toThrow();
  });

  it("keeps book amounts and order amounts in separate fields", () => {
    const view = buildInTransitSummaryView(
      makeSummaryData({
        bookTotals: [{ currency: "UAH", total: 350 }],
        orderTotals: [{ currency: "UAH", total: 400 }],
      }),
    );

    expect({
      books: view.activeBooksTotalByCurrency,
      orders: view.activeOrdersTotalByCurrency,
    }).toEqual({
      books: [{ currency: "UAH", total: 350 }],
      orders: [{ currency: "UAH", total: 400 }],
    });
  });

  it("carries the week arrival, the priced-order tally and the split-order tally onto the view", () => {
    const view = buildInTransitSummaryView(
      makeSummaryData({
        activeOrdersCount: 3,
        nextExpectedThisWeek: "2026-03-18",
        ordersWithKnownTotalCount: 2,
        splitOrdersCount: 1,
      }),
    );

    expect({
      nextExpectedThisWeek: view.nextExpectedThisWeek,
      ordersWithKnownTotalCount: view.ordersWithKnownTotalCount,
      splitOrdersCount: view.splitOrdersCount,
    }).toEqual({
      nextExpectedThisWeek: "2026-03-18",
      ordersWithKnownTotalCount: 2,
      splitOrdersCount: 1,
    });
  });

  it("produces a summary that satisfies the shared in-transit summary contract", () => {
    const view = buildInTransitSummaryView(
      makeSummaryData({
        activeBooksCount: 5,
        activeOrdersCount: 2,
        activeShipmentsCount: 3,
        attentionCount: 2,
        bookTotals: [{ currency: "UAH", total: 350 }],
        nextExpectedDelivery: "2026-03-20",
        nextExpectedThisWeek: "2026-03-18",
        ordersWithKnownTotalCount: 1,
        orderTotals: [{ currency: null, total: 400 }],
        splitOrdersCount: 1,
      }),
    );

    expect(() => InTransitSummaryViewSchema.parse(view)).not.toThrow();
  });
});
