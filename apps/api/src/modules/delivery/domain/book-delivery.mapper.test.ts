import { describe, expect, it } from "vitest";

import type { OrderedBookRow } from "./book-delivery.mapper.js";

import { Prisma } from "../../../generated/prisma/client.js";
import {
  NO_STORE_NAME,
  toActiveBookDeliveryView,
  toBookDeliverySummaryView,
  toBookDeliveryView,
} from "./book-delivery.mapper.js";

const ITEM_TOUCHED_AT = new Date("2026-08-01T10:00:00.000Z");
const ORDER_TOUCHED_AT = new Date("2026-08-02T10:00:00.000Z");
const SHIPMENT_TOUCHED_AT = new Date("2026-08-03T10:00:00.000Z");

function buildRow({
  item = {},
  order = {},
  shipment = {},
  withoutShipment = false,
}: {
  item?: Partial<OrderedBookRow>;
  order?: Partial<OrderedBookRow["order"]>;
  shipment?: Partial<NonNullable<OrderedBookRow["shipment"]>>;
  withoutShipment?: boolean;
} = {}): OrderedBookRow {
  return {
    bookId: "book-1",
    cancelledAt: null,
    cancelReason: null,
    createdAt: ITEM_TOUCHED_AT,
    id: "item-1",
    order: {
      createdAt: ORDER_TOUCHED_AT,
      currency: null,
      deliveryPrice: null,
      discount: null,
      id: "order-1",
      note: null,
      orderDate: null,
      orderNumber: null,
      storeName: "Yakaboo",
      totalAmount: null,
      updatedAt: ORDER_TOUCHED_AT,
      userId: "user-1",
      ...order,
    },
    orderId: "order-1",
    price: null,
    receivedAt: null,
    shipment: withoutShipment
      ? null
      : {
          cancelledAt: null,
          cancelReason: null,
          createdAt: SHIPMENT_TOUCHED_AT,
          deliveryService: null,
          deliveryServiceId: null,
          deliveryServiceName: null,
          expectedDeliveryDate: null,
          id: "shipment-1",
          note: null,
          orderId: "order-1",
          pickupUntil: null,
          receivedAt: null,
          status: "in_transit",
          trackingNumber: null,
          trackingUrl: null,
          updatedAt: SHIPMENT_TOUCHED_AT,
          ...shipment,
        },
    shipmentId: withoutShipment ? null : "shipment-1",
    updatedAt: ITEM_TOUCHED_AT,
    ...item,
  };
}

describe("toBookDeliveryView status", () => {
  it("reports cancelled once the item carries a cancellation stamp", () => {
    const view = toBookDeliveryView(
      buildRow({ item: { cancelledAt: new Date("2026-08-04T00:00:00.000Z") } }),
    );

    expect(view.status).toBe("cancelled");
  });

  it("reports cancelled even while the shipment is still moving", () => {
    const view = toBookDeliveryView(
      buildRow({
        item: { cancelledAt: new Date("2026-08-04T00:00:00.000Z") },
        shipment: { status: "in_transit" },
      }),
    );

    expect(view.status).toBe("cancelled");
  });

  it("reports received once the item carries an arrival stamp", () => {
    const view = toBookDeliveryView(
      buildRow({ item: { receivedAt: new Date("2026-08-04T00:00:00.000Z") } }),
    );

    expect(view.status).toBe("received");
  });

  it("falls back to ordered when the item has no shipment yet", () => {
    const view = toBookDeliveryView(buildRow({ withoutShipment: true }));

    expect(view.status).toBe("ordered");
  });

  it("mirrors an active shipment status", () => {
    const view = toBookDeliveryView(buildRow({ shipment: { status: "ready_for_pickup" } }));

    expect(view.status).toBe("ready_for_pickup");
  });

  it("falls back to ordered when the shipment is terminal but the item is not", () => {
    const view = toBookDeliveryView(buildRow({ shipment: { status: "cancelled" } }));

    expect(view.status).toBe("ordered");
  });
});

describe("toBookDeliveryView fields", () => {
  it("maps a stored empty store name back to null", () => {
    const view = toBookDeliveryView(buildRow({ order: { storeName: NO_STORE_NAME } }));

    expect(view.storeName).toBeNull();
  });

  it("keeps a real store name", () => {
    const view = toBookDeliveryView(buildRow({ order: { storeName: "Yakaboo" } }));

    expect(view.storeName).toBe("Yakaboo");
  });

  it("takes updatedAt from the most recently touched row of the three", () => {
    const view = toBookDeliveryView(buildRow());

    expect(view.updatedAt).toBe(SHIPMENT_TOUCHED_AT.toISOString());
  });

  it("ignores a missing shipment when resolving updatedAt", () => {
    const view = toBookDeliveryView(buildRow({ withoutShipment: true }));

    expect(view.updatedAt).toBe(ORDER_TOUCHED_AT.toISOString());
  });

  it("reads the price through the decimal column", () => {
    const view = toBookDeliveryView(buildRow({ item: { price: new Prisma.Decimal("249.50") } }));

    expect(view.price).toBe(249.5);
  });
});

describe("toBookDeliverySummaryView", () => {
  it("reports the caller's total instead of the page it was given", () => {
    const summary = toBookDeliverySummaryView({ items: [buildRow()], totalCount: 7 });

    expect(summary.totalCount).toBe(7);
    expect(summary.latest?.id).toBe("item-1");
    expect(summary.active?.id).toBe("item-1");
  });

  it("leaves active empty when the newest item is terminal", () => {
    const summary = toBookDeliverySummaryView({
      items: [buildRow({ item: { receivedAt: new Date("2026-08-04T00:00:00.000Z") } })],
      totalCount: 1,
    });

    expect(summary.active).toBeNull();
    expect(summary.latest?.status).toBe("received");
  });

  it("returns an empty summary for a book that was never ordered", () => {
    const summary = toBookDeliverySummaryView({ items: [], totalCount: 0 });

    expect(summary).toEqual({ active: null, latest: null, totalCount: 0 });
  });
});

describe("toActiveBookDeliveryView", () => {
  it("returns the live item", () => {
    expect(toActiveBookDeliveryView([buildRow()])?.id).toBe("item-1");
  });

  it("returns null when every item is terminal", () => {
    const items = [buildRow({ item: { cancelledAt: new Date("2026-08-04T00:00:00.000Z") } })];

    expect(toActiveBookDeliveryView(items)).toBeNull();
  });
});
