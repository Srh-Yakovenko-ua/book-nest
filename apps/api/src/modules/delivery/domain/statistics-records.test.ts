import type {
  BookOrderStatisticsInsights,
  BookOrderStatisticsRecordMonth,
  BookOrderStatisticsRecords,
  BookOrderStatisticsRecordScope,
  Currency,
  Nullable,
} from "@app/shared";

import { BOOK_ORDER_RECORD_RULES } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { ClassifiedOrder, OrderStatisticsRecord } from "./statistics-scope.js";

import { computeBookOrderStatistics, ORDER_STATISTICS_TOP_LIMIT } from "./order-statistics.js";
import { buildPurchaseRecords } from "./statistics-records.js";
import { classifyOrder } from "./statistics-scope.js";

const CANCELLED_AT = new Date("2026-03-06T09:00:00.000Z");

const UNFILTERED_SCOPE: BookOrderStatisticsRecordScope = {
  isPeriodFiltered: false,
  isTruncated: false,
  period: { from: null, to: null },
};

type RecordInput = {
  cancelledPrices?: Nullable<number>[];
  currency?: Nullable<Currency>;
  id: string;
  orderedOn?: Nullable<string>;
  prices: Nullable<number>[];
  storeName?: string;
  totalAmount?: Nullable<number>;
};

function hasOneDistinctTotal(totals: readonly number[]): boolean {
  return new Set(totals).size === 1;
}

function largestOrders(records: BookOrderStatisticsRecords) {
  return records.largestOrderByCurrency.flatMap((group) =>
    group.winners.map((winner) => ({ currency: group.currency, id: winner.id })),
  );
}

function orderOf(input: RecordInput): ClassifiedOrder {
  return classifyOrder({ includeCancelled: false, record: recordOf(input) });
}

function pulseRecordMonths(insights: BookOrderStatisticsInsights): string[] {
  return insights.spendByCurrency.flatMap((group) =>
    group.signals.flatMap((signal) => (signal.code === "record_month" ? [signal.month] : [])),
  );
}

function recordMonths(records: BookOrderStatisticsRecords): BookOrderStatisticsRecordMonth[] {
  return records.recordMonthByCurrency.flatMap((group) => group.winners);
}

function recordOf({
  cancelledPrices = [],
  currency = "UAH",
  id,
  orderedOn = "2026-03-04",
  prices,
  storeName = "Yakaboo",
  totalAmount = null,
}: RecordInput): OrderStatisticsRecord {
  return {
    currency,
    deliveryPrice: null,
    discount: null,
    id,
    isFree: false,
    items: [
      ...prices.map((price, index) => ({
        bookId: `${id}-book-${index}`,
        bookTitle: "Book",
        cancelledAt: null,
        id: `${id}-item-${index}`,
        price,
        receivedAt: null,
        shipmentId: null,
      })),
      ...cancelledPrices.map((price, index) => ({
        bookId: `${id}-cancelled-book-${index}`,
        bookTitle: "Book",
        cancelledAt: CANCELLED_AT,
        id: `${id}-cancelled-item-${index}`,
        price,
        receivedAt: null,
        shipmentId: null,
      })),
    ],
    orderDate: orderedOn === null ? null : new Date(`${orderedOn}T00:00:00.000Z`),
    orderNumber: null,
    shipments: [],
    storeName,
    totalAmount,
  };
}

function recordsOf({
  recordOrders = [],
  scope = UNFILTERED_SCOPE,
}: {
  recordOrders?: ClassifiedOrder[];
  scope?: BookOrderStatisticsRecordScope;
}) {
  return buildPurchaseRecords({ recordOrders, scope });
}

function statisticsOf({
  includeCancelled,
  records,
}: {
  includeCancelled: boolean;
  records: OrderStatisticsRecord[];
}): ReturnType<typeof computeBookOrderStatistics> {
  return computeBookOrderStatistics({
    activeRecords: records,
    comparisonPeriod: null,
    includeCancelled,
    previousRecords: null,
    records,
    scope: UNFILTERED_SCOPE,
    topLimit: ORDER_STATISTICS_TOP_LIMIT,
  });
}

