import type { InTransitAttention } from "@app/shared";

import { parseISO } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeliveryAttentionLabels } from "./in-transit-attention";

import { buildDeliveryAttentionItems } from "./in-transit-attention";

const locale = "en-US";

const labels: DeliveryAttentionLabels = {
  awaiting_dispatch: {
    detail: (days) => `awaitingDispatch.detail:${days}`,
    label: (count) => `awaitingDispatch.label:${count}`,
  },
  delayed: {
    detail: (days) => `delayed.detail:${days}`,
    label: (count) => `delayed.label:${count}`,
  },
  pickup_expiring: {
    detail: (count) => `pickup.detail:${count}`,
    detailWithExpired: (count, expired) => `pickup.alsoExpired:${count}/${expired}`,
    expired: "pickup.expired",
    expiring: "pickup.expiring",
    onDate: (date) => `pickup.onDate:${date}`,
    today: "pickup.today",
    tomorrow: "pickup.tomorrow",
  },
  unassigned_books: {
    detail: (ordersCount) => `unassigned.detail:${ordersCount}`,
    label: (count) => `unassigned.label:${count}`,
  },
  without_expected_date: {
    label: (count) => `withoutExpectedDate.label:${count}`,
  },
  without_tracking: {
    label: (count) => `withoutTracking.label:${count}`,
  },
};

function buildItems(attention: InTransitAttention[]) {
  return buildDeliveryAttentionItems({ attention, labels, locale });
}

describe("buildDeliveryAttentionItems", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(parseISO("2026-08-18T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the order the api sends and gives every reason its own icon and tone", () => {
    const items = buildItems([
      { count: 2, expiredCount: 0, nearestPickupUntil: "2026-08-18", reason: "pickup_expiring" },
      { count: 3, maxDelayDays: 4, reason: "delayed" },
      { count: 1, maxWaitingDays: 9, reason: "awaiting_dispatch" },
      { count: 5, reason: "without_tracking" },
      { count: 6, reason: "without_expected_date" },
      { count: 4, ordersCount: 2, reason: "unassigned_books", revealOrderId: null },
    ]);

    expect(items.map((item) => [item.id, item.icon, item.toneClass])).toEqual([
      ["pickup_expiring", "clock", "text-destructive"],
      ["delayed", "alert-triangle", "text-destructive"],
      ["awaiting_dispatch", "store", "text-warning"],
      ["without_tracking", "package", "text-warning"],
      ["without_expected_date", "circle-slash", "text-muted-foreground"],
      ["unassigned_books", "book-x", "text-muted-foreground"],
    ]);
  });

  it("puts the sentence in the label and the helper in the detail", () => {
    const items = buildItems([
      { count: 3, maxDelayDays: 4, reason: "delayed" },
      { count: 1, maxWaitingDays: 9, reason: "awaiting_dispatch" },
      { count: 4, ordersCount: 2, reason: "unassigned_books", revealOrderId: null },
    ]);

    expect(items.map((item) => [item.label, item.detail])).toEqual([
      ["delayed.label:3", "delayed.detail:4"],
      ["awaitingDispatch.label:1", "awaitingDispatch.detail:9"],
      ["unassigned.label:4", "unassigned.detail:2"],
    ]);
  });

  it("leaves the detail out when the count is the whole story", () => {
    const items = buildItems([
      { count: 5, reason: "without_tracking" },
      { count: 6, reason: "without_expected_date" },
    ]);

    expect(items.map((item) => [item.label, item.detail])).toEqual([
      ["withoutTracking.label:5", undefined],
      ["withoutExpectedDate.label:6", undefined],
    ]);
  });

  it("reads the pickup deadline as today, tomorrow or a date", () => {
    const items = buildItems([
      { count: 1, expiredCount: 0, nearestPickupUntil: "2026-08-18", reason: "pickup_expiring" },
    ]);
    const [today] = items;

    expect(today?.label).toBe("pickup.today");
    expect(today?.detail).toBe("pickup.detail:1");

    expect(
      buildItems([
        { count: 2, expiredCount: 0, nearestPickupUntil: "2026-08-19", reason: "pickup_expiring" },
      ])[0]?.label,
    ).toBe("pickup.tomorrow");

    expect(
      buildItems([
        { count: 2, expiredCount: 0, nearestPickupUntil: "2026-08-25", reason: "pickup_expiring" },
      ])[0]?.label,
    ).toBe("pickup.onDate:August 25");
  });

  it("says the pickup window has closed when every parcel is past its deadline", () => {
    const [item] = buildItems([
      { count: 3, expiredCount: 3, nearestPickupUntil: null, reason: "pickup_expiring" },
    ]);

    expect(item?.label).toBe("pickup.expired");
    expect(item?.detail).toBe("pickup.detail:3");
  });

  it("counts the already expired parcels in the detail when only some are past", () => {
    const [item] = buildItems([
      { count: 4, expiredCount: 1, nearestPickupUntil: "2026-08-20", reason: "pickup_expiring" },
    ]);

    expect(item?.label).toBe("pickup.expiring");
    expect(item?.detail).toBe("pickup.alsoExpired:4/1");
  });

  it("falls back to the closing window when no deadline is left to name", () => {
    const [item] = buildItems([
      { count: 2, expiredCount: 0, nearestPickupUntil: null, reason: "pickup_expiring" },
    ]);

    expect(item?.label).toBe("pickup.expiring");
  });
});
