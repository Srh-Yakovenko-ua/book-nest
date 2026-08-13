import type { OwnershipStatus } from "@app/shared";

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
const SIBLING_PARCEL = "shipment-b";

function cancelParcel({
  items,
  keepAsWantToBuy = true,
}: {
  items: OrderItemState[];
  keepAsWantToBuy?: boolean;
}): ShipmentCancellationPlan {
  return planShipmentCancellation({
    cancelReason: "Store cancelled the parcel",
    items,
    keepAsWantToBuy,
    now: NOW,
    shipmentId: PARCEL,
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

function patchedItemIds(plan: ShipmentCancellationPlan | ShipmentReceiptPlan): string[] {
  return plan.items.map((item) => item.itemId);
}

function receiveParcel(items: OrderItemState[]): ShipmentReceiptPlan {
  return planShipmentReceipt({ items, receivedAt: RECEIVED_AT, shipmentId: PARCEL });
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
  it("cancels every live book of the parcel", () => {
    const plan = cancelParcel({ items: [makeItem("item-1"), makeItem("item-2")] });

    expect(patchedItemIds(plan)).toEqual(["item-1", "item-2"]);
  });

  it("leaves the books of a sibling parcel untouched", () => {
    const plan = cancelParcel({
      items: [makeItem("item-1"), makeItem("item-3", { shipmentId: SIBLING_PARCEL })],
    });

    expect(patchedItemIds(plan)).toEqual(["item-1"]);
  });

  it("leaves a book that has not been put in any parcel untouched", () => {
    const plan = cancelParcel({
      items: [makeItem("item-1"), makeItem("item-4", { shipmentId: null })],
    });

    expect(patchedItemIds(plan)).toEqual(["item-1"]);
  });

  it("skips a book of the parcel that was already cancelled", () => {
    const plan = cancelParcel({
      items: [makeItem("item-1"), makeItem("item-5", { cancelledAt: EARLIER_CANCELLED_AT })],
    });

    expect(patchedItemIds(plan)).toEqual(["item-1"]);
  });

  it("skips a book of the parcel that had already arrived", () => {
    const plan = cancelParcel({
      items: [makeItem("item-1"), makeItem("item-6", { receivedAt: EARLIER_RECEIVED_AT })],
    });

    expect(patchedItemIds(plan)).toEqual(["item-1"]);
  });

  it("carries the parcel half of the transition with the injected now and the reason", () => {
    const plan = cancelParcel({ items: [makeItem("item-1")] });

    expect(plan.shipment).toEqual({
      cancelledAt: NOW,
      cancelReason: "Store cancelled the parcel",
      status: "cancelled",
    });
  });

  it("stamps the same cancellation on every book it touches", () => {
    const plan = cancelParcel({ items: [makeItem("item-1"), makeItem("item-2")] });

    expect(plan.items.map((item) => item.item)).toEqual([
      { cancelledAt: NOW, cancelReason: "Store cancelled the parcel" },
      { cancelledAt: NOW, cancelReason: "Store cancelled the parcel" },
    ]);
  });

  it("returns every cancelled book to none when the reader does not keep them as wanted", () => {
    const plan = cancelParcel({
      items: [makeItem("item-1"), makeItem("item-2")],
      keepAsWantToBuy: false,
    });

    expect(plan.items.map((item) => item.book)).toEqual([
      { ownershipStatus: "none" },
      { ownershipStatus: "none" },
    ]);
  });
});

describe("planShipmentReceipt", () => {
  it("marks every live book of the parcel as owned and stamps the receipt moment", () => {
    const plan = receiveParcel([makeItem("item-1"), makeItem("item-2")]);

    expect(plan.items).toEqual([
      {
        book: { ownershipStatus: "owned" },
        bookId: "book-of-item-1",
        item: { receivedAt: RECEIVED_AT },
        itemId: "item-1",
      },
      {
        book: { ownershipStatus: "owned" },
        bookId: "book-of-item-2",
        item: { receivedAt: RECEIVED_AT },
        itemId: "item-2",
      },
    ]);
  });

  it("never revives a cancelled book when its parcel arrives", () => {
    const plan = receiveParcel([
      makeItem("item-1"),
      makeItem("item-5", { cancelledAt: EARLIER_CANCELLED_AT }),
    ]);

    expect(patchedItemIds(plan)).toEqual(["item-1"]);
  });

  it("leaves the books of a sibling parcel travelling", () => {
    const plan = receiveParcel([
      makeItem("item-1"),
      makeItem("item-3", { shipmentId: SIBLING_PARCEL }),
    ]);

    expect(patchedItemIds(plan)).toEqual(["item-1"]);
  });

  it("does not stamp a second receipt on a book that had already arrived", () => {
    const plan = receiveParcel([
      makeItem("item-1"),
      makeItem("item-6", { receivedAt: EARLIER_RECEIVED_AT }),
    ]);

    expect(patchedItemIds(plan)).toEqual(["item-1"]);
  });

  it("stamps the parcel with the given receipt moment and the received status", () => {
    const plan = receiveParcel([makeItem("item-1")]);

    expect(plan.shipment).toEqual({ receivedAt: RECEIVED_AT, status: "received" });
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
