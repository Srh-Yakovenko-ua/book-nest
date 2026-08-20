import type {
  BookOrderItemRowOrderView,
  BookOrderItemRowShipmentView,
  BookOrderItemRowView,
  BookPreview,
  Nullable,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import { toOrderHistoryGroups } from "./order-history-group.mapper.js";

const order: BookOrderItemRowOrderView = {
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
};

function book(id: string): BookPreview {
  return {
    cover: null,
    firstAuthorName: "Донна Тартт",
    genres: [],
    id,
    originalTitle: null,
    ownershipStatus: "owned",
    publisher: null,
    readingStatus: "not_started",
    series: null,
    tags: [],
    title: `Book ${id}`,
  };
}

function row({
  id,
  orderId = order.id,
  parcel = shipment(),
}: {
  id: string;
  orderId?: string;
  parcel?: Nullable<BookOrderItemRowShipmentView>;
}): BookOrderItemRowView {
  return {
    book: book(`book-${id}`),
    cancelledAt: null,
    cancelReason: null,
    id,
    order: { ...order, id: orderId },
    price: 480,
    receivedAt: "2026-08-19T10:00:00.000Z",
    shipment: parcel,
    uiStatus: null,
  };
}

function shipment(
  overrides: Partial<BookOrderItemRowShipmentView> = {},
): BookOrderItemRowShipmentView {
  return {
    activeItemsCount: 0,
    cancelledAt: null,
    cancelReason: null,
    deliveryService: { id: "service-1", name: "Nova Poshta" },
    expectedDeliveryDate: null,
    id: "shipment-1",
    note: null,
    pickupUntil: null,
    receivedAt: "2026-08-19T10:00:00.000Z",
    status: "received",
    trackingNumber: "TRK-1",
    trackingUrl: null,
    ...overrides,
  };
}

describe("toOrderHistoryGroups", () => {
  it("returns nothing for an empty page", () => {
    expect(toOrderHistoryGroups([])).toEqual([]);
  });

  it("folds the rows of one order into a single group", () => {
    const groups = toOrderHistoryGroups([row({ id: "item-1" }), row({ id: "item-2" })]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.order.id).toBe("order-1");
    expect(groups[0]?.booksCount).toBe(2);
    expect(groups[0]?.shipments[0]?.books.map((entry) => entry.id)).toEqual(["item-1", "item-2"]);
  });

  it("keeps every parcel of one order apart", () => {
    const groups = toOrderHistoryGroups([
      row({ id: "item-1" }),
      row({ id: "item-2", parcel: shipment({ id: "shipment-2" }) }),
    ]);

    expect(groups[0]?.shipments.map((group) => group.shipment?.id)).toEqual([
      "shipment-1",
      "shipment-2",
    ]);
  });

  it("keeps the books without a parcel in a group of their own", () => {
    const groups = toOrderHistoryGroups([
      row({ id: "item-1" }),
      row({ id: "item-2", parcel: null }),
    ]);

    expect(groups[0]?.shipments).toHaveLength(2);
    expect(groups[0]?.shipments[1]?.shipment).toBeNull();
    expect(groups[0]?.shipments[1]?.books.map((entry) => entry.id)).toEqual(["item-2"]);
  });

  it("preserves the order the rows arrived in", () => {
    const groups = toOrderHistoryGroups([
      row({ id: "item-1", orderId: "order-2" }),
      row({ id: "item-2", orderId: "order-1" }),
      row({ id: "item-3", orderId: "order-2" }),
    ]);

    expect(groups.map((group) => group.order.id)).toEqual(["order-2", "order-1"]);
    expect(groups[0]?.booksCount).toBe(2);
  });

  it("carries the terminal fields of the parcel and drops the in-transit-only count", () => {
    const groups = toOrderHistoryGroups([
      row({
        id: "item-1",
        parcel: shipment({
          cancelledAt: "2026-08-17T10:00:00.000Z",
          cancelReason: "Out of stock",
          receivedAt: null,
          status: "cancelled",
        }),
      }),
    ]);

    const parcel = groups[0]?.shipments[0]?.shipment;
    expect(parcel?.cancelledAt).toBe("2026-08-17T10:00:00.000Z");
    expect(parcel?.cancelReason).toBe("Out of stock");
    expect(parcel?.receivedAt).toBeNull();
    expect(parcel).not.toHaveProperty("activeItemsCount");
  });

  it("keeps the terminal fields of each book next to it", () => {
    const groups = toOrderHistoryGroups([
      {
        ...row({ id: "item-1" }),
        cancelledAt: "2026-08-18T10:00:00.000Z",
        cancelReason: "Found it cheaper",
        receivedAt: null,
      },
    ]);

    const entry = groups[0]?.shipments[0]?.books[0];
    expect(entry?.cancelledAt).toBe("2026-08-18T10:00:00.000Z");
    expect(entry?.cancelReason).toBe("Found it cheaper");
    expect(entry?.price).toBe(480);
  });
});
