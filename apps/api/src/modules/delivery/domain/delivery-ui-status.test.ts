import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";

import type { ShipmentUiStatusSource } from "./delivery-ui-status.js";

import {
  deliveryDateBounds,
  getDeliveryUiStatus,
  getShipmentUiStatus,
} from "./delivery-ui-status.js";

function makeShipment(overrides: Partial<ShipmentUiStatusSource> = {}): ShipmentUiStatusSource {
  return { expectedDeliveryDate: null, pickupUntil: null, status: "ordered", ...overrides };
}

const TODAY = new Date("2026-07-08T00:00:00.000Z");
const utc = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

describe("getDeliveryUiStatus", () => {
  it("returns no_delivery_date when there is no expected delivery date", () => {
    expect(getDeliveryUiStatus({ expectedDeliveryDate: null, today: TODAY })).toBe(
      "no_delivery_date",
    );
  });

  it("returns delayed when the expected delivery date is before today", () => {
    expect(getDeliveryUiStatus({ expectedDeliveryDate: utc("2026-07-07"), today: TODAY })).toBe(
      "delayed",
    );
  });

  it("returns arriving_soon when the expected delivery date is today", () => {
    expect(getDeliveryUiStatus({ expectedDeliveryDate: utc("2026-07-08"), today: TODAY })).toBe(
      "arriving_soon",
    );
  });

  it("returns arriving_soon when the expected delivery date is exactly seven days away", () => {
    expect(getDeliveryUiStatus({ expectedDeliveryDate: utc("2026-07-15"), today: TODAY })).toBe(
      "arriving_soon",
    );
  });

  it("returns null when the expected delivery date is more than seven days away", () => {
    expect(
      getDeliveryUiStatus({ expectedDeliveryDate: utc("2026-07-16"), today: TODAY }),
    ).toBeNull();
  });
});

describe("deliveryDateBounds", () => {
  it("derives a UTC-midnight today from the given instant", () => {
    const { today } = deliveryDateBounds(new Date("2026-07-08T15:30:00.000Z"));

    expect(today.toISOString()).toBe("2026-07-08T00:00:00.000Z");
  });

  it("sets the soon window seven days after today", () => {
    const { soonEnd, today } = deliveryDateBounds(new Date("2026-07-08T15:30:00.000Z"));

    expect(soonEnd.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    expect(soonEnd.toISOString()).toBe(addDays(today, 7).toISOString());
  });

  it("spans the Monday-to-Sunday week that contains today", () => {
    const { weekEnd, weekStart } = deliveryDateBounds(new Date("2026-07-08T15:30:00.000Z"));

    expect(weekStart.toISOString()).toBe("2026-07-06T00:00:00.000Z");
    expect(weekEnd.toISOString()).toBe("2026-07-12T00:00:00.000Z");
    expect(weekEnd.toISOString()).toBe(addDays(weekStart, 6).toISOString());
  });

  it("keeps today within the week when the instant falls on a Sunday", () => {
    const { today, weekEnd, weekStart } = deliveryDateBounds(new Date("2026-07-12T23:59:59.000Z"));

    expect(weekStart.toISOString()).toBe("2026-07-06T00:00:00.000Z");
    expect(weekEnd.toISOString()).toBe("2026-07-12T00:00:00.000Z");
    expect(today.toISOString()).toBe("2026-07-12T00:00:00.000Z");
  });
});

describe("getShipmentUiStatus", () => {
  it("marks a parcel whose delivery date has passed as delayed", () => {
    const shipment = makeShipment({ expectedDeliveryDate: utc("2026-07-07") });

    expect(getShipmentUiStatus({ shipment, today: TODAY })).toBe("delayed");
  });

  it("marks a parcel due today as arriving soon", () => {
    const shipment = makeShipment({ expectedDeliveryDate: utc("2026-07-08") });

    expect(getShipmentUiStatus({ shipment, today: TODAY })).toBe("arriving_soon");
  });

  it("marks a parcel due in exactly a week as arriving soon", () => {
    const shipment = makeShipment({ expectedDeliveryDate: utc("2026-07-15") });

    expect(getShipmentUiStatus({ shipment, today: TODAY })).toBe("arriving_soon");
  });

  it("gives a parcel due beyond the week no UI status at all", () => {
    const shipment = makeShipment({ expectedDeliveryDate: utc("2026-07-16") });

    expect(getShipmentUiStatus({ shipment, today: TODAY })).toBeNull();
  });

  it("marks a parcel with no delivery date as having no delivery date", () => {
    const shipment = makeShipment({ status: "in_transit" });

    expect(getShipmentUiStatus({ shipment, today: TODAY })).toBe("no_delivery_date");
  });

  it("treats a book that is in no parcel yet as having no delivery date", () => {
    expect(getShipmentUiStatus({ shipment: null, today: TODAY })).toBe("no_delivery_date");
  });

  it("drops the UI status of a received parcel even when its date is long past", () => {
    const shipment = makeShipment({
      expectedDeliveryDate: utc("2026-07-01"),
      status: "received",
    });

    expect(getShipmentUiStatus({ shipment, today: TODAY })).toBeNull();
  });

  it("drops the UI status of a cancelled parcel even when its date is long past", () => {
    const shipment = makeShipment({
      expectedDeliveryDate: utc("2026-07-01"),
      status: "cancelled",
    });

    expect(getShipmentUiStatus({ shipment, today: TODAY })).toBeNull();
  });

  it("falls back to the pickup deadline for a parcel waiting at a pickup point", () => {
    const shipment = makeShipment({
      pickupUntil: utc("2026-07-09"),
      status: "ready_for_pickup",
    });

    expect(getShipmentUiStatus({ shipment, today: TODAY })).toBe("arriving_soon");
  });

  it("marks a parcel whose pickup deadline has passed as delayed", () => {
    const shipment = makeShipment({
      pickupUntil: utc("2026-07-06"),
      status: "ready_for_pickup",
    });

    expect(getShipmentUiStatus({ shipment, today: TODAY })).toBe("delayed");
  });

  it("prefers the pickup deadline over the delivery date when the parcel carries both", () => {
    const shipment = makeShipment({
      expectedDeliveryDate: utc("2026-07-20"),
      pickupUntil: utc("2026-07-09"),
      status: "ready_for_pickup",
    });

    expect(getShipmentUiStatus({ shipment, today: TODAY })).toBe("arriving_soon");
  });

  it("stops calling a waiting parcel delayed once its pickup deadline moves the due date ahead", () => {
    const shipment = makeShipment({
      expectedDeliveryDate: utc("2026-07-01"),
      pickupUntil: utc("2026-07-14"),
      status: "ready_for_pickup",
    });

    expect(getShipmentUiStatus({ shipment, today: TODAY })).toBe("arriving_soon");
  });

  it("keeps counting from the delivery date while a waiting parcel has no pickup deadline, because a UI status only answers when a parcel is due", () => {
    const dueDate = utc("2026-07-09");
    const waiting = makeShipment({ expectedDeliveryDate: dueDate, status: "ready_for_pickup" });
    const travelling = makeShipment({ expectedDeliveryDate: dueDate, status: "in_transit" });

    expect([
      getShipmentUiStatus({ shipment: waiting, today: TODAY }),
      getShipmentUiStatus({ shipment: travelling, today: TODAY }),
    ]).toEqual(["arriving_soon", "arriving_soon"]);
  });
});
