import type {
  BookOrderItemRowOrderView,
  BookOrderItemRowShipmentView,
  BookOrderItemRowView,
  BookPreview,
  Nullable,
} from "@app/shared";

import { CurrencySchema, ShipmentStatusSchema } from "@app/shared";

import type {
  BookOrderItemModel,
  BookOrderModel,
  DeliveryServiceModel,
  ShipmentModel,
} from "../../../generated/prisma/models.js";

import { toNullableIsoDate, toNullableIsoDateTime } from "../../../core/iso-date.js";
import { getShipmentUiStatus } from "./delivery-ui-status.js";
import { resolveTrackingUrl } from "./tracking-url.js";

export type BookOrderItemRowSource = BookOrderItemModel & {
  order: BookOrderModel;
  shipment: Nullable<ShipmentModel & { deliveryService: Nullable<DeliveryServiceModel> }>;
};

export function toBookOrderItemRowView({
  book,
  row,
  today,
}: {
  book: BookPreview;
  row: BookOrderItemRowSource;
  today: Date;
}): BookOrderItemRowView {
  const shipment = row.shipment;

  return {
    book,
    cancelledAt: toNullableIsoDateTime(row.cancelledAt),
    cancelReason: row.cancelReason,
    id: row.id,
    order: toRowOrderView(row.order),
    price: row.price === null ? null : row.price.toNumber(),
    receivedAt: toNullableIsoDateTime(row.receivedAt),
    shipment: shipment === null ? null : toRowShipmentView(shipment),
    uiStatus: isSettledItem(row)
      ? null
      : getShipmentUiStatus({
          shipment:
            shipment === null
              ? null
              : {
                  expectedDeliveryDate: shipment.expectedDeliveryDate,
                  pickupUntil: shipment.pickupUntil,
                  status: ShipmentStatusSchema.parse(shipment.status),
                },
          today,
        }),
  };
}

function isSettledItem(row: BookOrderItemRowSource): boolean {
  return row.cancelledAt !== null || row.receivedAt !== null;
}

function toRowOrderView(order: BookOrderModel): BookOrderItemRowOrderView {
  return {
    currency: order.currency === null ? null : CurrencySchema.parse(order.currency),
    id: order.id,
    orderDate: toNullableIsoDate(order.orderDate),
    orderNumber: order.orderNumber,
    storeName: order.storeName,
  };
}

function toRowShipmentView(
  shipment: ShipmentModel & { deliveryService: Nullable<DeliveryServiceModel> },
): BookOrderItemRowShipmentView {
  const name = shipment.deliveryServiceName ?? shipment.deliveryService?.name ?? null;

  return {
    deliveryService:
      name === null
        ? null
        : { id: shipment.deliveryServiceId ?? shipment.deliveryService?.id ?? null, name },
    expectedDeliveryDate: toNullableIsoDate(shipment.expectedDeliveryDate),
    id: shipment.id,
    note: shipment.note,
    pickupUntil: toNullableIsoDate(shipment.pickupUntil),
    status: ShipmentStatusSchema.parse(shipment.status),
    trackingNumber: shipment.trackingNumber,
    trackingUrl: resolveTrackingUrl({
      template: shipment.deliveryService?.trackingUrlTemplate ?? null,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
    }),
  };
}
