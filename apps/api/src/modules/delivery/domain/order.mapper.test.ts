import { describe, expect, it } from "vitest";

import type { BookOrderItemModel, DeliveryServiceModel } from "../../../generated/prisma/models.js";
import type { BookOrderRow, ShipmentRow } from "./order.mapper.js";

import { Prisma } from "../../../generated/prisma/client.js";
import { toBookOrderItemView, toBookOrderView, toShipmentView } from "./order.mapper.js";

const CREATED_AT = new Date("2026-03-01T10:00:00.000Z");
const UPDATED_AT = new Date("2026-03-02T11:30:00.000Z");
const RECEIVED_AT = new Date("2026-03-12T15:00:00.000Z");
const CANCELLED_AT = new Date("2026-03-06T09:00:00.000Z");
const ORDER_DATE = new Date("2026-03-04T00:00:00.000Z");
const EXPECTED_DELIVERY_DATE = new Date("2026-03-11T00:00:00.000Z");
const PICKUP_UNTIL = new Date("2026-03-15T00:00:00.000Z");

const ORDER_ID = "00000000-0000-4000-8000-00000000a001";
const ITEM_ID = "00000000-0000-4000-8000-00000000a002";
const SHIPMENT_ID = "00000000-0000-4000-8000-00000000a003";
const BOOK_ID = "00000000-0000-4000-8000-00000000b001";
const SERVICE_ID = "00000000-0000-4000-8000-00000000c001";

function makeDeliveryService(overrides: Partial<DeliveryServiceModel> = {}): DeliveryServiceModel {
  return {
    countryCode: "UA",
    createdAt: CREATED_AT,
    id: SERVICE_ID,
    isDefault: false,
    name: "Nova Poshta",
    normalizedName: "nova poshta",
    providerKey: "nova-poshta",
    sortOrder: 0,
    trackingUrlTemplate: "https://track.example.com/parcel/{trackingNumber}",
    updatedAt: UPDATED_AT,
    userId: null,
    ...overrides,
  };
}

