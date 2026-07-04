import type { CreateDeliveryInput, UpdateDeliveryInput } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  computeCancelDelivery,
  computeCreateDelivery,
  computeReceiveDelivery,
  computeUpdateDelivery,
} from "./delivery-transition.js";

const ORDER_DATE = "2026-01-20";
const PARSED_ORDER_DATE = new Date("2026-01-20T00:00:00.000Z");
const EXPECTED_DATE = "2026-02-10";
const PARSED_EXPECTED_DATE = new Date("2026-02-10T00:00:00.000Z");
const NOW = new Date("2026-02-01T10:30:00.000Z");

describe("computeCreateDelivery", () => {
  it("marks the book as in transit", () => {
    const patch = computeCreateDelivery({ orderDate: ORDER_DATE, storeName: "Yakaboo" });

    expect(patch.book).toEqual({ ownershipStatus: "in_transit" });
  });

  it("carries every provided field into the new ordered delivery", () => {
    const fields: CreateDeliveryInput = {
      currency: "UAH",
      deliveryService: "Nova Poshta",
      expectedDeliveryDate: EXPECTED_DATE,
      note: "handle with care",
      orderDate: ORDER_DATE,
      orderNumber: "ORD-1",
      price: 349.5,
      storeName: "Yakaboo",
      trackingNumber: "TTN-1",
      trackingUrl: "https://track.example.com",
    };

    const patch = computeCreateDelivery(fields);

    expect(patch.delivery).toEqual({
      currency: "UAH",
      deliveryService: "Nova Poshta",
      expectedDeliveryDate: PARSED_EXPECTED_DATE,
      note: "handle with care",
      orderDate: PARSED_ORDER_DATE,
      orderNumber: "ORD-1",
      price: 349.5,
      status: "ordered",
      storeName: "Yakaboo",
      trackingNumber: "TTN-1",
      trackingUrl: "https://track.example.com",
    });
  });

  it("defaults every optional field to null when only the required fields are given", () => {
    const patch = computeCreateDelivery({ orderDate: ORDER_DATE, storeName: "Yakaboo" });

    expect(patch.delivery).toEqual({
      currency: null,
      deliveryService: null,
      expectedDeliveryDate: null,
      note: null,
      orderDate: PARSED_ORDER_DATE,
      orderNumber: null,
      price: null,
      status: "ordered",
      storeName: "Yakaboo",
      trackingNumber: null,
      trackingUrl: null,
    });
  });
});

describe("computeReceiveDelivery", () => {
  it("marks the book as owned and stamps the received timestamp with the injected now", () => {
    const patch = computeReceiveDelivery(NOW);

    expect(patch).toEqual({
      book: { ownershipStatus: "owned" },
      delivery: { receivedAt: NOW, status: "received" },
    });
  });
});

describe("computeCancelDelivery", () => {
  it("keeps the book as want_to_buy and stamps the cancelled timestamp when keepAsWantToBuy is true", () => {
    const patch = computeCancelDelivery({ keepAsWantToBuy: true, now: NOW });

    expect(patch).toEqual({
      book: { ownershipStatus: "want_to_buy" },
      delivery: { cancelledAt: NOW, status: "cancelled" },
    });
  });

  it("returns the book to none when keepAsWantToBuy is false", () => {
    const patch = computeCancelDelivery({ keepAsWantToBuy: false, now: NOW });

    expect(patch.book).toEqual({ ownershipStatus: "none" });
  });
});

describe("computeUpdateDelivery", () => {
  it("leaves the book ownership untouched", () => {
    const patch = computeUpdateDelivery({ storeName: "New Store" });

    expect(patch.book).toBeNull();
  });

  it("maps only the provided fields and leaves omitted ones undefined", () => {
    const fields: UpdateDeliveryInput = { status: "in_transit", storeName: "New Store" };

    const patch = computeUpdateDelivery(fields);

    expect(patch.delivery.storeName).toBe("New Store");
    expect(patch.delivery.status).toBe("in_transit");
    expect(patch.delivery.note).toBeUndefined();
    expect(patch.delivery.currency).toBeUndefined();
    expect(patch.delivery.orderDate).toBeUndefined();
  });

  it("passes an explicit null through to clear a nullable field", () => {
    const patch = computeUpdateDelivery({ note: null, trackingUrl: null });

    expect(patch.delivery.note).toBeNull();
    expect(patch.delivery.trackingUrl).toBeNull();
  });

  it("parses a provided order date and leaves an omitted date undefined", () => {
    const patch = computeUpdateDelivery({ orderDate: ORDER_DATE });

    expect(patch.delivery.orderDate).toEqual(PARSED_ORDER_DATE);
    expect(patch.delivery.expectedDeliveryDate).toBeUndefined();
  });

  it("clears a date with an explicit null", () => {
    const patch = computeUpdateDelivery({ expectedDeliveryDate: null });

    expect(patch.delivery.expectedDeliveryDate).toBeNull();
  });
});
