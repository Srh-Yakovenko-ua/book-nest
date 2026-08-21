import type { BookOrderStatisticsLifecycleStageCounts, Nullable } from "@app/shared";

import { BookOrderDerivedStatusSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import type {
  ClassifiedOrder,
  OrderStatisticsItemRecord,
  OrderStatisticsRecord,
  OrderStatisticsShipmentRecord,
} from "./statistics-scope.js";

import { computeBookOrderLifecycle } from "./statistics-lifecycle.js";
import { classifyOrder } from "./statistics-scope.js";

type SingleBookCase = {
  expected: BookOrderStatisticsLifecycleStageCounts;
  name: string;
  record: OrderStatisticsRecord;
};

const ORDER_DATE = new Date("2026-05-04T00:00:00.000Z");
const CANCELLED_AT = new Date("2026-05-06T09:00:00.000Z");
const RECEIVED_AT = new Date("2026-05-09T09:00:00.000Z");

function lifecycleOf({
  includeCancelled = false,
  previousRecords = null,
  records,
}: {
  includeCancelled?: boolean;
  previousRecords?: Nullable<OrderStatisticsRecord[]>;
  records: OrderStatisticsRecord[];
}): ReturnType<typeof computeBookOrderLifecycle> {
  const orders: ClassifiedOrder[] = records.map((record) =>
    classifyOrder({ includeCancelled, record }),
  );

  return computeBookOrderLifecycle({
    includeCancelled,
    orders,
    previousOrders:
      previousRecords === null
        ? null
        : previousRecords.map((record) => classifyOrder({ includeCancelled, record })),
  });
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
    items: [],
    orderDate: ORDER_DATE,
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

function stageCounts(
  overrides: Partial<BookOrderStatisticsLifecycleStageCounts> = {},
): BookOrderStatisticsLifecycleStageCounts {
  return {
    active: 0,
    cancelled: 0,
    partially_received: 0,
    partially_shipped: 0,
    received: 0,
    shipped: 0,
    total: 0,
    ...overrides,
  };
}

function sumStages(counts: BookOrderStatisticsLifecycleStageCounts): number {
  return BookOrderDerivedStatusSchema.options.reduce((sum, stage) => sum + counts[stage], 0);
}

const MIXED_RECORDS: OrderStatisticsRecord[] = [
  makeOrder({
    id: "order-active",
    items: [makeItem({ bookId: "book-a" })],
  }),
  makeOrder({
    id: "order-shipped",
    items: [
      makeItem({ bookId: "book-b", shipmentId: "parcel-transit" }),
      makeItem({ bookId: "book-c", shipmentId: "parcel-pickup" }),
    ],
    shipments: [
      makeShipment({ id: "parcel-transit", status: "in_transit" }),
      makeShipment({ id: "parcel-pickup", status: "ready_for_pickup" }),
    ],
  }),
  makeOrder({
    id: "order-partially-shipped",
    items: [
      makeItem({ bookId: "book-d", shipmentId: "parcel-ordered" }),
      makeItem({ bookId: "book-e" }),
    ],
    shipments: [makeShipment({ id: "parcel-ordered", status: "ordered" })],
  }),
  makeOrder({
    id: "order-partially-received",
    items: [
      makeItem({ bookId: "book-f", receivedAt: RECEIVED_AT, shipmentId: "parcel-split" }),
      makeItem({ bookId: "book-g", shipmentId: "parcel-split" }),
    ],
    shipments: [makeShipment({ id: "parcel-split", status: "in_transit" })],
  }),
  makeOrder({
    id: "order-received",
    items: [makeItem({ bookId: "book-h", receivedAt: RECEIVED_AT, shipmentId: "parcel-done" })],
    shipments: [makeShipment({ id: "parcel-done", receivedAt: RECEIVED_AT, status: "received" })],
  }),
  makeOrder({
    id: "order-cancelled",
    items: [makeItem({ bookId: "book-i", cancelledAt: CANCELLED_AT })],
    shipments: [
      makeShipment({ cancelledAt: CANCELLED_AT, id: "parcel-void", status: "cancelled" }),
    ],
  }),
];

const CANCELLATION_RECORDS: OrderStatisticsRecord[] = [
  makeOrder({
    id: "order-void",
    items: [
      makeItem({ bookId: "book-v1", cancelledAt: CANCELLED_AT }),
      makeItem({ bookId: "book-v2", cancelledAt: CANCELLED_AT }),
    ],
    shipments: [
      makeShipment({ cancelledAt: CANCELLED_AT, id: "parcel-void", status: "cancelled" }),
    ],
  }),
  makeOrder({
    id: "order-stranded",
    items: [makeItem({ bookId: "book-w", shipmentId: "parcel-dead" })],
    shipments: [
      makeShipment({ cancelledAt: CANCELLED_AT, id: "parcel-dead", status: "cancelled" }),
    ],
  }),
];

const SINGLE_BOOK_CASES: SingleBookCase[] = [
  {
    expected: stageCounts({ active: 1, total: 1 }),
    name: "a lone book in no parcel at all counts as active",
    record: makeOrder({ items: [makeItem()] }),
  },
  {
    expected: stageCounts({ shipped: 1, total: 1 }),
    name: "a lone book in a parcel that was only ordered counts as shipped",
    record: makeOrder({
      items: [makeItem({ shipmentId: "parcel-ordered" })],
      shipments: [makeShipment({ id: "parcel-ordered", status: "ordered" })],
    }),
  },
  {
    expected: stageCounts({ shipped: 1, total: 1 }),
    name: "a lone book travelling in a parcel counts as shipped",
    record: makeOrder({
      items: [makeItem({ shipmentId: "parcel-transit" })],
      shipments: [makeShipment({ id: "parcel-transit", status: "in_transit" })],
    }),
  },
  {
    expected: stageCounts({ shipped: 1, total: 1 }),
    name: "a lone book waiting at a pickup point counts as shipped rather than received",
    record: makeOrder({
      items: [makeItem({ shipmentId: "parcel-pickup" })],
      shipments: [makeShipment({ id: "parcel-pickup", status: "ready_for_pickup" })],
    }),
  },
  {
    expected: stageCounts({ received: 1, total: 1 }),
    name: "a lone book that arrived counts as received",
    record: makeOrder({
      items: [makeItem({ receivedAt: RECEIVED_AT, shipmentId: "parcel-done" })],
      shipments: [makeShipment({ id: "parcel-done", receivedAt: RECEIVED_AT, status: "received" })],
    }),
  },
  {
    expected: stageCounts({ cancelled: 1, total: 1 }),
    name: "a lone cancelled book counts as cancelled",
    record: makeOrder({ items: [makeItem({ cancelledAt: CANCELLED_AT })] }),
  },
  {
    expected: stageCounts({ active: 1, total: 1 }),
    name: "a lone book left in a cancelled parcel falls back to active",
    record: makeOrder({
      items: [makeItem({ shipmentId: "parcel-dead" })],
      shipments: [
        makeShipment({ cancelledAt: CANCELLED_AT, id: "parcel-dead", status: "cancelled" }),
      ],
    }),
  },
];

describe("computeBookOrderLifecycle", () => {
  it("spreads a mixed catalogue across order stages and book stages separately", () => {
    const lifecycle = lifecycleOf({ records: MIXED_RECORDS });

    expect(lifecycle.orders).toEqual(
      stageCounts({
        active: 1,
        partially_received: 1,
        partially_shipped: 1,
        received: 1,
        shipped: 1,
        total: 5,
      }),
    );
    expect(lifecycle.books).toEqual(stageCounts({ active: 2, received: 2, shipped: 4, total: 8 }));
  });

  it("adds the cancelled side branch to both sides once cancelled orders are included", () => {
    const lifecycle = lifecycleOf({ includeCancelled: true, records: MIXED_RECORDS });

    expect(lifecycle.orders).toEqual(
      stageCounts({
        active: 1,
        cancelled: 1,
        partially_received: 1,
        partially_shipped: 1,
        received: 1,
        shipped: 1,
        total: 6,
      }),
    );
    expect(lifecycle.books).toEqual(
      stageCounts({ active: 2, cancelled: 1, received: 2, shipped: 4, total: 9 }),
    );
  });

  it("holds the cancelled count at zero on both sides when cancelled orders are excluded", () => {
    const lifecycle = lifecycleOf({ records: CANCELLATION_RECORDS });

    expect(lifecycle.orders.cancelled).toBe(0);
    expect(lifecycle.books.cancelled).toBe(0);
    expect(lifecycle.orders).toEqual(stageCounts({ active: 1, total: 1 }));
    expect(lifecycle.books).toEqual(stageCounts({ active: 1, total: 1 }));
  });

  it("counts a fully cancelled order once and each of its books in the side branch", () => {
    const lifecycle = lifecycleOf({ includeCancelled: true, records: CANCELLATION_RECORDS });

    expect(lifecycle.orders).toEqual(stageCounts({ active: 1, cancelled: 1, total: 2 }));
    expect(lifecycle.books).toEqual(stageCounts({ active: 1, cancelled: 2, total: 3 }));
  });

  it("reads a multi-parcel order as partially shipped while its books split by parcel", () => {
    const records = [
      makeOrder({
        id: "order-multi",
        items: [
          makeItem({ bookId: "book-m1", shipmentId: "parcel-transit" }),
          makeItem({ bookId: "book-m2", shipmentId: "parcel-pickup" }),
          makeItem({ bookId: "book-m3", shipmentId: "parcel-dead" }),
        ],
        shipments: [
          makeShipment({ id: "parcel-transit", status: "in_transit" }),
          makeShipment({ id: "parcel-pickup", status: "ready_for_pickup" }),
          makeShipment({ cancelledAt: CANCELLED_AT, id: "parcel-dead", status: "cancelled" }),
        ],
      }),
    ];

    const lifecycle = lifecycleOf({ records });

    expect(lifecycle.orders).toEqual(stageCounts({ partially_shipped: 1, total: 1 }));
    expect(lifecycle.books).toEqual(stageCounts({ active: 1, shipped: 2, total: 3 }));
  });

  it("counts a partially received order once, its books as received plus shipped", () => {
    const records = [
      makeOrder({
        id: "order-partially-received",
        items: [
          makeItem({ bookId: "book-f", receivedAt: RECEIVED_AT, shipmentId: "parcel-split" }),
          makeItem({ bookId: "book-g", shipmentId: "parcel-split" }),
        ],
        shipments: [makeShipment({ id: "parcel-split", status: "in_transit" })],
      }),
    ];

    const lifecycle = lifecycleOf({ records });

    expect(lifecycle.orders).toEqual(stageCounts({ partially_received: 1, total: 1 }));
    expect(lifecycle.books).toEqual(stageCounts({ received: 1, shipped: 1, total: 2 }));
  });

  it("keeps a cancelled book out of the order stage it sits in", () => {
    const records = [
      makeOrder({
        id: "order-live-with-cancelled-book",
        items: [
          makeItem({ bookId: "book-n1", receivedAt: RECEIVED_AT, shipmentId: "parcel-live" }),
          makeItem({ bookId: "book-n2", cancelledAt: CANCELLED_AT }),
        ],
        shipments: [makeShipment({ id: "parcel-live", status: "in_transit" })],
      }),
    ];

    expect(lifecycleOf({ records })).toEqual({
      books: stageCounts({ received: 1, total: 1 }),
      comparison: null,
      orders: stageCounts({ received: 1, total: 1 }),
    });
    expect(lifecycleOf({ includeCancelled: true, records })).toEqual({
      books: stageCounts({ cancelled: 1, received: 1, total: 2 }),
      comparison: null,
      orders: stageCounts({ received: 1, total: 1 }),
    });
  });

  it("returns an all-zero distribution for an empty dataset", () => {
    expect(lifecycleOf({ records: [] })).toEqual({
      books: stageCounts(),
      comparison: null,
      orders: stageCounts(),
    });
  });

  it.each(SINGLE_BOOK_CASES)("$name", ({ expected, record }) => {
    const lifecycle = lifecycleOf({ includeCancelled: true, records: [record] });

    expect(lifecycle.books).toEqual(expected);
    expect(lifecycle.orders).toEqual(expected);
  });

  it("never lets a single book land on a partial stage that only an order can hold", () => {
    const lifecycle = lifecycleOf({ includeCancelled: true, records: MIXED_RECORDS });

    expect(lifecycle.orders.partially_received).toBe(1);
    expect(lifecycle.orders.partially_shipped).toBe(1);
    expect(lifecycle.books.partially_received).toBe(0);
    expect(lifecycle.books.partially_shipped).toBe(0);
  });

  it("sums each side to its own total", () => {
    for (const includeCancelled of [false, true]) {
      const lifecycle = lifecycleOf({ includeCancelled, records: MIXED_RECORDS });

      expect(sumStages(lifecycle.orders)).toBe(lifecycle.orders.total);
      expect(sumStages(lifecycle.books)).toBe(lifecycle.books.total);
    }
  });

  it("keeps orders mode and books mode on counters that can never be mixed", () => {
    const lifecycle = lifecycleOf({ records: MIXED_RECORDS });

    expect(lifecycle.books).not.toBe(lifecycle.orders);
    expect(lifecycle.books).not.toEqual(lifecycle.orders);
    expect(lifecycle.orders.total).toBe(5);
    expect(lifecycle.books.total).toBe(8);
  });
});

describe("computeBookOrderLifecycle comparison", () => {
  it("says nothing about a previous period nobody asked for", () => {
    expect(lifecycleOf({ records: MIXED_RECORDS }).comparison).toBeNull();
  });

  it("carries the previous period's own stage counts, not a difference", () => {
    const lifecycle = lifecycleOf({
      previousRecords: [makeOrder({ id: "order-past", items: [makeItem({ bookId: "book-p" })] })],
      records: MIXED_RECORDS,
    });

    expect(lifecycle.comparison?.orders.previous).toEqual(stageCounts({ active: 1, total: 1 }));
    expect(lifecycle.comparison?.books.previous).toEqual(stageCounts({ active: 1, total: 1 }));
  });

  it("reads a shrinking stage as a negative delta rather than flooring it at zero", () => {
    const lifecycle = lifecycleOf({
      previousRecords: MIXED_RECORDS,
      records: [makeOrder({ id: "order-now", items: [makeItem({ bookId: "book-n" })] })],
    });

    expect(lifecycle.comparison?.orders.delta).toEqual({
      active: 0,
      cancelled: 0,
      partially_received: -1,
      partially_shipped: -1,
      received: -1,
      shipped: -1,
      total: -4,
    });
    expect(lifecycle.comparison?.books.delta.total).toBe(-7);
  });

  it("keeps the comparison on the same includeCancelled footing as the current period", () => {
    const counted = lifecycleOf({
      includeCancelled: true,
      previousRecords: CANCELLATION_RECORDS,
      records: MIXED_RECORDS,
    });
    const excluded = lifecycleOf({
      includeCancelled: false,
      previousRecords: CANCELLATION_RECORDS,
      records: MIXED_RECORDS,
    });

    expect(counted.comparison?.orders.previous.cancelled).toBeGreaterThan(0);
    expect(excluded.comparison?.orders.previous.cancelled).toBe(0);
  });

  it("reports an empty previous period as zeros rather than as no comparison at all", () => {
    const lifecycle = lifecycleOf({ previousRecords: [], records: MIXED_RECORDS });

    expect(lifecycle.comparison?.orders.previous).toEqual(stageCounts());
    expect(lifecycle.comparison?.orders.delta.total).toBe(lifecycle.orders.total);
  });
});