function storeOrdersOf(entries: { prices: number[]; storeName: string }[]): ClassifiedOrder[] {
  return entries.map((entry, index) =>
    orderOf({ id: `order-${index}`, prices: entry.prices, storeName: entry.storeName }),
  );
}

describe("buildPurchaseRecords record month", () => {
  it("finds the priciest month of each currency without ever comparing the two", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "march-uah", prices: [900], totalAmount: 900 }),
        orderOf({ currency: "USD", id: "march-usd", prices: [20], totalAmount: 20 }),
        orderOf({ id: "april-uah", orderedOn: "2026-04-11", prices: [400], totalAmount: 400 }),
        orderOf({
          currency: "USD",
          id: "april-usd",
          orderedOn: "2026-04-11",
          prices: [50],
          totalAmount: 50,
        }),
      ],
    });

    expect(
      recordMonths(records).map((record) => ({
        currency: record.currency,
        month: record.month,
        total: record.total,
      })),
    ).toEqual([
      { currency: "UAH", month: "2026-03", total: 900 },
      { currency: "USD", month: "2026-04", total: 50 },
    ]);
  });

  it("counts the orders and books of a record month inside its own currency", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "uah-one", prices: [400, 100], totalAmount: 500 }),
        orderOf({ currency: "EUR", id: "eur-one", prices: [30, 30, 30], totalAmount: 90 }),
      ],
    });

    expect(
      recordMonths(records).map((record) => ({
        booksCount: record.booksCount,
        currency: record.currency,
        ordersCount: record.ordersCount,
      })),
    ).toEqual([
      { booksCount: 2, currency: "UAH", ordersCount: 1 },
      { booksCount: 3, currency: "EUR", ordersCount: 1 },
    ]);
  });

  it("ranks a tie between two months on the later one, not on iteration order", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "march", prices: [500], totalAmount: 500 }),
        orderOf({ id: "april", orderedOn: "2026-04-11", prices: [500], totalAmount: 500 }),
      ],
    });

    expect(recordMonths(records).map((record) => record.month)).toEqual(["2026-04", "2026-03"]);
  });

  it("carries the destinations of the very orders that made the month", () => {
    const records = recordsOf({
      recordOrders: [orderOf({ id: "march", prices: [500], totalAmount: 500 })],
    });

    expect(recordMonths(records).at(0)?.drilldown).toEqual({
      targets: [{ booksCount: 1, destination: "in_transit", ordersCount: 1 }],
    });
  });

  it("opens a record month on the whole month while no period narrows it", () => {
    const records = recordsOf({
      recordOrders: [orderOf({ id: "march", prices: [500], totalAmount: 500 })],
    });

    expect(recordMonths(records).at(0)?.range).toEqual({ from: "2026-03-01", to: "2026-03-31" });
  });

  it("clips a record month to the statistics period it was measured inside", () => {
    const records = recordsOf({
      recordOrders: [orderOf({ id: "march", prices: [500], totalAmount: 500 })],
      scope: {
        isPeriodFiltered: true,
        isTruncated: false,
        period: { from: "2026-03-02", to: "2026-04-20" },
      },
    });

    expect(recordMonths(records).at(0)?.range).toEqual({ from: "2026-03-02", to: "2026-03-31" });
  });

  it("leaves an undated order out of every record month", () => {
    const records = recordsOf({
      recordOrders: [orderOf({ id: "undated", orderedOn: null, prices: [700], totalAmount: 700 })],
    });

    expect(records.recordMonthByCurrency).toEqual([]);
  });
});

