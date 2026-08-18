import type { InTransitAttention } from "@app/shared";

import { InTransitSummaryViewSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { InTransitAttentionData, InTransitSummaryInput } from "./delivery-summary.js";

import { buildInTransitAttention, buildInTransitSummaryView } from "./delivery-summary.js";

const TODAY = new Date("2026-07-08T00:00:00.000Z");

function attentionOf(data: InTransitAttentionData): InTransitAttention[] {
  return buildInTransitAttention({ ...data, today: TODAY });
}

function makeAttentionData(
  overrides: Partial<InTransitAttentionData> = {},
): InTransitAttentionData {
  return {
    awaitingDispatchOrdersCount: 0,
    delayedShipmentsCount: 0,
    earliestAwaitingOrderDate: null,
    earliestDelayedDate: null,
    nearestPickupUntil: null,
    pickupExpiredCount: 0,
    pickupExpiringCount: 0,
    unassignedBooksCount: 0,
    unassignedOrderId: null,
    unassignedOrdersCount: 0,
    withoutExpectedDateShipmentsCount: 0,
    withoutTrackingShipmentsCount: 0,
    ...overrides,
  };
}

function makeSummaryData(overrides: Partial<InTransitSummaryInput> = {}): InTransitSummaryInput {
  return {
    ...makeAttentionData(),
    activeBooksCount: 0,
    activeOrdersCount: 0,
    activeShipmentsCount: 0,
    arrivingSoonCount: 0,
    bookTotals: [],
    delayedCount: 0,
    expectedThisWeekCount: 0,
    inTransitCount: 0,
    nextExpectedDelivery: null,
    nextExpectedThisWeek: null,
    nextShipment: null,
    orderedCount: 0,
    ordersWithKnownTotalCount: 0,
    orderTotals: [],
    readyForPickupCount: 0,
    splitOrdersCount: 0,
    today: TODAY,
    uniqueStoresCount: 0,
    withoutExpectedDateCount: 0,
    withoutPriceCount: 0,
    withoutTrackingCount: 0,
    ...overrides,
  };
}

const EVERY_CASE = makeAttentionData({
  awaitingDispatchOrdersCount: 2,
  delayedShipmentsCount: 3,
  earliestAwaitingOrderDate: "2026-06-08",
  earliestDelayedDate: "2026-07-03",
  nearestPickupUntil: "2026-07-09",
  pickupExpiredCount: 1,
  pickupExpiringCount: 4,
  unassignedBooksCount: 5,
  unassignedOrderId: null,
  unassignedOrdersCount: 2,
  withoutExpectedDateShipmentsCount: 6,
  withoutTrackingShipmentsCount: 7,
});

function reasonsOf(attention: InTransitAttention[]): string[] {
  return attention.map((entry) => entry.reason);
}

describe("buildInTransitAttention", () => {
  it("lists every case from the most urgent to the least", () => {
    const attention = attentionOf(EVERY_CASE);

    expect(reasonsOf(attention)).toEqual([
      "pickup_expiring",
      "delayed",
      "awaiting_dispatch",
      "without_tracking",
      "without_expected_date",
      "unassigned_books",
    ]);
  });

  it("returns nothing at all when no case has anything to report", () => {
    expect(attentionOf(makeAttentionData())).toEqual([]);
  });

  it("leaves out the cases nobody is affected by", () => {
    const attention = attentionOf(makeAttentionData({ withoutTrackingShipmentsCount: 2 }));

    expect(attention).toEqual([{ count: 2, reason: "without_tracking" }]);
  });

  it("counts the days from the oldest late parcel, not from the newest one", () => {
    const attention = attentionOf(
      makeAttentionData({ delayedShipmentsCount: 3, earliestDelayedDate: "2026-07-03" }),
    );

    expect(attention).toEqual([{ count: 3, maxDelayDays: 5, reason: "delayed" }]);
  });

  it("counts the waiting days from the day the oldest order was placed", () => {
    const attention = attentionOf(
      makeAttentionData({
        awaitingDispatchOrdersCount: 2,
        earliestAwaitingOrderDate: "2026-06-08",
      }),
    );

    expect(attention).toEqual([{ count: 2, maxWaitingDays: 30, reason: "awaiting_dispatch" }]);
  });

  it("skips a case whose count is zero even when its date survived", () => {
    const attention = attentionOf(
      makeAttentionData({ delayedShipmentsCount: 0, earliestDelayedDate: "2026-07-03" }),
    );

    expect(attention).toEqual([]);
  });

  it("reports every waiting parcel as already expired and offers no next deadline", () => {
    const attention = attentionOf(
      makeAttentionData({
        nearestPickupUntil: null,
        pickupExpiredCount: 3,
        pickupExpiringCount: 3,
      }),
    );

    expect(attention).toEqual([
      { count: 3, expiredCount: 3, nearestPickupUntil: null, reason: "pickup_expiring" },
    ]);
  });

  it("keeps the soonest deadline that has not passed while some parcels are already expired", () => {
    const attention = attentionOf(
      makeAttentionData({
        nearestPickupUntil: "2026-07-09",
        pickupExpiredCount: 1,
        pickupExpiringCount: 3,
      }),
    );

    expect(attention).toEqual([
      { count: 3, expiredCount: 1, nearestPickupUntil: "2026-07-09", reason: "pickup_expiring" },
    ]);
  });

  it("names the order to open when the loose books all belong to one order", () => {
    const attention = attentionOf(
      makeAttentionData({
        unassignedBooksCount: 2,
        unassignedOrderId: "97d3f6f0-3c3f-4a2a-9f4c-6b5f2f0c1a11",
        unassignedOrdersCount: 1,
      }),
    );

    expect(attention).toEqual([
      {
        count: 2,
        ordersCount: 1,
        reason: "unassigned_books",
        revealOrderId: "97d3f6f0-3c3f-4a2a-9f4c-6b5f2f0c1a11",
      },
    ]);
  });

  it("names no order to open when the loose books are spread over several orders", () => {
    const attention = attentionOf(
      makeAttentionData({
        unassignedBooksCount: 5,
        unassignedOrderId: null,
        unassignedOrdersCount: 3,
      }),
    );

    expect(attention).toEqual([
      { count: 5, ordersCount: 3, reason: "unassigned_books", revealOrderId: null },
    ]);
  });

  it("produces cases that satisfy the shared attention contract", () => {
    const view = buildInTransitSummaryView(makeSummaryData(EVERY_CASE));

    expect(() => InTransitSummaryViewSchema.parse(view)).not.toThrow();
  });
});

describe("buildInTransitSummaryView", () => {
  it("counts a late parcel in its own unit and still counts the books it carries", () => {
    const view = buildInTransitSummaryView(
      makeSummaryData({
        activeBooksCount: 3,
        delayedCount: 3,
        delayedShipmentsCount: 1,
        earliestDelayedDate: "2026-07-06",
      }),
    );

    expect({ attention: view.attention, delayedCount: view.delayedCount }).toEqual({
      attention: [{ count: 1, maxDelayDays: 2, reason: "delayed" }],
      delayedCount: 3,
    });
  });

  it("carries no attention case when nothing needs the reader", () => {
    expect(buildInTransitSummaryView(makeSummaryData()).attention).toEqual([]);
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
