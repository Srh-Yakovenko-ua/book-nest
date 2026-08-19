import type { BookOrderHistorySummaryView, Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import type { HistorySummaryLabels } from "./history-summary-cards";

import { buildHistorySummaryCards } from "./history-summary-cards";

const locale = "en-US";

const labels: HistorySummaryLabels = {
  cancelled: {
    empty: "cancelled.empty",
    label: "cancelled.label",
    orders: (count) => `cancelled.orders:${count}`,
  },
  completed: {
    empty: "completed.empty",
    label: "completed.label",
    withCancellations: (count) => `completed.with:${count}`,
    withoutCancellations: (count) => `completed.without:${count}`,
  },
  mobile: (key) => ({ compact: `compact.${key}`, detailed: `detailed.${key}` }),
  received: {
    empty: "received.empty",
    label: "received.label",
    orders: (count) => `received.orders:${count}`,
    shipments: (count) => `received.shipments:${count}`,
  },
  seriesToppedUp: {
    allStandalone: (count) => `series.allStandalone:${count}`,
    empty: "series.empty",
    label: "series.label",
    seriesBooks: (count) => `series.books:${count}`,
    standalone: (count) => `series.standalone:${count}`,
  },
  units: {
    books: (count) => `units.books:${count}`,
    orders: (count) => `units.orders:${count}`,
    series: (count) => `units.series:${count}`,
  },
};

const EMPTY: BookOrderHistorySummaryView = {
  cancelledBooksCount: 0,
  cancelledOrdersCount: 0,
  completedOrdersCount: 0,
  completedWithCancellationsCount: 0,
  completedWithoutCancellationsCount: 0,
  receivedBooksCount: 0,
  receivedOrdersCount: 0,
  receivedSeriesBooksCount: 0,
  receivedSeriesCount: 0,
  receivedShipmentsCount: 0,
  receivedStandaloneBooksCount: 0,
};

function buildCards(summary: Nullable<BookOrderHistorySummaryView>): LibrarySummaryCard[] {
  return buildHistorySummaryCards({ labels, locale, summary });
}

function cardAt(summary: Nullable<BookOrderHistorySummaryView>, index: number): LibrarySummaryCard {
  const card = buildCards(summary)[index];
  if (card === undefined) throw new Error(`no summary card at index ${index}`);
  return card;
}

function summaryOf(overrides: Partial<BookOrderHistorySummaryView>): BookOrderHistorySummaryView {
  return { ...EMPTY, ...overrides };
}

const RECEIVED = 0;
const CANCELLED = 1;
const COMPLETED = 2;
const SERIES = 3;

describe("buildHistorySummaryCards", () => {
  it("lays the four overview cards out in the agreed order", () => {
    expect(buildCards(EMPTY).map((card) => card.label)).toEqual([
      "received.label",
      "cancelled.label",
      "completed.label",
      "series.label",
    ]);
  });

  it("shows zeros while the summary is still loading", () => {
    expect(cardAt(null, RECEIVED)).toMatchObject({
      microfact: "received.empty",
      unit: "units.books:0",
      value: "0",
    });
  });

  it("leaves every card unclickable", () => {
    for (const card of buildCards(summaryOf({ receivedBooksCount: 3 }))) {
      expect(card).not.toHaveProperty("onClick");
    }
  });
});

describe("the received card", () => {
  it("reports the orders and the parcels the books arrived in", () => {
    const card = cardAt(
      summaryOf({ receivedBooksCount: 25, receivedOrdersCount: 12, receivedShipmentsCount: 14 }),
      RECEIVED,
    );

    expect(card.value).toBe("25");
    expect(card.unit).toBe("units.books:25");
    expect(card.microfact).toBe("received.orders:12 · received.shipments:14");
  });

  it("drops the parcels when none of the books came through one", () => {
    const card = cardAt(
      summaryOf({ receivedBooksCount: 3, receivedOrdersCount: 2, receivedShipmentsCount: 0 }),
      RECEIVED,
    );

    expect(card.microfact).toBe("received.orders:2");
  });

  it("falls back to the empty line when nothing has arrived", () => {
    expect(cardAt(EMPTY, RECEIVED).microfact).toBe("received.empty");
  });
});

describe("the cancelled card", () => {
  it("reports the orders a cancellation touched and never the parcels", () => {
    const card = cardAt(
      summaryOf({
        cancelledBooksCount: 7,
        cancelledOrdersCount: 5,
        receivedShipmentsCount: 14,
      }),
      CANCELLED,
    );

    expect(card.value).toBe("7");
    expect(card.microfact).toBe("cancelled.orders:5");
  });

  it("falls back to the empty line when nothing was cancelled", () => {
    expect(cardAt(EMPTY, CANCELLED).microfact).toBe("cancelled.empty");
  });
});

describe("the completed orders card", () => {
  it("splits the completed orders by whether a cancellation touched them", () => {
    const card = cardAt(
      summaryOf({
        completedOrdersCount: 18,
        completedWithCancellationsCount: 3,
        completedWithoutCancellationsCount: 15,
      }),
      COMPLETED,
    );

    expect(card.value).toBe("18");
    expect(card.unit).toBe("units.orders:18");
    expect(card.microfact).toBe("completed.without:15 · completed.with:3");
  });

  it("drops the half that is zero", () => {
    expect(
      cardAt(
        summaryOf({ completedOrdersCount: 18, completedWithoutCancellationsCount: 18 }),
        COMPLETED,
      ).microfact,
    ).toBe("completed.without:18");
    expect(
      cardAt(summaryOf({ completedOrdersCount: 4, completedWithCancellationsCount: 4 }), COMPLETED)
        .microfact,
    ).toBe("completed.with:4");
  });

  it("falls back to the empty line when no order has finished", () => {
    expect(cardAt(EMPTY, COMPLETED).microfact).toBe("completed.empty");
  });
});

describe("the topped-up series card", () => {
  it("splits the received books between series and standalone", () => {
    const card = cardAt(
      summaryOf({
        receivedBooksCount: 25,
        receivedSeriesBooksCount: 18,
        receivedSeriesCount: 12,
        receivedStandaloneBooksCount: 7,
      }),
      SERIES,
    );

    expect(card.value).toBe("12");
    expect(card.unit).toBe("units.series:12");
    expect(card.microfact).toBe("series.books:18 · series.standalone:7");
  });

  it("says so outright when every received book stands on its own", () => {
    const card = cardAt(
      summaryOf({
        receivedBooksCount: 8,
        receivedSeriesCount: 0,
        receivedStandaloneBooksCount: 8,
      }),
      SERIES,
    );

    expect(card.value).toBe("0");
    expect(card.microfact).toBe("series.allStandalone:8");
  });

  it("drops the standalone half when every received book belongs to a series", () => {
    expect(
      cardAt(
        summaryOf({
          receivedBooksCount: 6,
          receivedSeriesBooksCount: 6,
          receivedSeriesCount: 2,
        }),
        SERIES,
      ).microfact,
    ).toBe("series.books:6");
  });

  it("falls back to the empty line when nothing has arrived", () => {
    expect(cardAt(EMPTY, SERIES).microfact).toBe("series.empty");
  });
});
