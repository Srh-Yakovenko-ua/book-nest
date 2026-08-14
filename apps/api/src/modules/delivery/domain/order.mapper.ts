import type { BookOrderItemView, BookOrderView, Nullable, ShipmentView } from "@app/shared";

import { CurrencySchema, ShipmentStatusSchema } from "@app/shared";

import type {
  BookOrderItemModel,
  BookOrderModel,
  DeliveryServiceModel,
  ShipmentModel,
} from "../../../generated/prisma/models.js";

import { toNullableIsoDate, toNullableIsoDateTime } from "../../../core/iso-date.js";
import { computeBookOrderDerivedStatus } from "./order-derived-status.js";
import { resolveTrackingUrl } from "./tracking-url.js";

export type BookOrderRow = BookOrderModel & {
  items: BookOrderItemModel[];
  shipments: ShipmentRow[];
};

export type ShipmentRow = ShipmentModel & {
  deliveryService: Nullable<DeliveryServiceModel>;
};

export function toBookOrderItemView(item: BookOrderItemModel): BookOrderItemView {
  return {
    bookId: item.bookId,
    cancelledAt: toNullableIsoDateTime(item.cancelledAt),
    cancelReason: item.cancelReason,
    id: item.id,
    orderId: item.orderId,
    price: item.price === null ? null : item.price.toNumber(),
    receivedAt: toNullableIsoDateTime(item.receivedAt),
    shipmentId: item.shipmentId,
  };
}

export function toBookOrderView(order: BookOrderRow): BookOrderView {
  const shipments = order.shipments.map(toShipmentView);

  return {
    createdAt: order.createdAt.toISOString(),
    currency: order.currency === null ? null : CurrencySchema.parse(order.currency),
    deliveryPrice: order.deliveryPrice === null ? null : order.deliveryPrice.toNumber(),
    derivedStatus: computeBookOrderDerivedStatus({ items: order.items, shipments }),
    discount: order.discount === null ? null : order.discount.toNumber(),
    id: order.id,
    items: order.items.map(toBookOrderItemView),
    note: order.note,
    orderDate: toNullableIsoDate(order.orderDate),
    orderNumber: order.orderNumber,
    shipments,
    storeName: order.storeName,
    totalAmount: order.totalAmount === null ? null : order.totalAmount.toNumber(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function toShipmentView(shipment: ShipmentRow): ShipmentView {
  return {
    cancelledAt: toNullableIsoDateTime(shipment.cancelledAt),
    cancelReason: shipment.cancelReason,
    createdAt: shipment.createdAt.toISOString(),
    deliveryService: toShipmentDeliveryServiceView(shipment),
    expectedDeliveryDate: toNullableIsoDate(shipment.expectedDeliveryDate),
    id: shipment.id,
    note: shipment.note,
    orderId: shipment.orderId,
    pickupUntil: toNullableIsoDate(shipment.pickupUntil),
    receivedAt: toNullableIsoDateTime(shipment.receivedAt),
    status: ShipmentStatusSchema.parse(shipment.status),
    trackingNumber: shipment.trackingNumber,
    trackingUrl: resolveTrackingUrl({
      template: shipment.deliveryService?.trackingUrlTemplate ?? null,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
    }),
    updatedAt: shipment.updatedAt.toISOString(),
  };
}

function toShipmentDeliveryServiceView(shipment: ShipmentRow): ShipmentView["deliveryService"] {
  const name = shipment.deliveryServiceName ?? shipment.deliveryService?.name ?? null;
  if (name === null) {
    return null;
  }

  return { id: shipment.deliveryServiceId ?? shipment.deliveryService?.id ?? null, name };
}
