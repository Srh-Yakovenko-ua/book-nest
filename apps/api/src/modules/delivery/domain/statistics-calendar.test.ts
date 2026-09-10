import type {
  BookOrderStatisticsDaily,
  StatisticsCalendarCoverage,
  StatisticsDrilldownBreakdown,
  StatisticsDrilldownDestination,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type {
  ClassifiedOrder,
  OrderStatisticsItemRecord,
  OrderStatisticsRecord,
} from "./statistics-scope.js";

import { buildOrderCalendarCoverage, buildOrderDaily } from "./statistics-calendar.js";
import { classifyOrder } from "./statistics-scope.js";

type CoverageSplitCase = {
  name: string;
  records: OrderStatisticsRecord[];
};

type DayKeyCase = {
  expected: string;
  instant: Date;
  name: string;
};

const ORDER_INSTANTS = Object.freeze({
  boundaryDayEnd: new Date("2026-08-20T23:59:59.999Z"),
  boundaryNextDayStart: new Date("2026-08-21T00:00:00.000Z"),
  marchFifth: new Date("2026-03-05T10:00:00.000Z"),
  marchFirst: new Date("2026-03-01T10:00:00.000Z"),
  marchFourth: new Date("2026-03-04T08:30:00.000Z"),
});

const CANCELLED_AT = new Date("2026-03-06T09:00:00.000Z");

function coverageOf({
  includeCancelled = false,
  records,
}: {
  includeCancelled?: boolean;
  records: OrderStatisticsRecord[];
}): StatisticsCalendarCoverage {
  return buildOrderCalendarCoverage(includedOrdersOf({ includeCancelled, records }));
}

function dailyOf({
  includeCancelled = false,
  records,
}: {
  includeCancelled?: boolean;
  records: OrderStatisticsRecord[];
}): BookOrderStatisticsDaily {
  return buildOrderDaily(includedOrdersOf({ includeCancelled, records }));
}

function includedOrdersOf({
  includeCancelled = false,
  records,
}: {
  includeCancelled?: boolean;
  records: OrderStatisticsRecord[];
}): ClassifiedOrder[] {
  return records
    .map((record) => classifyOrder({ includeCancelled, record }))
    .filter((order) => order.isIncluded);
}

function makeItem(overrides: Partial<OrderStatisticsItemRecord> = {}): OrderStatisticsItemRecord {
  const bookId = overrides.bookId ?? "book-1";
  return {
    bookId,
    bookTitle: "Book 1",
    cancelledAt: null,
    id: `item-${bookId}`,
    price: null,
    receivedAt: null,
    shipmentId: null,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderStatisticsRecord> = {}): OrderStatisticsRecord {
  return {
    currency: "UAH",
    deliveryPrice: null,
    discount: null,
    id: "order-1",
    isFree: false,
    items: [makeItem()],
    orderDate: ORDER_INSTANTS.marchFourth,
    orderNumber: null,
    shipments: [],
    storeName: "Yakaboo",
    totalAmount: null,
    ...overrides,
  };
}

function targets(
  rows: { books: number; destination: StatisticsDrilldownDestination; orders: number }[],
): StatisticsDrilldownBreakdown {
  return {
    targets: rows.map(({ books, destination, orders }) => ({
      booksCount: books,
      destination,
      ordersCount: orders,
    })),
  };
}

const CANCELLED_MARCH_FIFTH_ORDER = makeOrder({
  id: "order-cancelled",
  isFree: false,
  items: [makeItem({ bookId: "book-cancelled", cancelledAt: CANCELLED_AT, price: 500 })],
  orderDate: ORDER_INSTANTS.marchFifth,
  totalAmount: 500,
});

const LIVE_MARCH_FOURTH_ORDER = makeOrder({
  id: "order-live",
  isFree: false,
  items: [makeItem({ bookId: "book-live", price: 120 })],
  totalAmount: 120,
});

const DAY_KEY_CASES: DayKeyCase[] = [
  {
    expected: "2026-08-20",
    instant: ORDER_INSTANTS.boundaryDayEnd,
    name: "an order placed at the last millisecond of a UTC day stays on that day",
  },
  {
    expected: "2026-08-21",
    instant: ORDER_INSTANTS.boundaryNextDayStart,
    name: "an order placed at the first millisecond of a UTC day opens that day",
  },
  {
    expected: "2026-03-04",
    instant: ORDER_INSTANTS.marchFourth,
    name: "an order placed in the middle of a UTC day lands on that day",
  },
];

describe("buildOrderDaily keys days by the UTC calendar", () => {
  it.each(DAY_KEY_CASES)("$name", ({ expected, instant }) => {
    const daily = dailyOf({ records: [makeOrder({ orderDate: instant })] });

    expect(daily.map((day) => day.date)).toEqual([expected]);
  });

  it("splits two orders one millisecond apart across the UTC midnight they straddle", () => {
    const daily = dailyOf({
      records: [
        makeOrder({ id: "order-before", orderDate: ORDER_INSTANTS.boundaryDayEnd }),
        makeOrder({ id: "order-after", orderDate: ORDER_INSTANTS.boundaryNextDayStart }),
      ],
    });

    expect(daily.map((day) => day.date)).toEqual(["2026-08-20", "2026-08-21"]);
  });

  it("skips an order that carries no order date rather than bucketing it", () => {
    const daily = dailyOf({
      records: [
        makeOrder({ id: "order-undated", orderDate: null }),
        makeOrder({ id: "order-dated", orderDate: ORDER_INSTANTS.marchFourth }),
      ],
    });

    expect(daily).toEqual([
      {
        booksCount: 1,
        date: "2026-03-04",
        drilldown: targets([{ books: 1, destination: "in_transit", orders: 1 }]),
        ordersCount: 1,
        totalsByCurrency: [],
      },
    ]);
  });
});

describe("buildOrderDaily merges the orders of a single day", () => {
  it("folds several orders placed on one day into a single row", () => {
    const daily = dailyOf({
      records: [
        makeOrder({
          id: "order-a",
          isFree: false,
          items: [makeItem({ bookId: "book-a", price: 100 }), makeItem({ bookId: "book-b" })],
          totalAmount: 300,
        }),
        makeOrder({
          id: "order-b",
          isFree: false,
          items: [makeItem({ bookId: "book-c" })],
          totalAmount: 200,
        }),
      ],
    });

    expect(daily).toEqual([
      {
        booksCount: 3,
        date: "2026-03-04",
        drilldown: targets([{ books: 3, destination: "in_transit", orders: 2 }]),
        ordersCount: 2,
        totalsByCurrency: [{ currency: "UAH", total: 500 }],
      },
    ]);
  });

  it("keeps every currency of a day apart instead of summing them into one number", () => {
    const daily = dailyOf({
      records: [
        makeOrder({ currency: "USD", id: "order-usd", totalAmount: 40 }),
        makeOrder({ currency: "UAH", id: "order-uah", totalAmount: 500 }),
        makeOrder({ currency: "EUR", id: "order-eur", totalAmount: 25 }),
      ],
    });

    expect(daily).toEqual([
      {
        booksCount: 3,
        date: "2026-03-04",
        drilldown: targets([{ books: 3, destination: "in_transit", orders: 3 }]),
        ordersCount: 3,
        totalsByCurrency: [
          { currency: "UAH", total: 500 },
          { currency: "EUR", total: 25 },
          { currency: "USD", total: 40 },
        ],
      },
    ]);
  });

  it("counts an order of unknown amount without inventing a total for its day", () => {
    const daily = dailyOf({
      records: [makeOrder({ id: "order-priceless", items: [makeItem({ price: null })] })],
    });

    expect(daily).toEqual([
      {
        booksCount: 1,
        date: "2026-03-04",
        drilldown: targets([{ books: 1, destination: "in_transit", orders: 1 }]),
        ordersCount: 1,
        totalsByCurrency: [],
      },
    ]);
  });
});

describe("buildOrderDaily returns a sparse ascending series", () => {
  it("omits the quiet days between two days that carry orders", () => {
    const daily = dailyOf({
      records: [
        makeOrder({ id: "order-first", orderDate: ORDER_INSTANTS.marchFirst }),
        makeOrder({ id: "order-fifth", orderDate: ORDER_INSTANTS.marchFifth }),
      ],
    });

    expect(daily.map((day) => day.date)).toEqual(["2026-03-01", "2026-03-05"]);
  });

  it("sorts the days ascending however the orders arrive", () => {
    const daily = dailyOf({
      records: [
        makeOrder({ id: "order-fifth", orderDate: ORDER_INSTANTS.marchFifth }),
        makeOrder({ id: "order-boundary", orderDate: ORDER_INSTANTS.boundaryDayEnd }),
        makeOrder({ id: "order-first", orderDate: ORDER_INSTANTS.marchFirst }),
        makeOrder({ id: "order-fourth", orderDate: ORDER_INSTANTS.marchFourth }),
      ],
    });

    expect(daily.map((day) => day.date)).toEqual([
      "2026-03-01",
      "2026-03-04",
      "2026-03-05",
      "2026-08-20",
    ]);
  });
});

describe("buildOrderDaily follows the cancellation scope it was handed", () => {
  it("drops the day of a cancelled order when the caller excludes cancellations", () => {
    const daily = dailyOf({
      records: [LIVE_MARCH_FOURTH_ORDER, CANCELLED_MARCH_FIFTH_ORDER],
    });

    expect(daily).toEqual([
      {
        booksCount: 1,
        date: "2026-03-04",
        drilldown: targets([{ books: 1, destination: "in_transit", orders: 1 }]),
        ordersCount: 1,
        totalsByCurrency: [{ currency: "UAH", total: 120 }],
      },
    ]);
  });

  it("gives a cancelled order its own day and total when the caller includes cancellations", () => {
    const daily = dailyOf({
      includeCancelled: true,
      records: [LIVE_MARCH_FOURTH_ORDER, CANCELLED_MARCH_FIFTH_ORDER],
    });

    expect(daily).toEqual([
      {
        booksCount: 1,
        date: "2026-03-04",
        drilldown: targets([{ books: 1, destination: "in_transit", orders: 1 }]),
        ordersCount: 1,
        totalsByCurrency: [{ currency: "UAH", total: 120 }],
      },
      {
        booksCount: 1,
        date: "2026-03-05",
        drilldown: targets([{ books: 1, destination: "history_cancelled", orders: 1 }]),
        ordersCount: 1,
        totalsByCurrency: [{ currency: "UAH", total: 500 }],
      },
    ]);
  });

  it("leaves a cancelled book out of its day's book count while its cost still counts", () => {
    const daily = dailyOf({
      records: [
        makeOrder({
          id: "order-partly-cancelled",
          isFree: false,
          items: [
            makeItem({ bookId: "book-kept", price: 100 }),
            makeItem({ bookId: "book-dropped", cancelledAt: CANCELLED_AT, price: 200 }),
          ],
        }),
      ],
    });

    expect(daily).toEqual([
      {
        booksCount: 1,
        date: "2026-03-04",
        drilldown: targets([{ books: 1, destination: "in_transit", orders: 1 }]),
        ordersCount: 1,
        totalsByCurrency: [{ currency: "UAH", total: 300 }],
      },
    ]);
  });
});

describe("buildOrderDaily splits a day by where its orders now live", () => {
  const RECEIVED_AT = new Date("2026-03-06T09:00:00.000Z");

  const receivedOrder = makeOrder({
    id: "order-received",
    items: [
      makeItem({ bookId: "book-received", price: 300, receivedAt: RECEIVED_AT, shipmentId: "s-1" }),
    ],
    shipments: [{ cancelledAt: null, id: "s-1", receivedAt: RECEIVED_AT, status: "received" }],
    totalAmount: 300,
  });

  const cancelledOrder = makeOrder({
    id: "order-cancelled-same-day",
    items: [makeItem({ bookId: "book-void", cancelledAt: CANCELLED_AT, price: 200 })],
    totalAmount: 200,
  });

  it("names every destination one day reached, and only those", () => {
    const [day] = dailyOf({
      includeCancelled: true,
      records: [LIVE_MARCH_FOURTH_ORDER, receivedOrder, cancelledOrder],
    });

    expect(day?.drilldown).toEqual(
      targets([
        { books: 1, destination: "in_transit", orders: 1 },
        { books: 1, destination: "history_received", orders: 1 },
        { books: 1, destination: "history_cancelled", orders: 1 },
      ]),
    );
  });

  it("adds its destinations back up to the very counts the day shows", () => {
    const [day] = dailyOf({
      includeCancelled: true,
      records: [LIVE_MARCH_FOURTH_ORDER, receivedOrder, cancelledOrder],
    });
    const reached = day?.drilldown.targets ?? [];

    expect(reached.reduce((sum, target) => sum + target.ordersCount, 0)).toBe(day?.ordersCount);
    expect(reached.reduce((sum, target) => sum + target.booksCount, 0)).toBe(day?.booksCount);
  });

  it("keeps a cancelled order out of the destinations the caller excluded", () => {
    const [day] = dailyOf({ records: [LIVE_MARCH_FOURTH_ORDER, receivedOrder, cancelledOrder] });

    expect(day?.drilldown.targets.map((target) => target.destination)).toEqual([
      "in_transit",
      "history_received",
    ]);
  });
});

const CANCELLED_UNDATED_ORDER = makeOrder({
  id: "order-cancelled-undated",
  isFree: false,
  items: [makeItem({ bookId: "book-cancelled-undated", cancelledAt: CANCELLED_AT, price: 300 })],
  orderDate: null,
  totalAmount: 300,
});

const ALL_DATED_RECORDS: OrderStatisticsRecord[] = [
  makeOrder({ id: "order-dated-first", orderDate: ORDER_INSTANTS.marchFirst }),
  makeOrder({ id: "order-dated-fourth", orderDate: ORDER_INSTANTS.marchFourth }),
  makeOrder({ id: "order-dated-fourth-again", orderDate: ORDER_INSTANTS.marchFourth }),
];

const ALL_UNDATED_RECORDS: OrderStatisticsRecord[] = [
  makeOrder({ id: "order-undated-a", orderDate: null }),
  makeOrder({ id: "order-undated-b", orderDate: null }),
];

const MIXED_DATING_RECORDS: OrderStatisticsRecord[] = [
  ...ALL_DATED_RECORDS,
  ...ALL_UNDATED_RECORDS,
];

const COVERAGE_SPLIT_CASES: CoverageSplitCase[] = [
  { name: "a scope that mixes dated and undated orders", records: MIXED_DATING_RECORDS },
  { name: "a scope where every order carries a date", records: ALL_DATED_RECORDS },
  { name: "a scope where no order carries a date", records: ALL_UNDATED_RECORDS },
  { name: "an empty scope", records: [] },
];

describe("buildOrderCalendarCoverage reports what the calendar could have drawn", () => {
  it("counts an order without an order date in the scope instead of dropping it", () => {
    expect(coverageOf({ records: MIXED_DATING_RECORDS })).toEqual({
      ordersInScope: 5,
      ordersWithOrderDate: 3,
      ordersWithoutOrderDate: 2,
    });
  });

  it("reports a scope whose orders all carry a date as fully covered", () => {
    expect(coverageOf({ records: ALL_DATED_RECORDS })).toEqual({
      ordersInScope: 3,
      ordersWithOrderDate: 3,
      ordersWithoutOrderDate: 0,
    });
  });

  it("reports a scope whose orders all lack a date as covered by none of them", () => {
    expect(coverageOf({ records: ALL_UNDATED_RECORDS })).toEqual({
      ordersInScope: 2,
      ordersWithOrderDate: 0,
      ordersWithoutOrderDate: 2,
    });
  });

  it("answers an empty scope with three zeros rather than an absent shape", () => {
    expect(coverageOf({ records: [] })).toEqual({
      ordersInScope: 0,
      ordersWithOrderDate: 0,
      ordersWithoutOrderDate: 0,
    });
  });

  it.each(COVERAGE_SPLIT_CASES)("splits $name without losing an order", ({ records }) => {
    const coverage = coverageOf({ records });

    expect(coverage.ordersWithOrderDate + coverage.ordersWithoutOrderDate).toBe(
      coverage.ordersInScope,
    );
  });

  it("keeps an undated cancelled order out of the scope when the caller excludes cancellations", () => {
    expect(coverageOf({ records: [LIVE_MARCH_FOURTH_ORDER, CANCELLED_UNDATED_ORDER] })).toEqual({
      ordersInScope: 1,
      ordersWithOrderDate: 1,
      ordersWithoutOrderDate: 0,
    });
  });

  it("counts an undated cancelled order once the caller includes cancellations", () => {
    expect(
      coverageOf({
        includeCancelled: true,
        records: [LIVE_MARCH_FOURTH_ORDER, CANCELLED_UNDATED_ORDER],
      }),
    ).toEqual({ ordersInScope: 2, ordersWithOrderDate: 1, ordersWithoutOrderDate: 1 });
  });
});

describe("buildOrderCalendarCoverage and buildOrderDaily describe one population", () => {
  it("accounts for every order the daily series bucketed", () => {
    const included = includedOrdersOf({ records: MIXED_DATING_RECORDS });
    const bucketedOrders = buildOrderDaily(included).reduce((sum, day) => sum + day.ordersCount, 0);

    expect(bucketedOrders).toBe(buildOrderCalendarCoverage(included).ordersWithOrderDate);
  });

  it("gives the undated orders no day while still counting them in the scope", () => {
    const included = includedOrdersOf({ records: MIXED_DATING_RECORDS });

    expect(buildOrderDaily(included).map((day) => day.date)).toEqual(["2026-03-01", "2026-03-04"]);
  });

  it("buckets nothing at all when no order in the scope carries a date", () => {
    const included = includedOrdersOf({ records: ALL_UNDATED_RECORDS });

    expect(buildOrderDaily(included)).toEqual([]);
    expect(buildOrderCalendarCoverage(included).ordersInScope).toBe(2);
  });
});
