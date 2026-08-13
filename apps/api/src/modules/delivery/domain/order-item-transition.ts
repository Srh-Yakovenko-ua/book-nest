import type { Nullable, OwnershipStatus, ShipmentStatus, ValueOf } from "@app/shared";

import { OwnershipStatusSchema, ShipmentStatusSchema } from "@app/shared";

import type {
  ShipmentCancelPatch,
  ShipmentReceivePatch,
  ShipmentTransitionRejected,
} from "./shipment-transition.js";

import { rejectTerminalShipment } from "./shipment-transition.js";

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

export type OrderItemState = {
  bookId: string;
  cancelledAt: Nullable<Date>;
  id: string;
  receivedAt: Nullable<Date>;
  shipmentId: Nullable<string>;
};

export type ShipmentCancellationPlan =
  | ShipmentTransitionRejected
  | {
      outcome: "cancelled";
      ownership: OrderItemOwnershipPatch;
      shipment: ShipmentCancelPatch;
    };

export type ShipmentReceiptPlan =
  | ShipmentTransitionRejected
  | {
      outcome: "received";
      ownership: OrderItemOwnershipPatch;
      shipment: ShipmentReceivePatch;
    };

export const RECEIVED_BOOK_OWNERSHIP: OrderItemOwnershipPatch = {
  ownershipStatus: OwnershipStatusSchema.enum.owned,
};

const ORDERABLE_OWNERSHIP_STATUS_SET: ReadonlySet<OwnershipStatus> = new Set(
  ORDERABLE_OWNERSHIP_STATUSES,
);

const SHIPMENT_STATUS = ShipmentStatusSchema.enum;

export function cancelledBookOwnership(keepAsWantToBuy: boolean): OrderItemOwnershipPatch {
  return {
    ownershipStatus: keepAsWantToBuy
      ? OwnershipStatusSchema.enum.want_to_buy
      : OwnershipStatusSchema.enum.none,
  };
}

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
  keepAsWantToBuy,
  now,
  status,
}: {
  cancelReason: Nullable<string> | undefined;
  keepAsWantToBuy: boolean;
  now: Date;
  status: ShipmentStatus;
}): ShipmentCancellationPlan {
  const rejection = rejectTerminalShipment(status);
  if (rejection !== null) {
    return rejection;
  }

  return {
    outcome: "cancelled",
    ownership: cancelledBookOwnership(keepAsWantToBuy),
    shipment: {
      cancelledAt: now,
      cancelReason: cancelReason ?? null,
      status: SHIPMENT_STATUS.cancelled,
    },
  };
}

export function planShipmentReceipt({
  receivedAt,
  status,
}: {
  receivedAt: Date;
  status: ShipmentStatus;
}): ShipmentReceiptPlan {
  const rejection = rejectTerminalShipment(status);
  if (rejection !== null) {
    return rejection;
  }

  return {
    outcome: "received",
    ownership: RECEIVED_BOOK_OWNERSHIP,
    shipment: { receivedAt, status: SHIPMENT_STATUS.received },
  };
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
    book: cancelledBookOwnership(keepAsWantToBuy),
    bookId: item.bookId,
    item: { cancelledAt: now, cancelReason: cancelReason ?? null },
    itemId: item.id,
  };
}