describe("buildPurchaseRecords order records", () => {
  it("crowns the priciest order of each currency without ever comparing the two", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "uah-big", prices: [9000], totalAmount: 9000 }),
        orderOf({ id: "uah-small", prices: [100], totalAmount: 100 }),
        orderOf({ currency: "USD", id: "usd", prices: [40], totalAmount: 40 }),
      ],
    });

    expect(largestOrders(records)).toEqual([
      { currency: "UAH", id: "uah-big" },
      { currency: "USD", id: "usd" },
    ]);
  });

  it("leaves an order whose amount is unknown out of the spending record", () => {
    const records = recordsOf({
      recordOrders: [orderOf({ id: "priceless", prices: [null, null] })],
    });

    expect(records.largestOrderByCurrency).toEqual([]);
  });

  it("crowns the fullest order from every included order, not from the priciest few", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "expensive", prices: [9000], totalAmount: 9000 }),
        orderOf({ id: "full", prices: [10, 10, 10, 10], totalAmount: 40 }),
      ],
    });

    expect(records.mostBooksInOrder.at(0)?.id).toBe("full");
  });

  it("lets an order that carries no price at all win the book count", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "priced", prices: [500, 500], totalAmount: 1000 }),
        orderOf({ id: "priceless", prices: [null, null, null] }),
      ],
    });

    expect(records.mostBooksInOrder.at(0)).toMatchObject({ booksCount: 3, id: "priceless" });
  });

  it("reports the amount of a most-books order as missing rather than as zero", () => {
    const records = recordsOf({
      recordOrders: [orderOf({ id: "priceless", prices: [null, null] })],
    });

    expect(records.mostBooksInOrder.at(0)?.totalAmount).toBeNull();
  });

  it("ranks a most-books tie on the later order, then on a stable id", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "b-older", orderedOn: "2026-03-01", prices: [10, 10] }),
        orderOf({ id: "a-newer", orderedOn: "2026-03-09", prices: [10, 10] }),
        orderOf({ id: "c-newer", orderedOn: "2026-03-09", prices: [10, 10] }),
      ],
    });

    expect(records.mostBooksInOrder.map((winner) => winner.id)).toEqual([
      "a-newer",
      "c-newer",
      "b-older",
    ]);
  });

  it("has no fullest order to report when nothing was bought", () => {
    expect(recordsOf({}).mostBooksInOrder).toEqual([]);
  });
});

describe("buildPurchaseRecords store records", () => {
  it("reports the busiest store by orders and by books as two separate answers", () => {
    const records = recordsOf({
      recordOrders: storeOrdersOf([
        { prices: [100, 100, 100, 100, 100], storeName: "Bulk Buyer" },
        { prices: [100], storeName: "Frequent" },
        { prices: [100], storeName: "Frequent" },
      ]),
    });

    expect({
      byBooks: records.mostActiveStore.byBooks.at(0)?.store,
      byOrders: records.mostActiveStore.byOrders.at(0)?.store,
    }).toEqual({ byBooks: "Bulk Buyer", byOrders: "Frequent" });
  });

  it("names the busiest store by a stable key rather than by its display name", () => {
    const records = recordsOf({
      recordOrders: storeOrdersOf([{ prices: [100], storeName: "Книгарня Є" }]),
    });

    expect(records.mostActiveStore.byOrders.at(0)?.storeKey).toBe("книгарня є");
  });

  it("has no busiest store to report when nothing was bought", () => {
    const records = recordsOf({});

    expect(records.mostActiveStore).toEqual({ byBooks: [], byOrders: [] });
  });

  it("names no best-value store while no book has a landed cost", () => {
    expect(recordsOf({}).bestValueStoreByCurrency).toEqual([]);
  });

  it("carries the truncation and filter scope so nothing can be called an all-time record", () => {
    const scope: BookOrderStatisticsRecordScope = {
      isPeriodFiltered: true,
      isTruncated: true,
      period: { from: "2026-03-01", to: "2026-03-31" },
    };

    expect(recordsOf({ scope }).scope).toEqual(scope);
  });
});

