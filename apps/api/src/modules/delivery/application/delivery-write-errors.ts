import type { Nullable } from "@app/shared";

import { EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE, isExpectedNotBeforeOrder } from "@app/shared";

import type { HttpError } from "../../../core/exceptions/errors.js";
import type {
  OrderEntryRejection,
  OrderItemCancelRejection,
} from "../domain/order-item-transition.js";

import { assertNever } from "../../../core/assert-never.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { toIsoDate, toIsoDateFromIsoString } from "../../../core/iso-date.js";
import { isUniqueConstraintErrorOn } from "../../../core/prisma-errors.js";
import {
  ORDER_ENTRY_REJECTIONS,
  ORDER_ITEM_CANCEL_REJECTIONS,
} from "../domain/order-item-transition.js";

export const ACTIVE_ORDER_ITEM_CONSTRAINT = "book_order_items_active_book_idx";

export type DeliveryDay = Nullable<Date> | Nullable<string> | undefined;

export const DELIVERY_WRITE_MESSAGES = {
  bookAlreadyOrdered: "This book already has an active delivery",
  bookNotFound: "Book not found",
  bookNotOrderable: "A delivery can only be started for a book you do not yet own",
  expectedBeforeOrderDate: EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE,
  itemAlreadyCancelled: "This book was already cancelled",
  itemAlreadyReceived: "This book has already arrived",
  itemNoLongerActive: "This delivery is no longer active",
  itemNotFound: "Order item not found",
  itemsNotMovable: "Every selected book must be an active book of this order",
  orderNotFound: "Order not found",
  sharedOrderNotEditableHere: "This order also covers other books. Edit it from the order screen.",
  sharedShipmentNotEditableHere:
    "This shipment also covers other books. Edit it from the order screen.",
  shipmentNotActive: "This shipment is no longer active",
  shipmentNotFound: "Shipment not found",
} as const;

export function assertExpectedDeliveryNotBeforeOrder({
  expectedDeliveryDate,
  orderDate,
}: {
  expectedDeliveryDate: DeliveryDay;
  orderDate: DeliveryDay;
}): void {
  const matchesRule = isExpectedNotBeforeOrder({
    expectedDeliveryDate: toIsoDay(expectedDeliveryDate),
    orderDate: toIsoDay(orderDate),
  });
  if (!matchesRule) {
    throw new BadRequestError(DELIVERY_WRITE_MESSAGES.expectedBeforeOrderDate);
  }
}

export function assertShipmentsExpectedAfter({
  orderDate,
  shipments,
}: {
  orderDate: DeliveryDay;
  shipments: readonly { expectedDeliveryDate?: DeliveryDay }[];
}): void {
  for (const shipment of shipments) {
    assertExpectedDeliveryNotBeforeOrder({
      expectedDeliveryDate: shipment.expectedDeliveryDate,
      orderDate,
    });
  }
}

export function orderEntryError(reason: OrderEntryRejection): HttpError {
  switch (reason) {
    case ORDER_ENTRY_REJECTIONS.bookAlreadyOrdered:
      return new ConflictError(DELIVERY_WRITE_MESSAGES.bookAlreadyOrdered);
    case ORDER_ENTRY_REJECTIONS.ownershipNotOrderable:
      return new ConflictError(DELIVERY_WRITE_MESSAGES.bookNotOrderable);
    default:
      return assertNever(reason);
  }
}

export function orderItemCancelError(reason: OrderItemCancelRejection): HttpError {
  switch (reason) {
    case ORDER_ITEM_CANCEL_REJECTIONS.alreadyCancelled:
      return new ConflictError(DELIVERY_WRITE_MESSAGES.itemAlreadyCancelled);
    case ORDER_ITEM_CANCEL_REJECTIONS.alreadyReceived:
      return new ConflictError(DELIVERY_WRITE_MESSAGES.itemAlreadyReceived);
    default:
      return assertNever(reason);
  }
}

export function orderNotFoundError(): NotFoundError {
  return new NotFoundError(DELIVERY_WRITE_MESSAGES.orderNotFound);
}

export function sharedOrderError(): ConflictError {
  return new ConflictError(DELIVERY_WRITE_MESSAGES.sharedOrderNotEditableHere);
}

export function sharedShipmentError(): ConflictError {
  return new ConflictError(DELIVERY_WRITE_MESSAGES.sharedShipmentNotEditableHere);
}

export function shipmentNotActiveError(): ConflictError {
  return new ConflictError(DELIVERY_WRITE_MESSAGES.shipmentNotActive);
}

export function toActiveOrderItemConflict(error: unknown): unknown {
  if (isUniqueConstraintErrorOn(error, ACTIVE_ORDER_ITEM_CONSTRAINT)) {
    return orderEntryError(ORDER_ENTRY_REJECTIONS.bookAlreadyOrdered);
  }
  return error;
}

function toIsoDay(value: DeliveryDay): Nullable<string> {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === "string" ? toIsoDateFromIsoString(value) : toIsoDate(value);
}
