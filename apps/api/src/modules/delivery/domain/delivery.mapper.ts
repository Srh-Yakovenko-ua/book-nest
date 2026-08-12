import {
  CurrencySchema,
  type DeliverySummaryView,
  type DeliveryView,
  isActiveShipmentStatus,
  ShipmentStatusSchema,
} from "@app/shared";

import type { BookDeliveryModel } from "../../../generated/prisma/models.js";

import { toNullableIsoDate, toNullableIsoDateTime } from "../../../core/iso-date.js";

export function toDeliverySummaryView(deliveries: BookDeliveryModel[]): DeliverySummaryView {
  const views = deliveries.map(toDeliveryView);
  const active = views.find((view) => isActiveShipmentStatus(view.status)) ?? null;
  const latest = views[0] ?? null;

  return { active, latest, totalCount: views.length };
}

export function toDeliveryView(delivery: BookDeliveryModel): DeliveryView {
  return {
    cancelledAt: toNullableIsoDateTime(delivery.cancelledAt),
    cancelReason: delivery.cancelReason,
    createdAt: delivery.createdAt.toISOString(),
    currency: delivery.currency === null ? null : CurrencySchema.parse(delivery.currency),
    deliveryService: delivery.deliveryService,
    expectedDeliveryDate: toNullableIsoDate(delivery.expectedDeliveryDate),
    id: delivery.id,
    note: delivery.note,
    orderDate: toNullableIsoDate(delivery.orderDate),
    orderNumber: delivery.orderNumber,
    price: delivery.price === null ? null : delivery.price.toNumber(),
    receivedAt: toNullableIsoDateTime(delivery.receivedAt),
    status: ShipmentStatusSchema.parse(delivery.status),
    storeName: delivery.storeName,
    trackingNumber: delivery.trackingNumber,
    trackingUrl: delivery.trackingUrl,
    updatedAt: delivery.updatedAt.toISOString(),
  };
}