function makeItem(overrides: Partial<BookOrderItemModel> = {}): BookOrderItemModel {
  return {
    bookId: BOOK_ID,
    cancelledAt: null,
    cancelReason: null,
    createdAt: CREATED_AT,
    id: ITEM_ID,
    orderId: ORDER_ID,
    price: null,
    receivedAt: null,
    shipmentId: SHIPMENT_ID,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<BookOrderRow> = {}): BookOrderRow {
  return {
    createdAt: CREATED_AT,
    currency: "UAH",
    deliveryPrice: null,
    discount: null,
    id: ORDER_ID,
    items: [],
    note: null,
    orderDate: ORDER_DATE,
    orderNumber: null,
    shipments: [],
    storeName: "Yakaboo",
    totalAmount: null,
    updatedAt: UPDATED_AT,
    userId: "00000000-0000-4000-8000-00000000d001",
    ...overrides,
  };
}

function makeShipment(overrides: Partial<ShipmentRow> = {}): ShipmentRow {
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

describe("toBookOrderItemView", () => {
  it("maps every field of an order item into its view shape", () => {
    const item = makeItem({
      cancelledAt: CANCELLED_AT,
      cancelReason: "Out of stock",
      price: new Prisma.Decimal("349.50"),
      receivedAt: RECEIVED_AT,
    });

    expect(toBookOrderItemView(item)).toEqual({
      bookId: BOOK_ID,
      cancelledAt: "2026-03-06T09:00:00.000Z",
      cancelReason: "Out of stock",
      id: ITEM_ID,
      orderId: ORDER_ID,
      price: 349.5,
      receivedAt: "2026-03-12T15:00:00.000Z",
      shipmentId: SHIPMENT_ID,
    });
  });

  it("reads a decimal price as a plain number", () => {
    expect(toBookOrderItemView(makeItem({ price: new Prisma.Decimal("12.30") })).price).toBe(12.3);
  });

  it("keeps a missing price null instead of turning it into zero", () => {
    expect(toBookOrderItemView(makeItem({ price: null })).price).toBeNull();
  });
});

describe("toShipmentView", () => {
  it("maps every field of a parcel into its view shape", () => {
    const shipment = makeShipment({
      cancelledAt: CANCELLED_AT,
      cancelReason: "Store cancelled the parcel",
      deliveryService: makeDeliveryService(),
      deliveryServiceId: SERVICE_ID,
      deliveryServiceName: "Nova Poshta",
      expectedDeliveryDate: EXPECTED_DELIVERY_DATE,
      note: "handle with care",
      pickupUntil: PICKUP_UNTIL,
      receivedAt: RECEIVED_AT,
      status: "received",
      trackingNumber: "TTN-1",
    });

    expect(toShipmentView(shipment)).toEqual({
      cancelledAt: "2026-03-06T09:00:00.000Z",
      cancelReason: "Store cancelled the parcel",
      createdAt: "2026-03-01T10:00:00.000Z",
      deliveryService: { id: SERVICE_ID, name: "Nova Poshta" },
      expectedDeliveryDate: "2026-03-11",
      id: SHIPMENT_ID,
      note: "handle with care",
      orderId: ORDER_ID,
      pickupUntil: "2026-03-15",
      receivedAt: "2026-03-12T15:00:00.000Z",
      status: "received",
      trackingNumber: "TTN-1",
      trackingUrl: "https://track.example.com/parcel/TTN-1",
      updatedAt: "2026-03-02T11:30:00.000Z",
    });
  });

  it("refuses a stored parcel status the shared contract does not know", () => {
    expect(() => toShipmentView(makeShipment({ status: "on_the_moon" }))).toThrow();
  });

  it("names the delivery service from the linked record when the parcel stored no name", () => {
    const shipment = makeShipment({
      deliveryService: makeDeliveryService(),
      deliveryServiceId: SERVICE_ID,
    });

    expect(toShipmentView(shipment).deliveryService).toEqual({
      id: SERVICE_ID,
      name: "Nova Poshta",
    });
  });

  it("reports no delivery service when neither the parcel nor a link names one", () => {
    expect(toShipmentView(makeShipment()).deliveryService).toBeNull();
  });

  it("builds the tracking URL from the carrier template when the reader typed none", () => {
    const shipment = makeShipment({
      deliveryService: makeDeliveryService(),
      trackingNumber: "TTN-9",
    });

    expect(toShipmentView(shipment).trackingUrl).toBe("https://track.example.com/parcel/TTN-9");
  });

  it("prefers the tracking URL the reader typed over the one the template would build", () => {
    const shipment = makeShipment({
      deliveryService: makeDeliveryService(),
      trackingNumber: "TTN-9",
      trackingUrl: "https://my-own-link.example.com/parcel",
    });

    expect(toShipmentView(shipment).trackingUrl).toBe("https://my-own-link.example.com/parcel");
  });

  it("leaves the tracking URL empty when the carrier has no template", () => {
    const shipment = makeShipment({
      deliveryService: makeDeliveryService({ trackingUrlTemplate: null }),
      trackingNumber: "TTN-9",
    });

    expect(toShipmentView(shipment).trackingUrl).toBeNull();
  });
});

describe("toBookOrderView", () => {
  it("maps every field of an order into its view shape", () => {
    const order = makeOrder({
      deliveryPrice: new Prisma.Decimal("60.00"),
      discount: new Prisma.Decimal("15.50"),
      items: [makeItem({ price: new Prisma.Decimal("349.50") })],
      note: "gift wrap",
      orderNumber: "ORD-1",
      shipments: [makeShipment({ expectedDeliveryDate: EXPECTED_DELIVERY_DATE })],
      totalAmount: new Prisma.Decimal("394.00"),
    });

    expect(toBookOrderView(order)).toEqual({
      createdAt: "2026-03-01T10:00:00.000Z",
      currency: "UAH",
      deliveryPrice: 60,
      derivedStatus: "shipped",
      discount: 15.5,
      id: ORDER_ID,
      items: [
        {
          bookId: BOOK_ID,
          cancelledAt: null,
          cancelReason: null,
          id: ITEM_ID,
          orderId: ORDER_ID,
          price: 349.5,
          receivedAt: null,
          shipmentId: SHIPMENT_ID,
        },
      ],
      note: "gift wrap",
      orderDate: "2026-03-04",
      orderNumber: "ORD-1",
      shipments: [
        {
          cancelledAt: null,
          cancelReason: null,
          createdAt: "2026-03-01T10:00:00.000Z",
          deliveryService: null,
          expectedDeliveryDate: "2026-03-11",
          id: SHIPMENT_ID,
          note: null,
          orderId: ORDER_ID,
          pickupUntil: null,
          receivedAt: null,
          status: "ordered",
          trackingNumber: null,
          trackingUrl: null,
          updatedAt: "2026-03-02T11:30:00.000Z",
        },
      ],
      storeName: "Yakaboo",
      totalAmount: 394,
      updatedAt: "2026-03-02T11:30:00.000Z",
    });
  });

  it("derives the order status from its items and parcels", () => {
    const order = makeOrder({
      items: [
        makeItem({ id: "item-arrived", receivedAt: RECEIVED_AT }),
        makeItem({ id: "item-travelling" }),
      ],
      shipments: [makeShipment({ status: "in_transit" })],
    });

    expect(toBookOrderView(order).derivedStatus).toBe("partially_received");
  });

  it("refuses a stored currency the shared contract does not know", () => {
    expect(() => toBookOrderView(makeOrder({ currency: "GBP" }))).toThrow();
  });

  it("keeps a missing currency null", () => {
    expect(toBookOrderView(makeOrder({ currency: null })).currency).toBeNull();
  });

  it("keeps missing money fields null instead of turning them into zero", () => {
    const view = toBookOrderView(makeOrder());

    expect({
      deliveryPrice: view.deliveryPrice,
      discount: view.discount,
      totalAmount: view.totalAmount,
    }).toEqual({ deliveryPrice: null, discount: null, totalAmount: null });
  });
});
