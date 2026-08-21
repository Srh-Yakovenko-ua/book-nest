import type { BookPreview } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { DeliveryServiceModel, ShipmentModel } from "../../../generated/prisma/models.js";
import type { BookOrderItemRowSource } from "./order-item-row.mapper.js";

import { Prisma } from "../../../generated/prisma/client.js";
import { toBookOrderItemRowView } from "./order-item-row.mapper.js";

const CREATED_AT = new Date("2026-03-01T10:00:00.000Z");
const UPDATED_AT = new Date("2026-03-02T11:30:00.000Z");
const CANCELLED_AT = new Date("2026-03-06T09:00:00.000Z");
const RECEIVED_AT = new Date("2026-03-07T09:00:00.000Z");
const DELETED_AT = new Date("2026-03-05T09:00:00.000Z");
const ORDER_DATE = new Date("2026-03-04T00:00:00.000Z");
const TODAY = new Date("2026-03-08T00:00:00.000Z");

const ORDER_ID = "00000000-0000-4000-8000-00000000a001";
const ITEM_ID = "00000000-0000-4000-8000-00000000a002";
const SHIPMENT_ID = "00000000-0000-4000-8000-00000000a003";
const OTHER_SHIPMENT_ID = "00000000-0000-4000-8000-00000000a004";
const BOOK_ID = "00000000-0000-4000-8000-00000000b001";
const USER_ID = "00000000-0000-4000-8000-00000000d001";

const BOOK: BookPreview = {
  cover: null,
  firstAuthorName: "Serhiy Zhadan",
  genres: [],
  id: BOOK_ID,
  originalTitle: null,
  ownershipStatus: "in_transit",
  publisher: null,
  readingStatus: "not_started",
  series: null,
  tags: [],
  title: "Internat",
};

type OrderItemSource = BookOrderItemRowSource["order"]["items"][number];

type ShipmentSource = ShipmentModel & { deliveryService: DeliveryServiceModel | null };

function makeOrderItem(overrides: Partial<OrderItemSource> = {}): OrderItemSource {
  return {
    book: { deletedAt: null },
    cancelledAt: null,
    price: null,
    receivedAt: null,
    shipmentId: SHIPMENT_ID,
    ...overrides,
  };
}

