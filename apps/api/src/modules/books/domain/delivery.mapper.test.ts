import { describe, expect, it } from "vitest";

import type { BookDeliveryModel } from "../../../generated/prisma/models.js";

import { Prisma } from "../../../generated/prisma/client.js";
import { toDeliverySummaryView, toDeliveryView } from "./delivery.mapper.js";

const BASE_CREATED_AT = new Date("2026-02-01T10:00:00.000Z");

function makeDelivery(overrides: Partial<BookDeliveryModel> = {}): BookDeliveryModel {
  return {
    bookId: "00000000-0000-4000-8000-00000000b001",
    cancelledAt: null,
    createdAt: BASE_CREATED_AT,
    currency: null,
    deliveryService: null,
    expectedDeliveryDate: null,
    id: "00000000-0000-4000-8000-00000000d001",
    note: null,
    orderDate: null,
    orderNumber: null,
    price: null,
    receivedAt: null,
    status: "ordered",
    storeName: null,
    trackingNumber: null,
    trackingUrl: null,
    updatedAt: BASE_CREATED_AT,
    userId: "00000000-0000-4000-8000-00000000u001",
    ...overrides,
  };
}

describe("toDeliveryView", () => {
  it("maps every field of a delivery into its view shape", () => {
    const delivery = makeDelivery({
      cancelledAt: new Date("2026-02-05T12:00:00.000Z"),
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      currency: "UAH",
      deliveryService: "Nova Poshta",
      expectedDeliveryDate: new Date("2026-02-10T00:00:00.000Z"),
      id: "00000000-0000-4000-8000-00000000dfff",
      note: "handle with care",
      orderDate: new Date("2026-01-20T00:00:00.000Z"),
      orderNumber: "ORD-1",
      price: new Prisma.Decimal("349.50"),
      receivedAt: new Date("2026-02-08T09:00:00.000Z"),
      status: "received",
      storeName: "Yakaboo",
      trackingNumber: "TTN-1",
      trackingUrl: "https://track.example.com",
    });

    expect(toDeliveryView(delivery)).toEqual({
      cancelledAt: "2026-02-05T12:00:00.000Z",
      createdAt: "2026-02-01T10:00:00.000Z",
      currency: "UAH",
      deliveryService: "Nova Poshta",
      expectedDeliveryDate: "2026-02-10",
      id: "00000000-0000-4000-8000-00000000dfff",
      note: "handle with care",
      orderDate: "2026-01-20",
      orderNumber: "ORD-1",
      price: 349.5,
      receivedAt: "2026-02-08T09:00:00.000Z",
      status: "received",
      storeName: "Yakaboo",
      trackingNumber: "TTN-1",
      trackingUrl: "https://track.example.com",
    });
  });

  it("maps a null price to null and a decimal price to a number", () => {
    expect(toDeliveryView(makeDelivery({ price: null })).price).toBeNull();
    expect(toDeliveryView(makeDelivery({ price: new Prisma.Decimal("12.30") })).price).toBe(12.3);
  });

  it("throws when the stored status is not a known delivery status", () => {
    expect(() => toDeliveryView(makeDelivery({ status: "bogus" }))).toThrow();
  });
});

describe("toDeliverySummaryView", () => {
  it("returns a null active, null latest and zero total for an empty list", () => {
    expect(toDeliverySummaryView([])).toEqual({ active: null, latest: null, totalCount: 0 });
  });

  it("counts every delivery including terminal ones in totalCount", () => {
    const summary = toDeliverySummaryView([
      makeDelivery({ id: "d-1", status: "cancelled" }),
      makeDelivery({ id: "d-2", status: "received" }),
      makeDelivery({ id: "d-3", status: "ordered" }),
    ]);

    expect(summary.totalCount).toBe(3);
  });

  it("picks the active delivery even when it is not the newest row", () => {
    const summary = toDeliverySummaryView([
      makeDelivery({ id: "d-newest", status: "received" }),
      makeDelivery({ id: "d-active", status: "ready_for_pickup" }),
    ]);

    expect(summary.active?.id).toBe("d-active");
  });

  it("uses the newest row as latest even when it is terminal", () => {
    const summary = toDeliverySummaryView([
      makeDelivery({ id: "d-newest", status: "cancelled" }),
      makeDelivery({ id: "d-active", status: "ordered" }),
    ]);

    expect(summary.latest?.id).toBe("d-newest");
    expect(summary.active?.id).toBe("d-active");
  });

  it("returns a null active when no delivery is active", () => {
    const summary = toDeliverySummaryView([
      makeDelivery({ id: "d-1", status: "received" }),
      makeDelivery({ id: "d-2", status: "cancelled" }),
    ]);

    expect(summary.active).toBeNull();
    expect(summary.latest?.id).toBe("d-1");
    expect(summary.totalCount).toBe(2);
  });
});
