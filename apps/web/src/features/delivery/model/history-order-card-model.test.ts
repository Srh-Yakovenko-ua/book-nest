import type {
  BookPreview,
  OrderHistoryBookView,
  OrderHistoryGroupView,
  OrderHistoryShipmentGroupView,
  OrderHistoryShipmentView,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { HistoryCardLabels } from "./history-order-card-model";
import type { DeliveryHistoryTab } from "./history-params";

import { toHistoryOrderCards } from "./history-order-card-model";

const labels: HistoryCardLabels = {
  cancelledOn: (date) => `Скасовано ${date}`,
  expectedOn: (date) => `Очікувалось ${date}`,
  receivedOn: (date) => `Отримано ${date}`,
  seriesPosition: (position, total) => `${position} з ${total}`,
  status: (key) => key,
};

function bookPreview(overrides: Partial<BookPreview> = {}): BookPreview {
  return {
    cover: null,
    firstAuthorName: "Донна Тартт",
    genres: [],
    id: "book-1",
    originalTitle: null,
    ownershipStatus: "owned",
    publisher: null,
    readingStatus: "not_started",
    series: null,
    tags: [],
    title: "Таємна історія",
    ...overrides,
  };
}

function historyBook(overrides: Partial<OrderHistoryBookView> = {}): OrderHistoryBookView {
  return {
    book: bookPreview(),
    cancelledAt: null,
    cancelReason: null,
    id: "item-1",
    price: 480,
    receivedAt: "2026-08-19T10:00:00.000Z",
    ...overrides,
  };
}

function historyGroup(
  shipments: OrderHistoryShipmentGroupView[],
  overrides: Partial<OrderHistoryGroupView["order"]> = {},
): OrderHistoryGroupView {
  return {
    booksCount: shipments.reduce((count, group) => count + group.books.length, 0),
    order: {
      currency: "UAH",
      deliveryPrice: null,
      derivedStatus: "received",
      discount: null,
      effectiveTotalAmount: 2300,
      id: "order-1",
      isFree: false,
      itemsCount: 6,
      orderDate: "2026-08-01",
      orderNumber: "ORD-10241",
      pricedItemsCount: 6,
      storeName: "Book24",
      totalAmount: 2300,
      ...overrides,
    },
    shipments,
  };
}

function historyShipment(
  overrides: Partial<OrderHistoryShipmentView> = {},
): OrderHistoryShipmentView {
  return {
    cancelledAt: null,
    cancelReason: null,
    deliveryService: { id: "service-1", name: "Нова Пошта" },
    expectedDeliveryDate: null,
    id: "shipment-1",
    note: null,
    pickupUntil: null,
    receivedAt: "2026-08-19T10:00:00.000Z",
    status: "received",
    trackingNumber: "20450012345678",
    trackingUrl: "https://tracking.example.com/20450012345678",
    ...overrides,
  };
}

function toCards(
  groups: OrderHistoryGroupView[],
  options: { search?: string; tab?: DeliveryHistoryTab } = {},
) {
  return toHistoryOrderCards(groups, {
    labels,
    locale: "uk",
    search: options.search ?? "",
    tab: options.tab ?? "received",
  });
}

describe("toHistoryOrderCards", () => {
  it("takes the header total from the canonical order amount, not from the visible books", () => {
    const [card] = toCards([
      historyGroup([{ books: [historyBook({ price: 100 })], shipment: historyShipment() }]),
    ]);

    expect(card?.totalText).toBe("2\u00a0300 UAH");
    expect(card?.booksCount).toBe(1);
  });

  it("leaves the total empty for a legacy order the backfill could not resolve", () => {
    const [card] = toCards([
      historyGroup([{ books: [historyBook()], shipment: historyShipment() }], {
        effectiveTotalAmount: null,
      }),
    ]);

    expect(card?.totalText).toBeNull();
  });

  it("dates a received parcel from the parcel itself", () => {
    const [card] = toCards([
      historyGroup([{ books: [historyBook()], shipment: historyShipment() }]),
    ]);

    expect(card?.shipments[0]?.terminalText).toBe("Отримано 19 серп. 2026 р.");
  });

  it("dates a cancelled parcel and keeps the reason that belongs to the whole parcel", () => {
    const [card] = toCards(
      [
        historyGroup([
          {
            books: [historyBook({ cancelledAt: "2026-08-17T10:00:00.000Z", receivedAt: null })],
            shipment: historyShipment({
              cancelledAt: "2026-08-17T10:00:00.000Z",
              cancelReason: "Магазин скасував замовлення",
              receivedAt: null,
              status: "cancelled",
            }),
          },
        ]),
      ],
      { tab: "cancelled" },
    );

    expect(card?.shipments[0]?.terminalText).toBe("Скасовано 17 серп. 2026 р.");
    expect(card?.shipments[0]?.cancelReason).toBe("Магазин скасував замовлення");
  });

  it("never turns a live parcel terminal just because one of its books was cancelled", () => {
    const [card] = toCards(
      [
        historyGroup([
          {
            books: [
              historyBook({
                cancelledAt: "2026-08-17T10:00:00.000Z",
                cancelReason: "Немає в наявності",
                receivedAt: null,
              }),
            ],
            shipment: historyShipment({ receivedAt: null, status: "in_transit" }),
          },
        ]),
      ],
      { tab: "cancelled" },
    );

    expect(card?.shipments[0]?.badge?.value).toBe("in_transit");
    expect(card?.shipments[0]?.terminalText).toBeNull();
    expect(card?.shipments[0]?.cancelReason).toBeNull();
    expect(card?.shipments[0]?.books[0]?.terminalText).toBe("Скасовано 17 серп. 2026 р.");
    expect(card?.shipments[0]?.books[0]?.cancelReason).toBe("Немає в наявності");
  });

  it("repeats a book date only when it differs from the date of its parcel", () => {
    const [card] = toCards([
      historyGroup([
        {
          books: [
            historyBook({ id: "same-day" }),
            historyBook({ id: "earlier", receivedAt: "2026-08-18T10:00:00.000Z" }),
          ],
          shipment: historyShipment(),
        },
      ]),
    ]);

    expect(card?.shipments[0]?.books[0]?.terminalText).toBeNull();
    expect(card?.shipments[0]?.books[1]?.terminalText).toBe("Отримано 18 серп. 2026 р.");
  });

  it("notes the expected date only when the parcel did not arrive on it", () => {
    const [onTime] = toCards([
      historyGroup([
        {
          books: [historyBook()],
          shipment: historyShipment({ expectedDeliveryDate: "2026-08-19" }),
        },
      ]),
    ]);
    const [late] = toCards([
      historyGroup([
        {
          books: [historyBook()],
          shipment: historyShipment({ expectedDeliveryDate: "2026-08-12" }),
        },
      ]),
    ]);

    expect(onTime?.shipments[0]?.expectedText).toBeNull();
    expect(late?.shipments[0]?.expectedText).toBe("Очікувалось 12 серп. 2026 р.");
  });

  it("keeps the expected date out of the cancelled tab", () => {
    const [card] = toCards(
      [
        historyGroup([
          {
            books: [historyBook({ cancelledAt: "2026-08-17T10:00:00.000Z", receivedAt: null })],
            shipment: historyShipment({
              cancelledAt: "2026-08-17T10:00:00.000Z",
              expectedDeliveryDate: "2026-08-20",
              receivedAt: null,
              status: "cancelled",
            }),
          },
        ]),
      ],
      { tab: "cancelled" },
    );

    expect(card?.shipments[0]?.expectedText).toBeNull();
  });

  it("keeps the books that never reached a parcel in a group without a shipment", () => {
    const [card] = toCards(
      [
        historyGroup([
          {
            books: [historyBook({ cancelledAt: "2026-08-17T10:00:00.000Z", receivedAt: null })],
            shipment: null,
          },
        ]),
      ],
      { tab: "cancelled" },
    );

    expect(card?.shipments[0]?.id).toBeNull();
    expect(card?.shipments[0]?.badge).toBeNull();
    expect(card?.shipments[0]?.serviceName).toBeNull();
    expect(card?.shipments[0]?.books[0]?.terminalText).toBe("Скасовано 17 серп. 2026 р.");
  });

  it("drops a tracking link that is not an https url", () => {
    const [card] = toCards([
      historyGroup([
        {
          books: [historyBook()],
          shipment: historyShipment({ trackingUrl: "javascript:alert(1)" }),
        },
      ]),
    ]);

    expect(card?.shipments[0]?.trackingHref).toBeNull();
    expect(card?.shipments[0]?.trackingNumber).toBe("20450012345678");
  });

  it("flags an order whose search match is hidden behind the collapsed books", () => {
    const books = Array.from({ length: 5 }, (_, index) =>
      historyBook({ book: bookPreview({ title: `Книга ${index}` }), id: `item-${index}` }),
    );
    const groups = [historyGroup([{ books, shipment: historyShipment() }])];

    expect(toCards(groups, { search: "Книга 4" })[0]?.revealsSearchMatch).toBe(true);
    expect(toCards(groups, { search: "Книга 1" })[0]?.revealsSearchMatch).toBe(false);
    expect(toCards(groups, { search: "" })[0]?.revealsSearchMatch).toBe(false);
  });
});