describe("buildPurchaseRecords ties", () => {
  it("returns both winners of a two-way tie and pads nothing with the runner-up below them", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "tied-a", orderedOn: "2026-03-02", prices: [10, 10] }),
        orderOf({ id: "tied-b", orderedOn: "2026-03-01", prices: [10, 10] }),
        orderOf({ id: "runner-up", orderedOn: "2026-03-03", prices: [10] }),
      ],
    });

    expect(records.mostBooksInOrder.map((winner) => winner.id)).toEqual(["tied-a", "tied-b"]);
  });

  it("returns exactly three winners when five orders tie on the same book count", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "tied-1", orderedOn: "2026-03-01", prices: [10, 10] }),
        orderOf({ id: "tied-2", orderedOn: "2026-03-02", prices: [10, 10] }),
        orderOf({ id: "tied-3", orderedOn: "2026-03-03", prices: [10, 10] }),
        orderOf({ id: "tied-4", orderedOn: "2026-03-04", prices: [10, 10] }),
        orderOf({ id: "tied-5", orderedOn: "2026-03-05", prices: [10, 10] }),
      ],
    });

    expect(records.mostBooksInOrder.map((winner) => winner.id)).toEqual([
      "tied-5",
      "tied-4",
      "tied-3",
    ]);
  });

  it("caps a five-way spending tie at the three winners the record rules allow", () => {
    const records = recordsOf({
      recordOrders: [1, 2, 3, 4, 5].map((index) =>
        orderOf({
          id: `spent-${index}`,
          orderedOn: `2026-03-0${index}`,
          prices: [500],
          totalAmount: 500,
        }),
      ),
    });

    expect(largestOrders(records)).toHaveLength(BOOK_ORDER_RECORD_RULES.maxTiedWinners);
  });

  it("returns a single winner while one order stands alone above the rest", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "fullest", orderedOn: "2026-03-01", prices: [10, 10, 10] }),
        orderOf({ id: "second", orderedOn: "2026-03-02", prices: [10, 10] }),
        orderOf({ id: "third", orderedOn: "2026-03-03", prices: [10, 10] }),
      ],
    });

    expect(records.mostBooksInOrder.map((winner) => winner.id)).toEqual(["fullest"]);
  });

  it("keeps an order one hryvnia below the best out of the spending winners", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "best-a", orderedOn: "2026-03-01", prices: [500], totalAmount: 500 }),
        orderOf({ id: "best-b", orderedOn: "2026-03-02", prices: [500], totalAmount: 500 }),
        orderOf({ id: "near-miss", orderedOn: "2026-03-03", prices: [499], totalAmount: 499 }),
      ],
    });

    expect(largestOrders(records).map((winner) => winner.id)).toEqual(["best-b", "best-a"]);
  });
});

describe("buildPurchaseRecords money ties", () => {
  it("ties two months whose totals differ only by the drift of adding floats", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "march-a", orderedOn: "2026-03-01", prices: [100.1], totalAmount: 100.1 }),
        orderOf({ id: "march-b", orderedOn: "2026-03-02", prices: [200.2], totalAmount: 200.2 }),
        orderOf({ id: "april", orderedOn: "2026-04-01", prices: [300.3], totalAmount: 300.3 }),
      ],
    });
    const winners = recordMonths(records);

    expect({
      months: winners.map((winner) => winner.month),
      totalsAreStrictlyEqual: hasOneDistinctTotal(winners.map((winner) => winner.total)),
    }).toEqual({ months: ["2026-04", "2026-03"], totalsAreStrictlyEqual: false });
  });

  it("keeps a month a full hryvnia below the best out of the winners", () => {
    const records = recordsOf({
      recordOrders: [
        orderOf({ id: "march", orderedOn: "2026-03-01", prices: [300.3], totalAmount: 300.3 }),
        orderOf({ id: "april", orderedOn: "2026-04-01", prices: [299.3], totalAmount: 299.3 }),
      ],
    });

    expect(recordMonths(records).map((winner) => winner.month)).toEqual(["2026-03"]);
  });
});

