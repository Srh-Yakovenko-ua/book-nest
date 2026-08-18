import type { InTransitSummaryView, Nullable } from "@app/shared";

import { parseISO } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import type { DeliverySummaryLabels } from "./in-transit-summary-cards";

import { buildDeliverySummaryCards } from "./in-transit-summary-cards";

const locale = "en-US";

const labels: DeliverySummaryLabels = {
  active: {
    empty: "active.empty",
    inTransit: (count) => `active.inTransit:${count}`,
    label: "active.label",
    ordered: (count) => `active.ordered:${count}`,
    readyForPickup: (count) => `active.readyForPickup:${count}`,
  },
  activeOrders: {
    empty: "activeOrders.empty",
    label: "activeOrders.label",
    noShipments: "activeOrders.noShipments",
    shipments: (count) => `activeOrders.shipments:${count}`,
    split: (count) => `activeOrders.split:${count}`,
  },
  expectedThisWeek: {
    empty: "expectedThisWeek.empty",
    label: "expectedThisWeek.label",
    onDate: (date) => `expectedThisWeek.onDate:${date}`,
    today: "expectedThisWeek.today",
    tomorrow: "expectedThisWeek.tomorrow",
  },
  mobile: (key) => ({ compact: `compact.${key}`, detailed: `detailed.${key}` }),
  ordersTotal: {
    coverageAll: (count) => `ordersTotal.coverageAll:${count}`,
    coverageNone: (count) => `ordersTotal.coverageNone:${count}`,
    coveragePartial: (known, total) => `ordersTotal.coveragePartial:${known}/${total}`,
    empty: "ordersTotal.empty",
    label: "ordersTotal.label",
  },
  units: {
    books: (count) => `units.books:${count}`,
    orders: (count) => `units.orders:${count}`,
  },
};

function buildCards(summary: Nullable<InTransitSummaryView>): LibrarySummaryCard[] {
  return buildDeliverySummaryCards({ labels, locale, summary });
}

function cardAt(summary: Nullable<InTransitSummaryView>, index: number): LibrarySummaryCard {
  const card = buildCards(summary)[index];
  if (card === undefined) throw new Error(`expected a summary card at index ${index}`);
  return card;
}

function makeSummary(overrides: Partial<InTransitSummaryView> = {}): InTransitSummaryView {
  return {
    activeBooksCount: 0,
    activeBooksTotalByCurrency: [],
    activeOrdersCount: 0,
    activeOrdersTotalByCurrency: [],
    activeShipmentsCount: 0,
    arrivingSoonCount: 0,
    attention: [],
    delayedCount: 0,
    expectedThisWeekCount: 0,
    inTransitCount: 0,
    nextExpectedDelivery: null,
    nextExpectedThisWeek: null,
    nextShipment: null,
    orderedCount: 0,
    ordersWithKnownTotalCount: 0,
    readyForPickupCount: 0,
    splitOrdersCount: 0,
    uniqueStoresCount: 0,
    withoutExpectedDateCount: 0,
    withoutPriceCount: 0,
    withoutTrackingCount: 0,
    ...overrides,
  };
}

