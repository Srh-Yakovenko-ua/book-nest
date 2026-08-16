import { describe, expect, it } from "vitest";

import type {
  OrderStatisticsItemRecord,
  OrderStatisticsRecord,
  OrderStatisticsShipmentRecord,
} from "./order-statistics.js";

import { computeBookOrderStatistics, ORDER_STATISTICS_TOP_LIMIT } from "./order-statistics.js";

const MARCH_ORDER_DATE = new Date("2026-03-04T00:00:00.000Z");
const APRIL_ORDER_DATE = new Date("2026-04-11T00:00:00.000Z");
const CANCELLED_AT = new Date("2026-03-06T09:00:00.000Z");

function makeItem(overrides: Partial<OrderStatisticsItemRecord> = {}): OrderStatisticsItemRecord {
  return {
    bookId: "book-1",
    bookTitle: "Book 1",
    cancelledAt: null,
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
    items: [],
    orderDate: MARCH_ORDER_DATE,
    orderNumber: null,
    shipments: [],
    storeName: "Yakaboo",
    totalAmount: null,
    ...overrides,
  };
}

function makeShipment(
  overrides: Partial<OrderStatisticsShipmentRecord> = {},
): OrderStatisticsShipmentRecord {
  return {
    cancelledAt: null,
    id: "shipment-1",
    receivedAt: null,
    status: "ordered",
    ...overrides,
  };
}

function statisticsOf({
  includeCancelled = false,
  records,
}: {
  includeCancelled?: boolean;
  records: OrderStatisticsRecord[];
}): ReturnType<typeof computeBookOrderStatistics> {
  return computeBookOrderStatistics({
    includeCancelled,
    records,
    topLimit: ORDER_STATISTICS_TOP_LIMIT,
  });
}

const MIXED_RECORDS: OrderStatisticsRecord[] = [
  makeOrder({
    id: "order-live",
    items: [
      makeItem({ bookId: "book-a", price: 100, shipmentId: "s-1" }),
      makeItem({ bookId: "book-b", cancelledAt: CANCELLED_AT, price: 200, shipmentId: "s-2" }),
    ],
    shipments: [
      makeShipment({ id: "s-1", status: "ordered" }),
      makeShipment({ id: "s-2", status: "in_transit" }),
      makeShipment({ cancelledAt: CANCELLED_AT, id: "s-3", status: "cancelled" }),
    ],
    totalAmount: 300,
  }),
  makeOrder({
    id: "order-cancelled",
    items: [makeItem({ bookId: "book-c", cancelledAt: CANCELLED_AT, price: 500 })],
    shipments: [makeShipment({ cancelledAt: CANCELLED_AT, id: "s-4", status: "cancelled" })],
    totalAmount: 500,
  }),
];

const PARCEL_COUNT_CASES = [
  { activeShipmentsCount: 1, includeCancelled: false, shipmentsCount: 3 },
  { activeShipmentsCount: 1, includeCancelled: true, shipmentsCount: 4 },
];

describe("computeBookOrderStatistics counts in units of orders", () => {
  it("counts three books shipped in one parcel as a single order", () => {
    const { summary } = statisticsOf({
      records: [
        makeOrder({
          items: [
            makeItem({ bookId: "book-a", shipmentId: "s-1" }),
            makeItem({ bookId: "book-b", shipmentId: "s-1" }),
            makeItem({ bookId: "book-c", shipmentId: "s-1" }),
          ],
          shipments: [makeShipment({ id: "s-1" })],
        }),
      ],
    });

    expect({
      booksCount: summary.booksCount,
      ordersCount: summary.ordersCount,
      shipmentsCount: summary.shipmentsCount,
    }).toEqual({ booksCount: 3, ordersCount: 1, shipmentsCount: 1 });
  });

  it("counts five books split across two parcels as a single order", () => {
    const { summary } = statisticsOf({
      records: [
        makeOrder({
          items: [
            makeItem({ bookId: "book-a", shipmentId: "s-1" }),
            makeItem({ bookId: "book-b", shipmentId: "s-1" }),
            makeItem({ bookId: "book-c", shipmentId: "s-1" }),
            makeItem({ bookId: "book-d", shipmentId: "s-2" }),
            makeItem({ bookId: "book-e", shipmentId: "s-2" }),
          ],
          shipments: [makeShipment({ id: "s-1" }), makeShipment({ id: "s-2" })],
        }),
      ],
    });

    expect({
      booksCount: summary.booksCount,
      ordersCount: summary.ordersCount,
      shipmentsCount: summary.shipmentsCount,
    }).toEqual({ booksCount: 5, ordersCount: 1, shipmentsCount: 2 });
  });

  it("counts every book of an order, not only the ones that carry a price", () => {
    const { summary } = statisticsOf({
      records: [
        makeOrder({
          items: [
            makeItem({ bookId: "book-a", price: 100 }),
            makeItem({ bookId: "book-b" }),
            makeItem({ bookId: "book-c" }),
          ],
        }),
      ],
    });

    expect(summary.booksCount).toBe(3);
  });
});

