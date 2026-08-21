import type { BookOrderStatisticsCosts } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { OrderStatisticsItemRecord, OrderStatisticsRecord } from "./statistics-scope.js";

import { computeStatisticsCosts } from "./statistics-costs.js";
import { classifyOrder } from "./statistics-scope.js";

type CostsCase = {
  expected: BookOrderStatisticsCosts;
  name: string;
  records: OrderStatisticsRecord[];
};

const CANCELLED_AT = new Date("2026-03-02T09:00:00.000Z");

function costsOf({
  includeCancelled = false,
  records,
}: {
  includeCancelled?: boolean;
  records: OrderStatisticsRecord[];
}): BookOrderStatisticsCosts {
  return computeStatisticsCosts(
    records
      .map((record) => classifyOrder({ includeCancelled, record }))
      .filter((order) => order.isIncluded),
  );
}

function makeItem(overrides: Partial<OrderStatisticsItemRecord> = {}): OrderStatisticsItemRecord {
  return {
    bookId: "book",
    bookTitle: "Тінь гори",
    cancelledAt: null,
    id: "item",
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
    id: "order",
    isFree: false,
    items: [],
    orderDate: null,
    orderNumber: null,
    shipments: [],
    storeName: "Книгарня Є",
    totalAmount: null,
    ...overrides,
  };
}

const CANCELLED_SCOPE_RECORDS: OrderStatisticsRecord[] = [
  makeOrder({
    deliveryPrice: 100,
    discount: 50,
    id: "live-order",
    isFree: false,
    items: [makeItem({ price: 200 }), makeItem({ price: 200 })],
  }),
  makeOrder({
    deliveryPrice: 50,
    discount: 50,
    id: "cancelled-order",
    isFree: false,
    items: [makeItem({ cancelledAt: CANCELLED_AT, price: 200 })],
  }),
  makeOrder({
    deliveryPrice: 50,
    id: "partly-cancelled-order",
    isFree: false,
    items: [makeItem({ price: 100 }), makeItem({ cancelledAt: CANCELLED_AT, price: 100 })],
  }),
];

