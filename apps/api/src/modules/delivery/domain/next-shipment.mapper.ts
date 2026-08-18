import type { NextShipmentBookView, NextShipmentView, Nullable } from "@app/shared";

import { NextShipmentStatusSchema } from "@app/shared";

import type { DeliveryServiceModel, ShipmentModel } from "../../../generated/prisma/models.js";

import { toIsoDate } from "../../../core/iso-date.js";

export type NextShipmentSource = ShipmentModel & {
  deliveryService: Nullable<DeliveryServiceModel>;
  expectedDeliveryDate: Date;
  order: { storeName: string };
};

export function toNextShipmentView({
  bookPreviews,
  booksCount,
  sameDayCount,
  shipment,
}: {
  bookPreviews: NextShipmentBookView[];
  booksCount: number;
  sameDayCount: number;
  shipment: NextShipmentSource;
}): NextShipmentView {
  const serviceName = shipment.deliveryServiceName ?? shipment.deliveryService?.name ?? null;

  return {
    bookPreviews,
    booksCount,
    deliveryService:
      serviceName === null
        ? null
        : {
            id: shipment.deliveryServiceId ?? shipment.deliveryService?.id ?? null,
            name: serviceName,
          },
    expectedDeliveryDate: toIsoDate(shipment.expectedDeliveryDate),
    orderId: shipment.orderId,
    sameDayCount,
    shipmentId: shipment.id,
    status: NextShipmentStatusSchema.parse(shipment.status),
    storeName: shipment.order.storeName,
    trackingNumber: shipment.trackingNumber,
  };
}