describe("computeBookOrderStatistics by store", () => {
  const STORE_RECORDS: OrderStatisticsRecord[] = [
    makeOrder({
      id: "order-1",
      items: [
        makeItem({ bookId: "book-a", price: 100 }),
        makeItem({ bookId: "book-b", price: 200 }),
      ],
      totalAmount: 300,
    }),
    makeOrder({
      id: "order-2",
      items: [
        makeItem({ bookId: "book-c", price: 200 }),
        makeItem({ bookId: "book-d", price: 300 }),
      ],
      totalAmount: 500,
    }),
    makeOrder({
      currency: "EUR",
      id: "order-3",
      items: [makeItem({ bookId: "book-e", price: 50 })],
      totalAmount: 50,
    }),
  ];

  it("reports one bucket per store carrying its real order and book counts", () => {
    const { byStore } = statisticsOf({ records: STORE_RECORDS });

    expect(
      byStore.map((bucket) => ({
        booksCount: bucket.booksCount,
        ordersCount: bucket.ordersCount,
        store: bucket.store,
      })),
    ).toEqual([{ booksCount: 5, ordersCount: 3, store: "Yakaboo" }]);
  });

  it("averages the order amount from order totals and the book price from item prices, per currency", () => {
    const { byStore } = statisticsOf({ records: STORE_RECORDS });

    expect(
      byStore.map((bucket) => ({
        averageBookPriceByCurrency: bucket.averageBookPriceByCurrency,
        averageOrderAmountByCurrency: bucket.averageOrderAmountByCurrency,
      })),
    ).toEqual([
      {
        averageBookPriceByCurrency: [
          { average: 200, currency: "UAH" },
          { average: 50, currency: "EUR" },
        ],
        averageOrderAmountByCurrency: [
          { average: 400, currency: "UAH" },
          { average: 50, currency: "EUR" },
        ],
      },
    ]);
  });

  it("keeps an order that has no price at all in the store breakdown", () => {
    const { byStore } = statisticsOf({
      records: [
        makeOrder({
          currency: null,
          items: [makeItem({ bookId: "book-a" }), makeItem({ bookId: "book-b" })],
          storeName: "Книгарня Є",
        }),
      ],
    });

    expect(byStore).toEqual([
      {
        averageBookPriceByCurrency: [],
        averageOrderAmountByCurrency: [],
        booksCount: 2,
        ordersCount: 1,
        store: "Книгарня Є",
        totalsByCurrency: [],
      },
    ]);
  });

  it("gives an order with a blank store name no bucket of its own", () => {
    const { byStore } = statisticsOf({
      records: [makeOrder({ items: [makeItem()], storeName: "   " })],
    });

    expect(byStore).toEqual([]);
  });

  it("still counts a blank-store order in the overall summary", () => {
    const { summary } = statisticsOf({
      records: [makeOrder({ items: [makeItem()], storeName: "   " })],
    });

    expect({ booksCount: summary.booksCount, ordersCount: summary.ordersCount }).toEqual({
      booksCount: 1,
      ordersCount: 1,
    });
  });
});

describe("computeBookOrderStatistics by month", () => {
  it("counts two orders of one month as two orders and sums their books", () => {
    const { monthly } = statisticsOf({
      records: [
        makeOrder({
          id: "order-march-1",
          items: [
            makeItem({ bookId: "book-a" }),
            makeItem({ bookId: "book-b" }),
            makeItem({ bookId: "book-c" }),
          ],
          totalAmount: 300,
        }),
        makeOrder({
          id: "order-march-2",
          items: [makeItem({ bookId: "book-d" }), makeItem({ bookId: "book-e" })],
          totalAmount: 200,
        }),
        makeOrder({
          id: "order-april",
          items: [makeItem({ bookId: "book-f" })],
          orderDate: APRIL_ORDER_DATE,
          totalAmount: 100,
        }),
      ],
    });

    expect(monthly).toEqual([
      {
        booksCount: 5,
        month: "2026-03",
        ordersCount: 2,
        totalsByCurrency: [{ currency: "UAH", total: 500 }],
      },
      {
        booksCount: 1,
        month: "2026-04",
        ordersCount: 1,
        totalsByCurrency: [{ currency: "UAH", total: 100 }],
      },
    ]);
  });

  it("leaves an order without an order date out of the monthly breakdown", () => {
    const { monthly } = statisticsOf({
      records: [makeOrder({ items: [makeItem()], orderDate: null })],
    });

    expect(monthly).toEqual([]);
  });
});

