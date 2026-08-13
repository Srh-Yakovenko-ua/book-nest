import type { Nullable, OwnershipStatus, ValueOf } from "@app/shared";

import { OwnershipStatusSchema, ShipmentStatusSchema } from "@app/shared";

import type { ShipmentCancelPatch, ShipmentReceivePatch } from "./shipment-transition.js";

export const ORDERABLE_OWNERSHIP_STATUSES = ["in_transit", "none", "want_to_buy"] as const;

export const ORDER_ENTRY_REJECTIONS = {
  bookAlreadyOrdered: "book_already_in_active_order",
  ownershipNotOrderable: "ownership_not_orderable",
} as const;

export const ORDER_ITEM_CANCEL_REJECTIONS = {
  alreadyCancelled: "order_item_already_cancelled",
  alreadyReceived: "order_item_already_received",
} as const;

export type OrderEntry =
  { outcome: "allowed" } | { outcome: "rejected"; reason: OrderEntryRejection };

export type OrderEntryRejection = ValueOf<typeof ORDER_ENTRY_REJECTIONS>;

export type OrderItemCancellation = {
  book: OrderItemOwnershipPatch;
  bookId: string;
  item: OrderItemCancelPatch;
  itemId: string;
};

export type OrderItemCancellationPlan =
  | { cancellation: OrderItemCancellation; outcome: "cancelled" }
  | { outcome: "rejected"; reason: OrderItemCancelRejection };

export type OrderItemCancelPatch = {
  cancelledAt: Date;
  cancelReason: Nullable<string>;
};

export type OrderItemCancelRejection = ValueOf<typeof ORDER_ITEM_CANCEL_REJECTIONS>;

export type OrderItemOwnershipPatch = {
  ownershipStatus: OwnershipStatus;
};

export type OrderItemReceipt = {
  book: OrderItemOwnershipPatch;
  bookId: string;
  item: OrderItemReceivePatch;
  itemId: string;
};

export type OrderItemReceivePatch = {
  receivedAt: Date;
};

export type OrderItemState = {
  bookId: string;
  cancelledAt: Nullable<Date>;
  id: string;
  receivedAt: Nullable<Date>;
  shipmentId: Nullable<string>;
};

export type ShipmentCancellationPlan = {
  items: OrderItemCancellation[];
  shipment: ShipmentCancelPatch;
};

export type ShipmentReceiptPlan = {
  items: OrderItemReceipt[];
  shipment: ShipmentReceivePatch;
};

const ORDERABLE_OWNERSHIP_STATUS_SET: ReadonlySet<OwnershipStatus> = new Set(
  ORDERABLE_OWNERSHIP_STATUSES,
);

const SHIPMENT_STATUS = ShipmentStatusSchema.enum;

export function evaluateBookOrderEntry({
  hasActiveOrderItem,
  ownershipStatus,
}: {
  hasActiveOrderItem: boolean;
  ownershipStatus: OwnershipStatus;
}): OrderEntry {
  if (hasActiveOrderItem) {
    return { outcome: "rejected", reason: ORDER_ENTRY_REJECTIONS.bookAlreadyOrdered };
  }
  if (!ORDERABLE_OWNERSHIP_STATUS_SET.has(ownershipStatus)) {
    return { outcome: "rejected", reason: ORDER_ENTRY_REJECTIONS.ownershipNotOrderable };
  }

  return { outcome: "allowed" };
}

export function planOrderItemCancellation({
  cancelReason,
  item,
  keepAsWantToBuy,
  now,
}: {
  cancelReason: Nullable<string> | undefined;
  item: OrderItemState;
  keepAsWantToBuy: boolean;
  now: Date;
}): OrderItemCancellationPlan {
  if (item.cancelledAt !== null) {
    return { outcome: "rejected", reason: ORDER_ITEM_CANCEL_REJECTIONS.alreadyCancelled };
  }
  if (item.receivedAt !== null) {
    return { outcome: "rejected", reason: ORDER_ITEM_CANCEL_REJECTIONS.alreadyReceived };
  }

  return {
    cancellation: toCancellation({ cancelReason, item, keepAsWantToBuy, now }),
    outcome: "cancelled",
  };
}

export function planShipmentCancellation({
  cancelReason,
  items,
  keepAsWantToBuy,
  now,
  shipmentId,
}: {
  cancelReason: Nullable<string> | undefined;
  items: readonly OrderItemState[];
  keepAsWantToBuy: boolean;
  now: Date;
  shipmentId: string;
}): ShipmentCancellationPlan {
  return {
    items: items
      .filter((item) => isActiveItemOfShipment({ item, shipmentId }))
      .map((item) => toCancellation({ cancelReason, item, keepAsWantToBuy, now })),
    shipment: {
      cancelledAt: now,
      cancelReason: cancelReason ?? null,
      status: SHIPMENT_STATUS.cancelled,
    },
  };
}

export function planShipmentReceipt({
  items,
  receivedAt,
  shipmentId,
}: {
  items: readonly OrderItemState[];
  receivedAt: Date;
  shipmentId: string;
}): ShipmentReceiptPlan {
  return {
    items: items
      .filter((item) => isActiveItemOfShipment({ item, shipmentId }))
      .map((item) => ({
        book: { ownershipStatus: OwnershipStatusSchema.enum.owned },
        bookId: item.bookId,
        item: { receivedAt },
        itemId: item.id,
      })),
    shipment: { receivedAt, status: SHIPMENT_STATUS.received },
  };
}

function isActiveItemOfShipment({
  item,
  shipmentId,
}: {
  item: OrderItemState;
  shipmentId: string;
}): boolean {
  return item.shipmentId === shipmentId && item.cancelledAt === null && item.receivedAt === null;
}

function toCancellation({
  cancelReason,
  item,
  keepAsWantToBuy,
  now,
}: {
  cancelReason: Nullable<string> | undefined;
  item: OrderItemState;
  keepAsWantToBuy: boolean;
  now: Date;
}): OrderItemCancellation {
  return {
    book: {
      ownershipStatus: keepAsWantToBuy
        ? OwnershipStatusSchema.enum.want_to_buy
        : OwnershipStatusSchema.enum.none,
    },
    bookId: item.bookId,
    item: { cancelledAt: now, cancelReason: cancelReason ?? null },
    itemId: item.id,
  };
}