describe("buildPurchaseRecords tie determinism", () => {
  const TIED_ORDERS = [
    { id: "march-a", orderedOn: "2026-03-01", storeName: "Веди" },
    { id: "march-b", orderedOn: "2026-03-02", storeName: "Буки" },
    { id: "april-a", orderedOn: "2026-04-01", storeName: "Ґанок" },
    { id: "april-b", orderedOn: "2026-04-02", storeName: "Аква" },
  ];
  const SHUFFLE = [2, 0, 3, 1];
  const EXPECTED_WINNERS = {
    largestOrders: ["april-b", "april-a", "march-b"],
    months: ["2026-04", "2026-03"],
    mostBooks: ["april-b", "april-a", "march-b"],
    storesByOrders: ["Аква", "Буки", "Веди"],
  };

  function winnersOf(entries: typeof TIED_ORDERS) {
    const records = recordsOf({
      recordOrders: entries.map((entry) =>
        orderOf({ ...entry, prices: [15, 15], totalAmount: 30 }),
      ),
    });

    return {
      largestOrders: largestOrders(records).map((winner) => winner.id),
      months: recordMonths(records).map((winner) => winner.month),
      mostBooks: records.mostBooksInOrder.map((winner) => winner.id),
      storesByOrders: records.mostActiveStore.byOrders.map((winner) => winner.store),
    };
  }

  it("settles every tie on the documented fallbacks rather than on input order", () => {
    expect(winnersOf(TIED_ORDERS)).toEqual(EXPECTED_WINNERS);
  });

  it("returns the same winners in the same order after the input array is shuffled", () => {
    const shuffled = SHUFFLE.flatMap((index) => {
      const entry = TIED_ORDERS.at(index);
      return entry === undefined ? [] : [entry];
    });

    expect(winnersOf(shuffled)).toEqual(EXPECTED_WINNERS);
  });
});

describe("buildPurchaseRecords cancelled purchases", () => {
  const CANCELLED_WINNER_RECORDS: OrderStatisticsRecord[] = [
    recordOf({
      cancelledPrices: [1000, 1000, 1000, 1000, 1000],
      id: "cancelled-giant",
      orderedOn: "2026-05-10",
      prices: [],
      storeName: "Скасована",
      totalAmount: 5000,
    }),
    recordOf({
      id: "live-small",
      orderedOn: "2026-03-04",
      prices: [100, 100],
      storeName: "Yakaboo",
      totalAmount: 200,
    }),
  ];

  it("leaves a cancelled order out of every record while the toggle counts it everywhere else", () => {
    const view = statisticsOf({ includeCancelled: true, records: CANCELLED_WINNER_RECORDS });

    expect({
      largest: largestOrders(view.records).map((winner) => winner.id),
      months: recordMonths(view.records).map((winner) => winner.month),
      mostBooks: view.records.mostBooksInOrder.map((winner) => winner.id),
      storesByBooks: view.records.mostActiveStore.byBooks.map((winner) => winner.store),
      storesByOrders: view.records.mostActiveStore.byOrders.map((winner) => winner.store),
    }).toEqual({
      largest: ["live-small"],
      months: ["2026-03"],
      mostBooks: ["live-small"],
      storesByBooks: ["Yakaboo"],
      storesByOrders: ["Yakaboo"],
    });
  });

  it("keeps the pulse record month on the toggled projection while the record drops it", () => {
    const view = statisticsOf({ includeCancelled: true, records: CANCELLED_WINNER_RECORDS });

    expect({
      pulse: pulseRecordMonths(view.insights),
      record: recordMonths(view.records).map((winner) => winner.month),
    }).toEqual({ pulse: ["2026-05"], record: ["2026-03"] });
  });

  it("hides that same month from the pulse once the toggle stops counting cancelled orders", () => {
    const view = statisticsOf({ includeCancelled: false, records: CANCELLED_WINNER_RECORDS });

    expect({
      pulse: pulseRecordMonths(view.insights),
      record: recordMonths(view.records).map((winner) => winner.month),
    }).toEqual({ pulse: ["2026-03"], record: ["2026-03"] });
  });

  it("still ranks that same cancelled order first among the top orders of its currency", () => {
    const view = statisticsOf({ includeCancelled: true, records: CANCELLED_WINNER_RECORDS });

    expect(
      view.topOrdersByCurrency
        .find((group) => group.currency === "UAH")
        ?.orders.map((order) => order.id),
    ).toEqual(["cancelled-giant", "live-small"]);
  });

  it("counts only the surviving books of a partly cancelled order towards the fullest order", () => {
    const view = statisticsOf({
      includeCancelled: true,
      records: [
        recordOf({
          cancelledPrices: [1000, 1000, 1000, 1000],
          id: "mostly-cancelled",
          orderedOn: "2026-03-06",
          prices: [10],
        }),
        recordOf({ id: "live-small", orderedOn: "2026-03-04", prices: [100, 100] }),
      ],
    });

    expect(
      view.records.mostBooksInOrder.map((winner) => ({
        booksCount: winner.booksCount,
        id: winner.id,
      })),
    ).toEqual([{ booksCount: 2, id: "live-small" }]);
  });

  it("counts only the surviving books of a partly cancelled order towards the busiest store", () => {
    const view = statisticsOf({
      includeCancelled: true,
      records: [
        recordOf({
          cancelledPrices: [1000, 1000, 1000, 1000],
          id: "mostly-cancelled",
          prices: [10],
          storeName: "Скасована",
        }),
        recordOf({ id: "live-small", prices: [100, 100], storeName: "Yakaboo" }),
      ],
    });

    expect(
      view.records.mostActiveStore.byBooks.map((winner) => ({
        booksCount: winner.booksCount,
        store: winner.store,
      })),
    ).toEqual([{ booksCount: 2, store: "Yakaboo" }]);
  });
});