describe("computeBookOrderStatistics with cancelled orders", () => {
  it("leaves a fully cancelled order out of the counts by default", () => {
    const { summary } = statisticsOf({ records: MIXED_RECORDS });

    expect({ booksCount: summary.booksCount, ordersCount: summary.ordersCount }).toEqual({
      booksCount: 1,
      ordersCount: 1,
    });
  });

  it("brings the cancelled order and its cancelled books back when the caller asks for them", () => {
    const { summary } = statisticsOf({ includeCancelled: true, records: MIXED_RECORDS });

    expect({ booksCount: summary.booksCount, ordersCount: summary.ordersCount }).toEqual({
      booksCount: 3,
      ordersCount: 2,
    });
  });

  it("reports the cancelled order in cancelledOrdersCount even when it is excluded elsewhere", () => {
    const { summary } = statisticsOf({ records: MIXED_RECORDS });

    expect(summary.cancelledOrdersCount).toBe(1);
  });

  it.each(PARCEL_COUNT_CASES)(
    "counts $activeShipmentsCount active parcels out of $shipmentsCount when includeCancelled is $includeCancelled",
    ({ activeShipmentsCount, includeCancelled, shipmentsCount }) => {
      const { summary } = statisticsOf({ includeCancelled, records: MIXED_RECORDS });

      expect({
        activeShipmentsCount: summary.activeShipmentsCount,
        shipmentsCount: summary.shipmentsCount,
      }).toEqual({ activeShipmentsCount, shipmentsCount });
    },
  );

  it("counts only the books that are still on their way as active", () => {
    const { summary } = statisticsOf({ includeCancelled: true, records: MIXED_RECORDS });

    expect(summary.activeBooksCount).toBe(1);
  });
});

describe("computeBookOrderStatistics top orders", () => {
  it("ranks priced orders by amount and leaves an order with no money at all out", () => {
    const { topOrders } = statisticsOf({
      records: [
        makeOrder({ id: "order-small", items: [makeItem()], totalAmount: 120 }),
        makeOrder({ id: "order-large", items: [makeItem()], totalAmount: 900 }),
        makeOrder({ id: "order-priceless", items: [makeItem()] }),
      ],
    });

    expect(topOrders.map((order) => order.id)).toEqual(["order-large", "order-small"]);
  });
});

describe("computeBookOrderStatistics falls back to book prices when an order has no total", () => {
  const BOOK_PRICED_ORDER = makeOrder({
    id: "order-book-priced",
    items: [makeItem({ bookId: "book-a", price: 320 }), makeItem({ bookId: "book-b", price: 180 })],
  });

  it("sums the book prices into the totals the order itself never carried", () => {
    const { summary } = statisticsOf({ records: [BOOK_PRICED_ORDER] });

    expect(summary.totalsByCurrency).toEqual([{ currency: "UAH", total: 500 }]);
  });

  it("carries that sum into the store and month breakdowns", () => {
    const { byStore, monthly } = statisticsOf({ records: [BOOK_PRICED_ORDER] });

    expect({
      month: monthly.map((bucket) => bucket.totalsByCurrency),
      store: byStore.map((bucket) => bucket.totalsByCurrency),
    }).toEqual({
      month: [[{ currency: "UAH", total: 500 }]],
      store: [[{ currency: "UAH", total: 500 }]],
    });
  });

  it("ranks the order among the top orders by that sum", () => {
    const { topOrders } = statisticsOf({
      records: [
        BOOK_PRICED_ORDER,
        makeOrder({ id: "order-larger", items: [makeItem()], totalAmount: 900 }),
      ],
    });

    expect(topOrders.map((order) => ({ id: order.id, totalAmount: order.totalAmount }))).toEqual([
      { id: "order-larger", totalAmount: 900 },
      { id: "order-book-priced", totalAmount: 500 },
    ]);
  });

  it("normalizes a conflicting stored total from the complete item breakdown", () => {
    const { summary } = statisticsOf({
      records: [
        makeOrder({
          id: "order-both",
          items: [makeItem({ bookId: "book-a", price: 320 })],
          totalAmount: 400,
        }),
      ],
    });

    expect(summary.totalsByCurrency).toEqual([{ currency: "UAH", total: 320 }]);
  });

  it("keeps one financial total regardless of the cancelled-items filter", () => {
    const records = [
      makeOrder({
        id: "order-part-cancelled",
        items: [
          makeItem({ bookId: "book-a", price: 320 }),
          makeItem({ bookId: "book-b", cancelledAt: CANCELLED_AT, price: 180 }),
        ],
        shipments: [makeShipment({ id: "s-1" })],
      }),
    ];

    expect({
      excluded: statisticsOf({ records }).summary.totalsByCurrency,
      included: statisticsOf({ includeCancelled: true, records }).summary.totalsByCurrency,
    }).toEqual({
      excluded: [{ currency: "UAH", total: 500 }],
      included: [{ currency: "UAH", total: 500 }],
    });
  });
});
