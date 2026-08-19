import type {
  BookOrderItemRowOrderView,
  BookOrderItemRowShipmentView,
  BookOrderItemRowView,
  BookPreview,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { DeliveryCardLabels, DeliveryOrderCardModel } from "./order-card-model";

import { toDeliveryOrderCards, toSelectableShipments } from "./order-card-model";

const locale = "en-US";

const labels: DeliveryCardLabels = {
  badge: (key) => key,
  free: "Free",
  orderStatus: (key) => key,
  seriesPosition: (position, total) => `${position} of ${total}`,
};

function bookIdsByGroup(cards: DeliveryOrderCardModel[]): string[][][] {
  return cards.map((card) => card.shipments.map((group) => group.books.map((book) => book.bookId)));
}

function firstCard(cards: DeliveryOrderCardModel[]): DeliveryOrderCardModel {
  const [card] = cards;
  if (card === undefined) throw new Error("expected at least one order card");
  return card;
}

function groupIds(cards: DeliveryOrderCardModel[]): (null | string)[][] {
  return cards.map((card) => card.shipments.map((group) => group.id));
}

function makeBook(overrides: Partial<BookPreview> = {}): BookPreview {
  return {
    cover: null,
    firstAuthorName: "Donna Tartt",
    genres: [],
    id: "book-1",
    originalTitle: null,
    ownershipStatus: "in_transit",
    publisher: null,
    readingStatus: "not_started",
    series: null,
    tags: [],
    title: "The Secret History",
    ...overrides,
  };
}

function makeOrder(overrides: Partial<BookOrderItemRowOrderView> = {}): BookOrderItemRowOrderView {
  return {
    currency: "UAH",
    deliveryPrice: null,
    derivedStatus: "active",
    discount: null,
    effectiveTotalAmount: 480,
    id: "order-1",
    isFree: false,
    itemsCount: 2,
    orderDate: "2026-07-05",
    orderNumber: "ORD-10241",
    pricedItemsCount: 0,
    storeName: "Yakaboo",
    totalAmount: 480,
    ...overrides,
  };
}

function makeRow(overrides: Partial<BookOrderItemRowView> = {}): BookOrderItemRowView {
  return {
    book: makeBook(),
    cancelledAt: null,
    cancelReason: null,
    id: "item-1",
    order: makeOrder(),
    price: 480,
    receivedAt: null,
    shipment: makeShipment(),
    uiStatus: null,
    ...overrides,
  };
}

function makeShipment(
  overrides: Partial<BookOrderItemRowShipmentView> = {},
): BookOrderItemRowShipmentView {
  return {
    activeItemsCount: 1,
    deliveryService: { id: "service-1", name: "Nova Poshta" },
    expectedDeliveryDate: "2026-07-12",
    id: "shipment-1",
    note: null,
    pickupUntil: null,
    status: "in_transit",
    trackingNumber: "20450012345678",
    trackingUrl: "https://tracking.example.com/20450012345678",
    ...overrides,
  };
}

describe("toDeliveryOrderCards", () => {
  it("folds a single shipped book into one card with one shipment group", () => {
    const cards = toDeliveryOrderCards(
      [makeRow({ book: makeBook({ id: "book-1", title: "The Secret History" }) })],
      { labels, locale },
    );

    expect(cards).toHaveLength(1);
    expect(firstCard(cards)).toMatchObject({
      booksCount: 1,
      id: "order-1",
      orderNumber: "ORD-10241",
      storeName: "Yakaboo",
    });
    expect(bookIdsByGroup(cards)).toEqual([[["book-1"]]]);
    expect(firstCard(cards).shipments).toMatchObject([
      { books: [{ bookHref: "/books/book-1", title: "The Secret History" }], id: "shipment-1" },
    ]);
  });

  it("maps a complete series preview to a localized series row", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({
          book: makeBook({
            series: {
              id: "series-1",
              name: "The Kingkiller Chronicle",
              partNumber: 1,
              totalBooks: 3,
            },
          }),
        }),
      ],
      { labels, locale },
    );

    expect(firstCard(cards).shipments[0]?.books[0]?.series).toEqual({
      href: "/series/series-1",
      name: "The Kingkiller Chronicle",
      positionLabel: "1 of 3",
    });
  });

  it.each([
    { expectedPositionLabel: null, partNumber: null, totalBooks: 3 },
    { expectedPositionLabel: "1", partNumber: 1, totalBooks: null },
  ])(
    "maps an incomplete series contract to position label $expectedPositionLabel",
    ({ expectedPositionLabel, partNumber, totalBooks }) => {
      const cards = toDeliveryOrderCards(
        [
          makeRow({
            book: makeBook({
              series: { id: "series-1", name: "The Kingkiller Chronicle", partNumber, totalBooks },
            }),
          }),
        ],
        { labels, locale },
      );

      expect(firstCard(cards).shipments[0]?.books[0]?.series).toEqual({
        href: "/series/series-1",
        name: "The Kingkiller Chronicle",
        positionLabel: expectedPositionLabel,
      });
    },
  );

  it("keeps the delivery series row absent when the preview has no series", () => {
    const cards = toDeliveryOrderCards([makeRow({ book: makeBook({ series: null }) })], {
      labels,
      locale,
    });

    expect(firstCard(cards).shipments[0]?.books[0]?.series).toBeNull();
  });

  it("keeps every book of one shipment inside a single group", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({ book: makeBook({ id: "book-1" }), id: "item-1" }),
        makeRow({ book: makeBook({ id: "book-2" }), id: "item-2" }),
        makeRow({ book: makeBook({ id: "book-3" }), id: "item-3" }),
      ],
      { labels, locale },
    );

    expect(cards).toHaveLength(1);
    expect(firstCard(cards).booksCount).toBe(3);
    expect(bookIdsByGroup(cards)).toEqual([[["book-1", "book-2", "book-3"]]]);
  });

  it("shows the total the server resolved for the whole order, not the visible prices", () => {
    const order = makeOrder({ effectiveTotalAmount: 1250, itemsCount: 3, pricedItemsCount: 3 });
    const cards = toDeliveryOrderCards(
      [makeRow({ id: "item-1", order, price: 480 }), makeRow({ id: "item-2", order, price: 610 })],
      { labels, locale },
    );

    expect(firstCard(cards).totalText).toBe("1,250 UAH");
  });

  it("splits an order into one group per shipment, each holding only its own books", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({
          book: makeBook({ id: "book-1" }),
          id: "item-1",
          shipment: makeShipment({ id: "shipment-a" }),
        }),
        makeRow({
          book: makeBook({ id: "book-2" }),
          id: "item-2",
          shipment: makeShipment({ id: "shipment-b" }),
        }),
        makeRow({
          book: makeBook({ id: "book-3" }),
          id: "item-3",
          shipment: makeShipment({ id: "shipment-a" }),
        }),
      ],
      { labels, locale },
    );

    expect(cards).toHaveLength(1);
    expect(firstCard(cards).booksCount).toBe(3);
    expect(groupIds(cards)).toEqual([["shipment-a", "shipment-b"]]);
    expect(bookIdsByGroup(cards)).toEqual([[["book-1", "book-3"], ["book-2"]]]);
  });

  it("groups rows without a shipment under a null group badged as ordered", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({
          book: makeBook({ id: "book-1" }),
          id: "item-1",
          shipment: null,
          uiStatus: "no_delivery_date",
        }),
        makeRow({
          book: makeBook({ id: "book-2" }),
          id: "item-2",
          shipment: null,
          uiStatus: "no_delivery_date",
        }),
      ],
      { labels, locale },
    );

    expect(groupIds(cards)).toEqual([[null]]);
    expect(bookIdsByGroup(cards)).toEqual([[["book-1", "book-2"]]]);
    expect(firstCard(cards).shipments).toMatchObject([
      { badge: { label: "ordered", value: "ordered" } },
    ]);
  });

  it("places the not-yet-shipped group after the dispatched ones even when its rows come first", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({
          book: makeBook({ id: "book-1" }),
          id: "item-1",
          shipment: null,
          uiStatus: "no_delivery_date",
        }),
        makeRow({
          book: makeBook({ id: "book-2" }),
          id: "item-2",
          shipment: makeShipment({ id: "shipment-a" }),
        }),
      ],
      { labels, locale },
    );

    expect(groupIds(cards)).toEqual([["shipment-a", null]]);
    expect(bookIdsByGroup(cards)).toEqual([[["book-2"], ["book-1"]]]);
  });

  it("keeps orders in first-appearance order when their rows interleave", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({ book: makeBook({ id: "book-1" }), id: "item-1", order: makeOrder({ id: "a" }) }),
        makeRow({ book: makeBook({ id: "book-2" }), id: "item-2", order: makeOrder({ id: "b" }) }),
        makeRow({ book: makeBook({ id: "book-3" }), id: "item-3", order: makeOrder({ id: "a" }) }),
        makeRow({ book: makeBook({ id: "book-4" }), id: "item-4", order: makeOrder({ id: "c" }) }),
        makeRow({ book: makeBook({ id: "book-5" }), id: "item-5", order: makeOrder({ id: "b" }) }),
      ],
      { labels, locale },
    );

    expect(cards.map((card) => card.id)).toEqual(["a", "b", "c"]);
    expect(cards.map((card) => card.booksCount)).toEqual([2, 2, 1]);
    expect(bookIdsByGroup(cards)).toEqual([
      [["book-1", "book-3"]],
      [["book-2", "book-5"]],
      [["book-4"]],
    ]);
  });

  it("reports no total when the normalized order total is unknown", () => {
    const order = makeOrder({ effectiveTotalAmount: null, totalAmount: null });
    const cards = toDeliveryOrderCards(
      [
        makeRow({ id: "item-1", order, price: null }),
        makeRow({ id: "item-2", order, price: null }),
      ],
      { labels, locale },
    );

    expect(firstCard(cards).totalText).toBeNull();
    expect(firstCard(cards).shipments).toMatchObject([
      { books: [{ priceText: null }, { priceText: null }] },
    ]);
  });

  it("keeps the calculated order total whole while only one of its books is on the page", () => {
    const order = makeOrder({
      effectiveTotalAmount: 469.75,
      itemsCount: 2,
      pricedItemsCount: 2,
      totalAmount: null,
    });
    const cards = toDeliveryOrderCards([makeRow({ id: "item-1", order, price: 349.5 })], {
      labels,
      locale,
    });

    expect(firstCard(cards).totalText).toBe("469.75 UAH");
  });

  it("uses a manual total for an incomplete item breakdown", () => {
    const order = makeOrder({
      effectiveTotalAmount: 600,
      itemsCount: 3,
      pricedItemsCount: 2,
      totalAmount: 600,
    });
    const cards = toDeliveryOrderCards(
      [
        makeRow({ id: "item-1", order, price: 480 }),
        makeRow({ id: "item-2", order, price: null }),
        makeRow({ id: "item-3", order, price: 120 }),
      ],
      { labels, locale },
    );

    expect(firstCard(cards).totalText).toBe("600 UAH");
  });

  it("keeps an https tracking url as the group link", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({
          shipment: makeShipment({ trackingUrl: "https://tracking.example.com/20450012345678" }),
        }),
      ],
      { labels, locale },
    );

    expect(firstCard(cards).shipments).toMatchObject([
      { trackingHref: "https://tracking.example.com/20450012345678" },
    ]);
  });

  it("drops a tracking url that is not https", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({
          shipment: makeShipment({
            trackingNumber: "20450012345678",
            trackingUrl: "http://tracking.example.com/20450012345678",
          }),
        }),
      ],
      { labels, locale },
    );

    expect(firstCard(cards).shipments).toMatchObject([
      { trackingHref: null, trackingNumber: "20450012345678" },
    ]);
  });

  it("badges a group from the ui status of its first row", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({ book: makeBook({ id: "book-1" }), id: "item-1", uiStatus: "delayed" }),
        makeRow({ book: makeBook({ id: "book-2" }), id: "item-2", uiStatus: "arriving_soon" }),
      ],
      { labels, locale },
    );

    expect(firstCard(cards).shipments).toMatchObject([
      { badge: { label: "delayed", value: "delayed" } },
    ]);
  });

  it("falls back to the shipment status when the first row has no ui status", () => {
    const statuses = ["in_transit", "ready_for_pickup", "ordered", "received"] as const;

    const badges = statuses.map((status) => {
      const cards = toDeliveryOrderCards(
        [makeRow({ shipment: makeShipment({ status }), uiStatus: null })],
        { labels, locale },
      );
      return firstCard(cards).shipments.map((group) => group.badge.value);
    });

    expect(badges).toEqual([["in_transit"], ["ready_for_pickup"], ["ordered"], ["ordered"]]);
  });

  it("warns on every book of an order whose stored total will not survive the edit", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({ book: makeBook({ id: "book-1" }), id: "item-1", price: null }),
        makeRow({ book: makeBook({ id: "book-2" }), id: "item-2", price: null }),
      ],
      { labels, locale },
    );

    expect(
      firstCard(cards).shipments.flatMap((group) =>
        group.books.map((book) => book.resetsOrderTotal),
      ),
    ).toEqual([true, true]);
  });

  it("keeps the warning off the last unpriced book, whose price completes the breakdown", () => {
    const order = makeOrder({ pricedItemsCount: 1 });
    const cards = toDeliveryOrderCards(
      [
        makeRow({ book: makeBook({ id: "book-1" }), id: "item-1", order, price: 200 }),
        makeRow({ book: makeBook({ id: "book-2" }), id: "item-2", order, price: null }),
      ],
      { labels, locale },
    );

    expect(
      firstCard(cards).shipments.flatMap((group) =>
        group.books.map((book) => book.resetsOrderTotal),
      ),
    ).toEqual([true, false]);
  });

  it("stays silent when the order carries no total to lose", () => {
    const order = makeOrder({ effectiveTotalAmount: null, totalAmount: null });
    const cards = toDeliveryOrderCards(
      [
        makeRow({ id: "item-1", order, price: null }),
        makeRow({ book: makeBook({ id: "book-2" }), id: "item-2", order, price: null }),
      ],
      { labels, locale },
    );

    expect(
      firstCard(cards).shipments.flatMap((group) =>
        group.books.map((book) => book.resetsOrderTotal),
      ),
    ).toEqual([false, false]);
  });

  it("keeps a stored total showing even while books stay unpriced", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({ id: "item-1", price: null }),
        makeRow({ book: makeBook({ id: "book-2" }), id: "item-2", price: null }),
      ],
      { labels, locale },
    );

    expect(firstCard(cards).totalText).toBe("480 UAH");
  });

  it("names a free order rather than pricing it at zero", () => {
    const order = makeOrder({ effectiveTotalAmount: 0, isFree: true, totalAmount: 0 });
    const cards = toDeliveryOrderCards(
      [
        makeRow({ id: "item-1", order, price: null }),
        makeRow({ book: makeBook({ id: "book-2" }), id: "item-2", order, price: null }),
      ],
      { labels, locale },
    );

    expect(firstCard(cards).totalText).toBe("Free");
    expect(
      firstCard(cards).shipments.flatMap((group) =>
        group.books.map((book) => book.resetsOrderTotal),
      ),
    ).toEqual([false, false]);
  });

  it("adds up every priced book into the calculated total", () => {
    const order = makeOrder({
      effectiveTotalAmount: 500,
      itemsCount: 2,
      pricedItemsCount: 2,
      totalAmount: null,
    });
    const cards = toDeliveryOrderCards(
      [
        makeRow({ id: "item-1", order, price: 200 }),
        makeRow({ book: makeBook({ id: "book-2" }), id: "item-2", order, price: 300 }),
      ],
      { labels, locale },
    );

    expect(firstCard(cards).totalText).toBe("500 UAH");
  });
});

