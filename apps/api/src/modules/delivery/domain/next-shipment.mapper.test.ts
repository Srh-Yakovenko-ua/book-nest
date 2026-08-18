import { describe, expect, it } from "vitest";

import type { NextShipmentSource } from "./next-shipment.mapper.js";

import { toNextShipmentView } from "./next-shipment.mapper.js";

const EXPECTED_DATE = new Date("2026-08-20T00:00:00.000Z");

function build(overrides: Partial<NextShipmentSource> = {}) {
  return toNextShipmentView({
    bookPreviews: [{ authorName: "Adams", cover: null, id: "book-a", title: "Alpha" }],
    booksCount: 1,
    sameDayCount: 0,
    shipment: makeShipment(overrides),
  });
}

function makeShipment(overrides: Partial<NextShipmentSource> = {}): NextShipmentSource {
  return {
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date("2026-08-01T09:00:00.000Z"),
    deliveryService: null,
    deliveryServiceId: null,
    deliveryServiceName: null,
    expectedDeliveryDate: EXPECTED_DATE,
    id: "shipment-1",
    note: null,
    order: { storeName: "Book24" },
    orderId: "order-1",
    pickupUntil: null,
    receivedAt: null,
    status: "in_transit",
    trackingNumber: "59000123456789",
    trackingUrl: null,
    updatedAt: new Date("2026-08-01T09:00:00.000Z"),
    ...overrides,
  };
}

describe("toNextShipmentView", () => {
  it("carries the store, the tracking number and the expected day onto the view", () => {
    expect(build()).toMatchObject({
      booksCount: 1,
      expectedDeliveryDate: "2026-08-20",
      orderId: "order-1",
      sameDayCount: 0,
      shipmentId: "shipment-1",
      status: "in_transit",
      storeName: "Book24",
      trackingNumber: "59000123456789",
    });
  });

  it("prefers the name stored on the shipment over the linked service", () => {
    const view = build({
      deliveryService: {
        countryCode: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "service-1",
        isDefault: false,
        name: "Ukrposhta",
        normalizedName: "ukrposhta",
        providerKey: null,
        sortOrder: 0,
        trackingUrlTemplate: null,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        userId: null,
      },
      deliveryServiceId: "service-1",
      deliveryServiceName: "Nova Poshta",
    });

    expect(view.deliveryService).toEqual({ id: "service-1", name: "Nova Poshta" });
  });

  it("falls back to the linked service when the shipment carries no name", () => {
    const view = build({
      deliveryService: {
        countryCode: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "service-2",
        isDefault: false,
        name: "Ukrposhta",
        normalizedName: "ukrposhta",
        providerKey: null,
        sortOrder: 0,
        trackingUrlTemplate: null,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        userId: null,
      },
      deliveryServiceId: "service-2",
    });

    expect(view.deliveryService).toEqual({ id: "service-2", name: "Ukrposhta" });
  });

  it("reports no service at all when neither side names one", () => {
    expect(build().deliveryService).toBeNull();
  });

  it("rejects a shipment status the block is not allowed to surface", () => {
    expect(() => build({ status: "ready_for_pickup" })).toThrow();
  });
});
