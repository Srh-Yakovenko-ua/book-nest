import type { CreateDeliveryInput, UpdateDeliveryInput } from "@app/shared";

import type {
  CreateDeliveryTransition,
  RecordDeliveryTransition,
} from "../infrastructure/book-deliveries.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { toCreateDate, toUpdateDate } from "./book-blocks.js";

const STATUS_ORDERED = "ordered";
const STATUS_RECEIVED = "received";
const STATUS_CANCELLED = "cancelled";

export function computeCancelDelivery(input: {
  keepAsWantToBuy: boolean;
  now: Date;
}): RecordDeliveryTransition {
  return {
    book: { ownershipStatus: input.keepAsWantToBuy ? "want_to_buy" : "none" },
    delivery: { cancelledAt: input.now, status: STATUS_CANCELLED },
  };
}

export function computeCreateDelivery(fields: CreateDeliveryInput): CreateDeliveryTransition {
  return {
    book: { ownershipStatus: "in_transit" },
    delivery: {
      currency: fields.currency ?? null,
      deliveryService: fields.deliveryService ?? null,
      expectedDeliveryDate: toCreateDate(fields.expectedDeliveryDate),
      note: fields.note ?? null,
      orderDate: parseIsoDate(fields.orderDate),
      orderNumber: fields.orderNumber ?? null,
      price: fields.price ?? null,
      status: STATUS_ORDERED,
      storeName: fields.storeName,
      trackingNumber: fields.trackingNumber ?? null,
      trackingUrl: fields.trackingUrl ?? null,
    },
  };
}

export function computeReceiveDelivery(now: Date): RecordDeliveryTransition {
  return {
    book: { ownershipStatus: "owned" },
    delivery: { receivedAt: now, status: STATUS_RECEIVED },
  };
}

export function computeUpdateDelivery(fields: UpdateDeliveryInput): RecordDeliveryTransition {
  return {
    book: {},
    delivery: {
      currency: fields.currency,
      deliveryService: fields.deliveryService,
      expectedDeliveryDate: toUpdateDate(fields.expectedDeliveryDate),
      note: fields.note,
      orderDate: toUpdateDate(fields.orderDate),
      orderNumber: fields.orderNumber,
      price: fields.price,
      status: fields.status,
      storeName: fields.storeName,
      trackingNumber: fields.trackingNumber,
      trackingUrl: fields.trackingUrl,
    },
  };
}