const COSTS_CASES: CostsCase[] = [
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: 0,
        deliveryShareOfSpendPercent: 0,
        deliveryTotal: 0,
        discountShareOfRawSubtotalPercent: 0,
        discountTotal: 0,
        ordersWithDeliveryCount: 0,
        ordersWithDiscountCount: 0,
      },
    ],
    name: "an order with no delivery recorded reports a zero delivery total rather than an unknown one",
    records: [makeOrder({ items: [makeItem({ price: 200 }), makeItem({ price: 300 })] })],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: 0,
        deliveryShareOfSpendPercent: 0,
        deliveryTotal: 0,
        discountShareOfRawSubtotalPercent: 0,
        discountTotal: 0,
        ordersWithDeliveryCount: 0,
        ordersWithDiscountCount: 0,
      },
    ],
    name: "free shipping stored as an explicit zero never counts as an order that paid for delivery",
    records: [
      makeOrder({
        deliveryPrice: 0,
        items: [makeItem({ price: 200 }), makeItem({ price: 300 })],
      }),
    ],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: 0,
        deliveryShareOfSpendPercent: 0,
        deliveryTotal: 0,
        discountShareOfRawSubtotalPercent: 5,
        discountTotal: 100,
        ordersWithDeliveryCount: 0,
        ordersWithDiscountCount: 1,
      },
    ],
    name: "a discount is measured against the raw book subtotal and only discounted orders are counted",
    records: [
      makeOrder({
        discount: 100,
        id: "discounted-order",
        isFree: false,
        items: [makeItem({ price: 500 }), makeItem({ price: 500 })],
      }),
      makeOrder({ id: "full-price-order", items: [makeItem({ price: 1000 })] }),
    ],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: 50,
        deliveryShareOfSpendPercent: 20,
        deliveryTotal: 100,
        discountShareOfRawSubtotalPercent: 0,
        discountTotal: 0,
        ordersWithDeliveryCount: 2,
        ordersWithDiscountCount: 0,
      },
    ],
    name: "an order with no effective total keeps its book and its delivery but stays out of the spend denominator",
    records: [
      makeOrder({ deliveryPrice: 60, id: "unpriced-order", items: [makeItem({ price: null })] }),
      makeOrder({ deliveryPrice: 40, id: "priced-order", items: [makeItem({ price: 460 })] }),
    ],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: 60,
        deliveryShareOfSpendPercent: null,
        deliveryTotal: 60,
        discountShareOfRawSubtotalPercent: null,
        discountTotal: 0,
        ordersWithDeliveryCount: 1,
        ordersWithDiscountCount: 0,
      },
    ],
    name: "a currency where no order has a known total reports null shares instead of zero ones",
    records: [makeOrder({ deliveryPrice: 60, items: [makeItem({ price: null })] })],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: 50,
        deliveryShareOfSpendPercent: 20,
        deliveryTotal: 100,
        discountShareOfRawSubtotalPercent: 0,
        discountTotal: 0,
        ordersWithDeliveryCount: 1,
        ordersWithDiscountCount: 0,
      },
    ],
    name: "a book with no price is still a counted book yet adds nothing to the raw subtotal",
    records: [
      makeOrder({
        deliveryPrice: 100,
        items: [makeItem({ price: 400 }), makeItem({ price: null })],
        totalAmount: 500,
      }),
    ],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: null,
        deliveryShareOfSpendPercent: 15,
        deliveryTotal: 150,
        discountShareOfRawSubtotalPercent: null,
        discountTotal: 0,
        ordersWithDeliveryCount: 1,
        ordersWithDiscountCount: 0,
      },
    ],
    name: "an order with no counted books leaves the per-book delivery cost null instead of dividing by zero",
    records: [makeOrder({ deliveryPrice: 150, items: [], totalAmount: 1000 })],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: -50,
        deliveryShareOfSpendPercent: -25,
        deliveryTotal: -50,
        discountShareOfRawSubtotalPercent: 0,
        discountTotal: 0,
        ordersWithDeliveryCount: 0,
        ordersWithDiscountCount: 0,
      },
    ],
    name: "a negative stored delivery price is summed exactly as recorded and never counts as a paid delivery",
    records: [makeOrder({ deliveryPrice: -50, items: [makeItem({ price: 250 })] })],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: 20,
        deliveryShareOfSpendPercent: null,
        deliveryTotal: 40,
        discountShareOfRawSubtotalPercent: 0,
        discountTotal: 0,
        ordersWithDeliveryCount: 1,
        ordersWithDiscountCount: 0,
      },
    ],
    name: "a negative effective spend leaves the delivery share null rather than reporting a negative percentage",
    records: [
      makeOrder({
        deliveryPrice: 40,
        items: [makeItem({ bookId: "priced", price: 100 }), makeItem({ bookId: "unpriced" })],
        totalAmount: -100,
      }),
    ],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: 0,
        deliveryShareOfSpendPercent: 0,
        deliveryTotal: 0,
        discountShareOfRawSubtotalPercent: -25,
        discountTotal: 50,
        ordersWithDeliveryCount: 0,
        ordersWithDiscountCount: 1,
      },
    ],
    name: "a negative raw subtotal still yields a signed discount share, because null means a zero or unknown denominator",
    records: [
      makeOrder({
        discount: 50,
        items: [makeItem({ bookId: "priced", price: -200 }), makeItem({ bookId: "unpriced" })],
        totalAmount: 1000,
      }),
    ],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: 0,
        deliveryShareOfSpendPercent: 0,
        deliveryTotal: 0,
        discountShareOfRawSubtotalPercent: 300,
        discountTotal: 3000,
        ordersWithDeliveryCount: 0,
        ordersWithDiscountCount: 1,
      },
    ],
    name: "a discount larger than the raw subtotal reports more than one hundred percent instead of clamping",
    records: [
      makeOrder({
        discount: 3000,
        items: [makeItem({ bookId: "priced", price: 1000 }), makeItem({ bookId: "unpriced" })],
        totalAmount: 500,
      }),
    ],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: 10.15,
        deliveryShareOfSpendPercent: 100,
        deliveryTotal: 20.3,
        discountShareOfRawSubtotalPercent: 100,
        discountTotal: 0.3,
        ordersWithDeliveryCount: 2,
        ordersWithDiscountCount: 2,
      },
    ],
    name: "cent-level prices add up exactly instead of drifting into binary floating point noise",
    records: [
      makeOrder({
        deliveryPrice: 10.1,
        discount: 0.1,
        id: "cents-order-one",
        isFree: false,
        items: [makeItem({ price: 0.1 })],
      }),
      makeOrder({
        deliveryPrice: 10.2,
        discount: 0.2,
        id: "cents-order-two",
        isFree: false,
        items: [makeItem({ price: 0.2 })],
      }),
    ],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: 50,
        deliveryShareOfSpendPercent: 10,
        deliveryTotal: 100,
        discountShareOfRawSubtotalPercent: 10,
        discountTotal: 100,
        ordersWithDeliveryCount: 1,
        ordersWithDiscountCount: 1,
      },
      {
        currency: "EUR",
        deliveryCostPerBook: 0,
        deliveryShareOfSpendPercent: 0,
        deliveryTotal: 0,
        discountShareOfRawSubtotalPercent: 10,
        discountTotal: 20,
        ordersWithDeliveryCount: 0,
        ordersWithDiscountCount: 1,
      },
      {
        currency: "USD",
        deliveryCostPerBook: 10,
        deliveryShareOfSpendPercent: 20,
        deliveryTotal: 10,
        discountShareOfRawSubtotalPercent: 0,
        discountTotal: 0,
        ordersWithDeliveryCount: 1,
        ordersWithDiscountCount: 0,
      },
    ],
    name: "three currencies stay three separate rows in enum order and never share a single number",
    records: [
      makeOrder({
        currency: "USD",
        deliveryPrice: 10,
        id: "usd-order",
        isFree: false,
        items: [makeItem({ price: 40 })],
      }),
      makeOrder({
        currency: "EUR",
        discount: 20,
        id: "eur-order",
        isFree: false,
        items: [makeItem({ price: 100 }), makeItem({ price: 100 })],
      }),
      makeOrder({
        currency: "UAH",
        deliveryPrice: 100,
        discount: 100,
        id: "uah-order",
        isFree: false,
        items: [makeItem({ price: 400 }), makeItem({ price: 600 })],
      }),
    ],
  },
  {
    expected: [
      {
        currency: "UAH",
        deliveryCostPerBook: 50,
        deliveryShareOfSpendPercent: 10,
        deliveryTotal: 50,
        discountShareOfRawSubtotalPercent: 0,
        discountTotal: 0,
        ordersWithDeliveryCount: 1,
        ordersWithDiscountCount: 0,
      },
    ],
    name: "an order with no stored currency joins the default currency row instead of opening a fourth one",
    records: [makeOrder({ currency: null, deliveryPrice: 50, items: [makeItem({ price: 450 })] })],
  },
  {
    expected: [],
    name: "a period with no orders produces no currency rows at all",
    records: [],
  },
];

