import type { HomeAttentionGroup, InTransitAttention } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { ReadyForPickupParcels } from "./attention-delivery.js";

import { buildDeliveryAttention } from "./attention-delivery.js";
import { sortAttentionGroups } from "./attention-order.js";

const NOTHING_READY: ReadyForPickupParcels = { count: 0, nearestPickupUntil: null };

const ITEMS = {
  awaitingDispatch: { count: 1, maxWaitingDays: 5, reason: "awaiting_dispatch" },
  delayed: { count: 3, maxDelayDays: 4, reason: "delayed" },
  pickupExpiring: {
    count: 2,
    expiredCount: 1,
    nearestPickupUntil: "2026-11-26",
    reason: "pickup_expiring",
  },
  unassignedBooks: { count: 4, ordersCount: 2, reason: "unassigned_books", revealOrderId: null },
  withoutExpectedDate: { count: 1, reason: "without_expected_date" },
  withoutTracking: { count: 2, reason: "without_tracking" },
} as const satisfies Record<string, InTransitAttention>;

function deliveryGroupsFor(item: InTransitAttention): HomeAttentionGroup[] {
  return buildDeliveryAttention({ attention: [item], readyForPickup: NOTHING_READY });
}

describe("buildDeliveryAttention", () => {
  it("raises expiring pickups as critical, counted in parcels", () => {
    expect(deliveryGroupsFor(ITEMS.pickupExpiring)).toEqual([
      expect.objectContaining({
        count: 2,
        reason: "delivery_pickup_expiring",
        severity: "critical",
        unit: "parcels",
      }),
    ]);
  });

  it("raises delayed parcels as high, counted in parcels", () => {
    expect(deliveryGroupsFor(ITEMS.delayed)).toEqual([
      expect.objectContaining({
        count: 3,
        reason: "delivery_delayed",
        severity: "high",
        unit: "parcels",
      }),
    ]);
  });

  it("raises orders awaiting dispatch as medium, counted in orders", () => {
    expect(deliveryGroupsFor(ITEMS.awaitingDispatch)).toEqual([
      expect.objectContaining({
        count: 1,
        reason: "delivery_awaiting_dispatch",
        severity: "medium",
        unit: "orders",
      }),
    ]);
  });

  it("raises books without an order as low, counted in books", () => {
    expect(deliveryGroupsFor(ITEMS.unassignedBooks)).toEqual([
      expect.objectContaining({
        count: 4,
        reason: "delivery_unassigned_books",
        severity: "low",
        unit: "books",
      }),
    ]);
  });

  it.each([
    ["parcels without tracking", ITEMS.withoutTracking],
    ["parcels without an expected date", ITEMS.withoutExpectedDate],
  ])("raises nothing for %s", (_label, item) => {
    expect(deliveryGroupsFor(item)).toEqual([]);
  });

  it("raises parcels ready for pickup that are not expiring as high, counted in parcels", () => {
    const groups = buildDeliveryAttention({
      attention: [],
      readyForPickup: { count: 2, nearestPickupUntil: "2026-11-30" },
    });

    expect(groups).toEqual([
      expect.objectContaining({
        count: 2,
        reason: "delivery_ready_for_pickup",
        severity: "high",
        unit: "parcels",
      }),
    ]);
  });

  it("raises nothing when no parcel is ready for pickup", () => {
    expect(buildDeliveryAttention({ attention: [], readyForPickup: NOTHING_READY })).toEqual([]);
  });

  it.each([
    ["expiring pickups", { ...ITEMS.pickupExpiring, count: 0, expiredCount: 0 }],
    ["delayed parcels", { ...ITEMS.delayed, count: 0 }],
    ["orders awaiting dispatch", { ...ITEMS.awaitingDispatch, count: 0 }],
    ["books without an order", { ...ITEMS.unassignedBooks, count: 0, ordersCount: 0 }],
  ])("shows no group for zero %s", (_label, item) => {
    expect(sortAttentionGroups(deliveryGroupsFor(item))).toEqual([]);
  });
});