describe("buildPurchaseRecords record month range", () => {
  function rangeOf(period: { from: Nullable<string>; to: Nullable<string> }) {
    const records = recordsOf({
      recordOrders: [orderOf({ id: "march", orderedOn: "2026-03-10", prices: [500] })],
      scope: { isPeriodFiltered: true, isTruncated: false, period },
    });

    return recordMonths(records).at(0)?.range;
  }

  it("stops a record month on the day its period stops", () => {
    expect(rangeOf({ from: "2026-02-10", to: "2026-03-20" })).toEqual({
      from: "2026-03-01",
      to: "2026-03-20",
    });
  });

  it("keeps the whole month while the period surrounds it on both sides", () => {
    expect(rangeOf({ from: "2026-02-10", to: "2026-04-20" })).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
    });
  });

  it("clips a record month on both ends when the period opens and closes mid-month", () => {
    expect(rangeOf({ from: "2026-03-05", to: "2026-03-19" })).toEqual({
      from: "2026-03-05",
      to: "2026-03-19",
    });
  });

  it("opens the whole month while the period is closed on one side only", () => {
    expect(rangeOf({ from: "2026-03-05", to: null })).toEqual({
      from: "2026-03-05",
      to: "2026-03-31",
    });
  });
});

describe("buildPurchaseRecords best-value store", () => {
  function bestValueOf(entries: { prices: number[]; storeName: string }[]) {
    return recordsOf({ recordOrders: storeOrdersOf(entries) }).bestValueStoreByCurrency.flatMap(
      (group) =>
        group.winners.map((winner) => ({
          averageLandedBookCost: winner.averageLandedBookCost,
          eligibleBooksCount: winner.eligibleBooksCount,
          store: winner.store,
        })),
    );
  }

  it("passes over a cheaper store that never landed two books", () => {
    expect(
      bestValueOf([
        { prices: [50], storeName: "Одна Книга" },
        { prices: [100, 100], storeName: "Дві Книги" },
      ]),
    ).toEqual([{ averageLandedBookCost: 100, eligibleBooksCount: 2, store: "Дві Книги" }]);
  });

  it("names the cheapest store rather than the one with the most landed books", () => {
    expect(
      bestValueOf([
        { prices: [10, 10], storeName: "Дешева" },
        { prices: [100, 100, 100, 100], storeName: "Дорога" },
      ]),
    ).toEqual([{ averageLandedBookCost: 10, eligibleBooksCount: 2, store: "Дешева" }]);
  });

  it("breaks an equally cheap tie on landed book count first and on the store name second", () => {
    expect(
      bestValueOf([
        { prices: [100, 100], storeName: "Веди" },
        { prices: [100, 100], storeName: "Аква" },
        { prices: [100, 100, 100], storeName: "Буки" },
      ]).map((winner) => ({
        eligibleBooksCount: winner.eligibleBooksCount,
        store: winner.store,
      })),
    ).toEqual([
      { eligibleBooksCount: 3, store: "Буки" },
      { eligibleBooksCount: 2, store: "Аква" },
      { eligibleBooksCount: 2, store: "Веди" },
    ]);
  });
});