describe("computeStatisticsCosts", () => {
  it.each(COSTS_CASES)("$name", ({ expected, records }) => {
    expect(costsOf({ records })).toEqual(expected);
  });

  it("reads free shipping stored as zero exactly like an order with no delivery recorded", () => {
    const freeShipping = costsOf({
      records: [makeOrder({ deliveryPrice: 0, items: [makeItem({ price: 200 })] })],
    });
    const noDeliveryRecorded = costsOf({
      records: [makeOrder({ items: [makeItem({ price: 200 })] })],
    });

    expect(freeShipping).toEqual(noDeliveryRecorded);
  });

  it("moves every cost number together with the cancelled scope", () => {
    const withoutCancelled = costsOf({
      includeCancelled: false,
      records: CANCELLED_SCOPE_RECORDS,
    });
    const withCancelled = costsOf({ includeCancelled: true, records: CANCELLED_SCOPE_RECORDS });

    expect(withoutCancelled).toEqual([
      {
        currency: "UAH",
        deliveryCostPerBook: 50,
        deliveryShareOfSpendPercent: expect.closeTo(21.43, 2),
        deliveryTotal: 150,
        discountShareOfRawSubtotalPercent: 10,
        discountTotal: 50,
        ordersWithDeliveryCount: 2,
        ordersWithDiscountCount: 1,
      },
    ]);
    expect(withCancelled).toEqual([
      {
        currency: "UAH",
        deliveryCostPerBook: 40,
        deliveryShareOfSpendPercent: expect.closeTo(22.22, 2),
        deliveryTotal: 200,
        discountShareOfRawSubtotalPercent: 12.5,
        discountTotal: 100,
        ordersWithDeliveryCount: 3,
        ordersWithDiscountCount: 2,
      },
    ]);
  });
});