function makeRow(overrides: Partial<BookOrderItemRowSource> = {}): BookOrderItemRowSource {
  return {
    bookId: BOOK_ID,
    cancelledAt: null,
    cancelReason: null,
    createdAt: CREATED_AT,
    id: ITEM_ID,
    order: {
      createdAt: CREATED_AT,
      currency: "UAH",
      deliveryPrice: null,
      discount: null,
      id: ORDER_ID,
      isFree: false,
      items: [makeOrderItem()],
      note: null,
      orderDate: ORDER_DATE,
      orderNumber: null,
      shipments: [{ id: SHIPMENT_ID, status: "ordered" }],
      storeName: "Yakaboo",
      totalAmount: null,
      updatedAt: UPDATED_AT,
      userId: USER_ID,
    },
    orderId: ORDER_ID,
    price: null,
    receivedAt: null,
    shipment: makeShipment(),
    shipmentId: SHIPMENT_ID,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function makeShipment(overrides: Partial<ShipmentSource> = {}): ShipmentSource {
  return {
    cancelledAt: null,
    cancelReason: null,
    createdAt: CREATED_AT,
    deliveryService: null,
    deliveryServiceId: null,
    deliveryServiceName: null,
    expectedDeliveryDate: null,
    id: SHIPMENT_ID,
    note: null,
    orderId: ORDER_ID,
    pickupUntil: null,
    receivedAt: null,
    status: "ordered",
    trackingNumber: null,
    trackingUrl: null,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

describe("toBookOrderItemRowView carries the reasons a reader wrote down", () => {
  it("uses the order domain status derived from every item and shipment", () => {
    const view = toBookOrderItemRowView({
      book: BOOK,
      row: makeRow({
        order: {
          ...makeRow().order,
          items: [makeOrderItem({ receivedAt: CANCELLED_AT }), makeOrderItem()],
        },
      }),
      today: TODAY,
    });

    expect(view.order.derivedStatus).toBe("partially_received");
  });

  it("passes the item's own cancel reason through", () => {
    const view = toBookOrderItemRowView({
      book: BOOK,
      row: makeRow({ cancelledAt: CANCELLED_AT, cancelReason: "Store ran out of stock" }),
      today: TODAY,
    });

    expect(view.cancelReason).toBe("Store ran out of stock");
  });

  it("leaves the cancel reason null while the item is still on its way", () => {
    const view = toBookOrderItemRowView({ book: BOOK, row: makeRow(), today: TODAY });

    expect(view.cancelReason).toBeNull();
  });

  it("passes the order note through, so the card can show it above the parcels", () => {
    const view = toBookOrderItemRowView({
      book: BOOK,
      row: makeRow({ order: { ...makeRow().order, note: "Paid by card, invoice needed" } }),
      today: TODAY,
    });

    expect(view.order.note).toBe("Paid by card, invoice needed");
  });

  it("leaves the order note null when the reader left the comment empty", () => {
    const view = toBookOrderItemRowView({ book: BOOK, row: makeRow(), today: TODAY });

    expect(view.order.note).toBeNull();
  });

  it("passes the parcel note through, since that is where a per-book note lives", () => {
    const view = toBookOrderItemRowView({
      book: BOOK,
      row: makeRow({ shipment: makeShipment({ note: "Ask for a second box" }) }),
      today: TODAY,
    });

    expect(view.shipment?.note).toBe("Ask for a second box");
  });

  it("reports no parcel at all for a book that has not been shipped yet", () => {
    const view = toBookOrderItemRowView({
      book: BOOK,
      row: makeRow({ shipment: null, shipmentId: null }),
      today: TODAY,
    });

    expect(view.shipment).toBeNull();
  });
});

describe("the order total a row carries covers the whole order, not the page", () => {
  function orderView(order: Partial<BookOrderItemRowSource["order"]>) {
    return toBookOrderItemRowView({
      book: BOOK,
      row: makeRow({ order: { ...makeRow().order, ...order } }),
      today: TODAY,
    }).order;
  }

  it("adds up every book of the order, plus delivery, minus discount", () => {
    expect(
      orderView({
        deliveryPrice: new Prisma.Decimal("100.00"),
        discount: new Prisma.Decimal("50.00"),
        items: [
          makeOrderItem({ price: new Prisma.Decimal("200.00") }),
          makeOrderItem({ price: new Prisma.Decimal("300.00") }),
        ],
      }),
    ).toMatchObject({ effectiveTotalAmount: 550, itemsCount: 2, pricedItemsCount: 2 });
  });

  it("falls back to the total the reader typed once a book carries no price", () => {
    expect(
      orderView({
        items: [makeOrderItem({ price: new Prisma.Decimal("200.00") }), makeOrderItem()],
        totalAmount: new Prisma.Decimal("600.00"),
      }),
    ).toMatchObject({ effectiveTotalAmount: 600, itemsCount: 2, pricedItemsCount: 1 });
  });

  it("reports no total when neither the breakdown nor the reader supplies one", () => {
    expect(
      orderView({ items: [makeOrderItem(), makeOrderItem()], totalAmount: null }),
    ).toMatchObject({ effectiveTotalAmount: null, itemsCount: 2, pricedItemsCount: 0 });
  });

  it("leaves the books of trashed titles out of the breakdown", () => {
    expect(
      orderView({
        items: [
          makeOrderItem({ price: new Prisma.Decimal("200.00") }),
          makeOrderItem({ book: { deletedAt: CANCELLED_AT } }),
        ],
        totalAmount: null,
      }),
    ).toMatchObject({ effectiveTotalAmount: 200, itemsCount: 1, pricedItemsCount: 1 });
  });
});

describe("the parcel of a row reports how many books are still on their way", () => {
  function shipmentView(items: BookOrderItemRowSource["order"]["items"]) {
    return toBookOrderItemRowView({
      book: BOOK,
      row: makeRow({ order: { ...makeRow().order, items } }),
      today: TODAY,
    }).shipment;
  }

  it("counts the books of this parcel, not the books of the whole order", () => {
    expect(
      shipmentView([
        makeOrderItem(),
        makeOrderItem(),
        makeOrderItem({ shipmentId: OTHER_SHIPMENT_ID }),
        makeOrderItem({ shipmentId: null }),
      ]),
    ).toMatchObject({ activeItemsCount: 2 });
  });

  it("leaves the cancelled, the received and the trashed books of the parcel out", () => {
    expect(
      shipmentView([
        makeOrderItem(),
        makeOrderItem(),
        makeOrderItem({ cancelledAt: CANCELLED_AT }),
        makeOrderItem({ receivedAt: RECEIVED_AT }),
        makeOrderItem({ book: { deletedAt: DELETED_AT } }),
      ]),
    ).toMatchObject({ activeItemsCount: 2 });
  });
});
