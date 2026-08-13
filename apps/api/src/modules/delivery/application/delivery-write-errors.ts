import type { Nullable } from "@app/shared";

import { isBefore } from "date-fns";

import type { HttpError } from "../../../core/exceptions/errors.js";
import type {
  OrderEntryRejection,
  OrderItemCancelRejection,
} from "../domain/order-item-transition.js";

import { assertNever } from "../../../core/assert-never.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { parseIsoDate, startOfUtcDay } from "../../../core/iso-date.js";
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
  expectedBeforeOrderDate: "Expected delivery cannot be before the order date",
  itemAlreadyCancelled: "This book was already cancelled",
  itemAlreadyReceived: "This book has already arrived",
  itemNotFound: "Order item not found",
  itemsNotMovable: "Every selected book must be an active book of this order",
  orderNotFound: "Order not found",
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
  const expected = toUtcDay(expectedDeliveryDate);
  const ordered = toUtcDay(orderDate);
  if (expected === null || ordered === null) {
    return;
  }
  if (isBefore(expected, ordered)) {
    throw new BadRequestError(DELIVERY_WRITE_MESSAGES.expectedBeforeOrderDate);
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

export function shipmentNotActiveError(): ConflictError {
  return new ConflictError(DELIVERY_WRITE_MESSAGES.shipmentNotActive);
}

function toUtcDay(value: DeliveryDay): Nullable<Date> {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === "string" ? parseIsoDate(value) : startOfUtcDay(value);
}