describe("buildDeliverySummaryCards", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(parseISO("2026-08-18T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders four cards in a fixed order", () => {
    const cards = buildCards(makeSummary());

    expect(cards.map((card) => card.label)).toEqual([
      "active.label",
      "expectedThisWeek.label",
      "activeOrders.label",
      "ordersTotal.label",
    ]);
    expect(cards.map((card) => card.icon)).toEqual(["truck", "clock", "shopping-bag", "wallet"]);
    expect(cards.map((card) => card.iconTone)).toEqual(["primary", "info", "ink", "success"]);
    expect(cards.map((card) => card.mobileLabels?.compact)).toEqual([
      "compact.active",
      "compact.expectedThisWeek",
      "compact.activeOrders",
      "compact.ordersTotal",
    ]);
  });

  it("keeps four cards without a microfact when the summary is missing", () => {
    const cards = buildCards(null);

    expect(cards).toHaveLength(4);
    expect(cards.map((card) => card.value)).toEqual(["0", "0", "0", "—"]);
    expect(cards.map((card) => card.microfact)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  describe("active books card", () => {
    it("joins the full breakdown", () => {
      const card = cardAt(
        makeSummary({
          activeBooksCount: 9,
          inTransitCount: 3,
          orderedCount: 4,
          readyForPickupCount: 2,
        }),
        0,
      );

      expect(card.value).toBe("9");
      expect(card.unit).toBe("units.books:9");
      expect(card.microfact).toBe(
        "active.ordered:4 · active.inTransit:3 · active.readyForPickup:2",
      );
    });

    it("keeps only the two non-zero parts", () => {
      const card = cardAt(
        makeSummary({ activeBooksCount: 5, orderedCount: 2, readyForPickupCount: 3 }),
        0,
      );

      expect(card.microfact).toBe("active.ordered:2 · active.readyForPickup:3");
    });

    it("keeps a single non-zero part without a separator", () => {
      const card = cardAt(makeSummary({ activeBooksCount: 6, inTransitCount: 6 }), 0);

      expect(card.microfact).toBe("active.inTransit:6");
    });

    it("falls back to the empty line without active books", () => {
      const card = cardAt(makeSummary(), 0);

      expect(card.value).toBe("0");
      expect(card.microfact).toBe("active.empty");
    });
  });

  describe("expected this week card", () => {
    it("marks the nearest delivery as today", () => {
      const card = cardAt(
        makeSummary({ expectedThisWeekCount: 2, nextExpectedThisWeek: "2026-08-18" }),
        1,
      );

      expect(card.value).toBe("2");
      expect(card.unit).toBe("units.books:2");
      expect(card.microfact).toBe("expectedThisWeek.today");
    });

    it("marks the nearest delivery as tomorrow", () => {
      const card = cardAt(
        makeSummary({ expectedThisWeekCount: 1, nextExpectedThisWeek: "2026-08-19" }),
        1,
      );

      expect(card.microfact).toBe("expectedThisWeek.tomorrow");
    });

    it("formats a later day as a day and a month", () => {
      const card = cardAt(
        makeSummary({ expectedThisWeekCount: 3, nextExpectedThisWeek: "2026-08-21" }),
        1,
      );

      expect(card.microfact).toBe("expectedThisWeek.onDate:August 21");
    });

    it("falls back to the empty line without an expected date", () => {
      const withoutBooks = cardAt(
        makeSummary({ expectedThisWeekCount: 0, nextExpectedThisWeek: "2026-08-21" }),
        1,
      );
      const withoutDate = cardAt(makeSummary({ expectedThisWeekCount: 4 }), 1);

      expect(withoutBooks.microfact).toBe("expectedThisWeek.empty");
      expect(withoutDate.microfact).toBe("expectedThisWeek.empty");
    });
  });

  describe("active orders card", () => {
    it("appends the split orders to the shipments count", () => {
      const card = cardAt(
        makeSummary({ activeOrdersCount: 4, activeShipmentsCount: 6, splitOrdersCount: 2 }),
        2,
      );

      expect(card.value).toBe("4");
      expect(card.unit).toBe("units.orders:4");
      expect(card.microfact).toBe("activeOrders.shipments:6 · activeOrders.split:2");
    });

    it("keeps only the shipments count without split orders", () => {
      const card = cardAt(makeSummary({ activeOrdersCount: 3, activeShipmentsCount: 3 }), 2);

      expect(card.microfact).toBe("activeOrders.shipments:3");
    });

    it("reports missing shipments", () => {
      const card = cardAt(makeSummary({ activeOrdersCount: 2 }), 2);

      expect(card.microfact).toBe("activeOrders.noShipments");
    });

    it("falls back to the empty line without active orders", () => {
      const card = cardAt(makeSummary({ activeShipmentsCount: 1, splitOrdersCount: 1 }), 2);

      expect(card.value).toBe("0");
      expect(card.microfact).toBe("activeOrders.empty");
    });
  });

  describe("orders total card", () => {
    it("reports full coverage", () => {
      const card = cardAt(
        makeSummary({
          activeOrdersCount: 3,
          activeOrdersTotalByCurrency: [
            { currency: "UAH", total: 1450 },
            { currency: "USD", total: 30 },
          ],
          ordersWithKnownTotalCount: 3,
        }),
        3,
      );

      expect(card.value).toBe("1,450 UAH · 30 USD");
      expect(card.unit).toBeUndefined();
      expect(card.microfact).toBe("ordersTotal.coverageAll:3");
    });

    it("reports partial coverage", () => {
      const card = cardAt(
        makeSummary({
          activeOrdersCount: 5,
          activeOrdersTotalByCurrency: [{ currency: "UAH", total: 980 }],
          ordersWithKnownTotalCount: 2,
        }),
        3,
      );

      expect(card.value).toBe("980 UAH");
      expect(card.microfact).toBe("ordersTotal.coveragePartial:2/5");
    });

    it("shows a dash when no order has a known total", () => {
      const card = cardAt(makeSummary({ activeOrdersCount: 4 }), 3);

      expect(card.value).toBe("—");
      expect(card.microfact).toBe("ordersTotal.coverageNone:4");
    });

    it("falls back to the empty line without active orders", () => {
      const card = cardAt(makeSummary(), 3);

      expect(card.value).toBe("—");
      expect(card.microfact).toBe("ordersTotal.empty");
    });
  });
});
