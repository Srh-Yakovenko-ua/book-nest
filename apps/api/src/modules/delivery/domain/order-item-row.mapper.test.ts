import type { BookPreview } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { DeliveryServiceModel, ShipmentModel } from "../../../generated/prisma/models.js";
import type { BookOrderItemRowSource } from "./order-item-row.mapper.js";

import { toBookOrderItemRowView } from "./order-item-row.mapper.js";

const CREATED_AT = new Date("2026-03-01T10:00:00.000Z");
const UPDATED_AT = new Date("2026-03-02T11:30:00.000Z");
const CANCELLED_AT = new Date("2026-03-06T09:00:00.000Z");
const ORDER_DATE = new Date("2026-03-04T00:00:00.000Z");
const TODAY = new Date("2026-03-08T00:00:00.000Z");

const ORDER_ID = "00000000-0000-4000-8000-00000000a001";
const ITEM_ID = "00000000-0000-4000-8000-00000000a002";
const SHIPMENT_ID = "00000000-0000-4000-8000-00000000a003";
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

type ShipmentSource = ShipmentModel & { deliveryService: DeliveryServiceModel | null };

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
      items: [{ cancelledAt: null, receivedAt: null, shipmentId: SHIPMENT_ID }],
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
          items: [
            { cancelledAt: null, receivedAt: CANCELLED_AT, shipmentId: SHIPMENT_ID },
            { cancelledAt: null, receivedAt: null, shipmentId: SHIPMENT_ID },
          ],
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
