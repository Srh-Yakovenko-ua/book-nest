import type { OwnershipStatus, ShipmentStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import type {
  OrderItemState,
  ShipmentCancellationPlan,
  ShipmentReceiptPlan,
} from "./order-item-transition.js";

import {
  evaluateBookOrderEntry,
  planOrderItemCancellation,
  planShipmentCancellation,
  planShipmentReceipt,
} from "./order-item-transition.js";

const NOW = new Date("2026-03-10T08:00:00.000Z");
const RECEIVED_AT = new Date("2026-03-12T15:00:00.000Z");
const EARLIER_CANCELLED_AT = new Date("2026-03-01T08:00:00.000Z");
const EARLIER_RECEIVED_AT = new Date("2026-03-02T08:00:00.000Z");

const PARCEL = "shipment-a";
const TERMINAL_STATUSES: ShipmentStatus[] = ["received", "cancelled"];

function cancelledPlan(
  plan: ShipmentCancellationPlan,
): Extract<ShipmentCancellationPlan, { outcome: "cancelled" }> {
  if (plan.outcome === "rejected") {
    throw new Error(`expected a cancellation plan, got ${plan.reason}`);
  }
  return plan;
}

function cancelParcel({
  keepAsWantToBuy = true,
  status = "in_transit",
}: {
  keepAsWantToBuy?: boolean;
  status?: ShipmentStatus;
} = {}): ShipmentCancellationPlan {
  return planShipmentCancellation({
    cancelReason: "Store cancelled the parcel",
    keepAsWantToBuy,
    now: NOW,
    status,
  });
}

function makeItem(id: string, overrides: Partial<OrderItemState> = {}): OrderItemState {
  return {
    bookId: `book-of-${id}`,
    cancelledAt: null,
    id,
    receivedAt: null,
    shipmentId: PARCEL,
    ...overrides,
  };
}

function receiptPlan(
  plan: ShipmentReceiptPlan,
): Extract<ShipmentReceiptPlan, { outcome: "received" }> {
  if (plan.outcome === "rejected") {
    throw new Error(`expected a receipt plan, got ${plan.reason}`);
  }
  return plan;
}

function receiveParcel(status: ShipmentStatus = "in_transit"): ShipmentReceiptPlan {
  return planShipmentReceipt({ receivedAt: RECEIVED_AT, status });
}

describe("planOrderItemCancellation", () => {
  it("cancels a single book and hands back no parcel patch at all", () => {
    expect(
      planOrderItemCancellation({
        cancelReason: "Out of stock",
        item: makeItem("item-1"),
        keepAsWantToBuy: true,
        now: NOW,
      }),
    ).toEqual({
      cancellation: {
        book: { ownershipStatus: "want_to_buy" },
        bookId: "book-of-item-1",
        item: { cancelledAt: NOW, cancelReason: "Out of stock" },
        itemId: "item-1",
      },
      outcome: "cancelled",
    });
  });

  it("returns the book to none when the reader no longer wants to buy it", () => {
    expect(
      planOrderItemCancellation({
        cancelReason: undefined,
        item: makeItem("item-1"),
        keepAsWantToBuy: false,
        now: NOW,
      }),
    ).toEqual({
      cancellation: {
        book: { ownershipStatus: "none" },
        bookId: "book-of-item-1",
        item: { cancelledAt: NOW, cancelReason: null },
        itemId: "item-1",
      },
      outcome: "cancelled",
    });
  });

  it("refuses to cancel a book that was already cancelled", () => {
    expect(
      planOrderItemCancellation({
        cancelReason: null,
        item: makeItem("item-1", { cancelledAt: EARLIER_CANCELLED_AT }),
        keepAsWantToBuy: true,
        now: NOW,
      }),
    ).toEqual({ outcome: "rejected", reason: "order_item_already_cancelled" });
  });

  it("refuses to cancel a book that has already arrived", () => {
    expect(
      planOrderItemCancellation({
        cancelReason: null,
        item: makeItem("item-1", { receivedAt: EARLIER_RECEIVED_AT }),
        keepAsWantToBuy: true,
        now: NOW,
      }),
    ).toEqual({ outcome: "rejected", reason: "order_item_already_received" });
  });
});

describe("planShipmentCancellation", () => {
  it("carries the parcel half of the transition with the injected now and the reason", () => {
    const plan = cancelledPlan(cancelParcel());

    expect(plan.shipment).toEqual({
      cancelledAt: NOW,
      cancelReason: "Store cancelled the parcel",
      status: "cancelled",
    });
  });

  it("hands the caller one ownership target for every book of the parcel", () => {
    expect(cancelledPlan(cancelParcel()).ownership).toEqual({
      ownershipStatus: "want_to_buy",
    });
    expect(cancelledPlan(cancelParcel({ keepAsWantToBuy: false })).ownership).toEqual({
      ownershipStatus: "none",
    });
  });

  it.each(TERMINAL_STATUSES)("refuses to cancel a parcel that is already %s", (status) => {
    expect(cancelParcel({ status })).toEqual({
      outcome: "rejected",
      reason: "shipment_is_terminal",
    });
  });
});

describe("planShipmentReceipt", () => {
  it("stamps the parcel with the given receipt moment and the received status", () => {
    const plan = receiptPlan(receiveParcel());

    expect(plan.shipment).toEqual({ receivedAt: RECEIVED_AT, status: "received" });
  });

  it("hands the caller one ownership target for every book of the parcel", () => {
    expect(receiptPlan(receiveParcel()).ownership).toEqual({
      ownershipStatus: "owned",
    });
  });

  it.each(TERMINAL_STATUSES)("refuses to receive a parcel that is already %s", (status) => {
    expect(receiveParcel(status)).toEqual({
      outcome: "rejected",
      reason: "shipment_is_terminal",
    });
  });
});

describe("evaluateBookOrderEntry", () => {
  const ORDERABLE: OwnershipStatus[] = ["none", "want_to_buy", "in_transit"];
  const NOT_ORDERABLE: OwnershipStatus[] = ["owned", "borrowed_from_someone", "lent_to_someone"];

  it.each(ORDERABLE)("admits a book whose ownership is %s into a new order", (ownershipStatus) => {
    expect(evaluateBookOrderEntry({ hasActiveOrderItem: false, ownershipStatus })).toEqual({
      outcome: "allowed",
    });
  });

  it.each(NOT_ORDERABLE)("refuses to order a book that is already %s", (ownershipStatus) => {
    expect(evaluateBookOrderEntry({ hasActiveOrderItem: false, ownershipStatus })).toEqual({
      outcome: "rejected",
      reason: "ownership_not_orderable",
    });
  });

  it("refuses a book that already sits in another live order", () => {
    expect(
      evaluateBookOrderEntry({ hasActiveOrderItem: true, ownershipStatus: "want_to_buy" }),
    ).toEqual({ outcome: "rejected", reason: "book_already_in_active_order" });
  });

  it("reports the live order rather than the ownership when both stand in the way", () => {
    expect(evaluateBookOrderEntry({ hasActiveOrderItem: true, ownershipStatus: "owned" })).toEqual({
      outcome: "rejected",
      reason: "book_already_in_active_order",
    });
  });
});