describe("toSelectableShipments", () => {
  it("carries the count of books the server still reports as travelling", () => {
    const cards = toDeliveryOrderCards(
      [makeRow({ shipment: makeShipment({ activeItemsCount: 4 }) })],
      { labels, locale },
    );

    expect(firstCard(cards).shipments[0]?.activeItemsCount).toBe(4);
    expect(toSelectableShipments(cards)).toEqual([{ activeItemsCount: 4, id: "shipment-1" }]);
  });

  it("counts a cancelled book out of the parcel it was ordered in", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({ id: "item-1", shipment: makeShipment({ activeItemsCount: 2 }) }),
        makeRow({
          book: makeBook({ id: "book-2" }),
          id: "item-2",
          shipment: makeShipment({ activeItemsCount: 2 }),
        }),
      ],
      { labels, locale },
    );

    expect(firstCard(cards).shipments[0]?.books).toHaveLength(2);
    expect(toSelectableShipments(cards)).toEqual([{ activeItemsCount: 2, id: "shipment-1" }]);
  });

  it("leaves the books that are not in a parcel yet unselectable", () => {
    const cards = toDeliveryOrderCards([makeRow({ shipment: null })], { labels, locale });

    expect(firstCard(cards).shipments[0]?.id).toBeNull();
    expect(toSelectableShipments(cards)).toEqual([]);
  });

  it.each(["received", "cancelled"] as const)("leaves a %s parcel unselectable", (status) => {
    const cards = toDeliveryOrderCards([makeRow({ shipment: makeShipment({ status }) })], {
      labels,
      locale,
    });

    expect(toSelectableShipments(cards)).toEqual([]);
  });

  it("offers every active parcel of every order on its own", () => {
    const cards = toDeliveryOrderCards(
      [
        makeRow({
          id: "item-1",
          shipment: makeShipment({ activeItemsCount: 2, id: "shipment-a" }),
        }),
        makeRow({
          book: makeBook({ id: "book-2" }),
          id: "item-2",
          shipment: makeShipment({ activeItemsCount: 1, id: "shipment-b", status: "ordered" }),
        }),
        makeRow({
          book: makeBook({ id: "book-3" }),
          id: "item-3",
          order: makeOrder({ id: "order-2" }),
          shipment: makeShipment({ activeItemsCount: 3, id: "shipment-c" }),
        }),
        makeRow({ book: makeBook({ id: "book-4" }), id: "item-4", shipment: null }),
      ],
      { labels, locale },
    );

    expect(toSelectableShipments(cards)).toEqual([
      { activeItemsCount: 2, id: "shipment-a" },
      { activeItemsCount: 1, id: "shipment-b" },
      { activeItemsCount: 3, id: "shipment-c" },
    ]);
  });
});
