import type { DeliveryInfoInput } from "@app/shared";

import { describe, expect, it } from "vitest";

import { buildDeliveryInfoData, buildDeliveryInfoUpdateData } from "./book-blocks.js";

type DefinedDeliveryInfo = NonNullable<DeliveryInfoInput>;

describe("buildDeliveryInfoData", () => {
  it("maps the price, currency, service and tracking fields onto the create payload", () => {
    const info: DefinedDeliveryInfo = {
      currency: "UAH",
      deliveryService: "Nova Poshta",
      price: 349.5,
      trackingNumber: "TTN-1",
      trackingUrl: "https://track.example.com",
    };

    expect(buildDeliveryInfoData(info)).toEqual({
      currency: "UAH",
      deliveryService: "Nova Poshta",
      expectedDeliveryDate: null,
      hasShipment: true,
      isFree: false,
      note: null,
      orderDate: null,
      orderNumber: null,
      price: 349.5,
      status: "ordered",
      storeName: null,
      trackingNumber: "TTN-1",
      trackingUrl: "https://track.example.com",
    });
  });

  it("defaults the price, currency, service and tracking fields to null when absent", () => {
    expect(buildDeliveryInfoData({})).toEqual({
      currency: null,
      deliveryService: null,
      expectedDeliveryDate: null,
      hasShipment: true,
      isFree: false,
      note: null,
      orderDate: null,
      orderNumber: null,
      price: null,
      status: "ordered",
      storeName: null,
      trackingNumber: null,
      trackingUrl: null,
    });
  });

  it("marks the order as having no shipment when the book is not shipped yet", () => {
    expect(buildDeliveryInfoData({ isShipped: false }).hasShipment).toBe(false);
  });

  it("carries an explicitly free order through to the create payload", () => {
    expect(buildDeliveryInfoData({ isFree: true }).isFree).toBe(true);
  });
});

describe("buildDeliveryInfoUpdateData", () => {
  it("maps the price, currency, service and tracking fields onto the update payload", () => {
    const info: DefinedDeliveryInfo = {
      currency: "USD",
      deliveryService: "Ukrposhta",
      price: 100,
      trackingNumber: "TN-9",
      trackingUrl: "https://parcel.example.com",
    };

    const data = buildDeliveryInfoUpdateData(info);

    expect(data.currency).toBe("USD");
    expect(data.deliveryService).toBe("Ukrposhta");
    expect(data.price).toBe(100);
    expect(data.trackingNumber).toBe("TN-9");
    expect(data.trackingUrl).toBe("https://parcel.example.com");
  });

  it("leaves the price, currency, service and tracking fields undefined when absent", () => {
    const data = buildDeliveryInfoUpdateData({});

    expect(data.currency).toBeUndefined();
    expect(data.deliveryService).toBeUndefined();
    expect(data.price).toBeUndefined();
    expect(data.trackingNumber).toBeUndefined();
    expect(data.trackingUrl).toBeUndefined();
  });

  it("passes an explicit null through to clear a nullable delivery field", () => {
    const data = buildDeliveryInfoUpdateData({ price: null, trackingUrl: null });

    expect(data.price).toBeNull();
    expect(data.trackingUrl).toBeNull();
  });

  it("leaves the free flag undefined unless the patch names it", () => {
    expect(buildDeliveryInfoUpdateData({}).isFree).toBeUndefined();
    expect(buildDeliveryInfoUpdateData({ isFree: true }).isFree).toBe(true);
  });
});
