import type { DeliverySummaryView, DeliveryView, Nullable, ShipmentStatus } from "@app/shared";

import { CurrencySchema, isActiveShipmentStatus, ShipmentStatusSchema } from "@app/shared";
import { max } from "date-fns";

import type {
  BookOrderItemModel,
  BookOrderModel,
  DeliveryServiceModel,
  ShipmentModel,
} from "../../../generated/prisma/models.js";

import { toNullableIsoDate, toNullableIsoDateTime } from "../../../core/iso-date.js";
import { resolveTrackingUrl } from "./tracking-url.js";

export const BOOK_DELIVERY_SUMMARY = {
  itemsTake: 2,
} as const;

export const NO_STORE_NAME = "";

export type OrderedBookRow = BookOrderItemModel & {
  order: BookOrderModel;
  shipment: Nullable<ShipmentModel & { deliveryService?: Nullable<DeliveryServiceModel> }>;
};

const STATUS = ShipmentStatusSchema.enum;

export function toActiveBookDeliveryView(items: OrderedBookRow[]): Nullable<DeliveryView> {
  return findActiveView(items.map(toBookDeliveryView));
}

export function toBookDeliverySummaryView({
  items,
  totalCount,
}: {
  items: OrderedBookRow[];
  totalCount: number;
}): DeliverySummaryView {
  const views = items.map(toBookDeliveryView);

  return { active: findActiveView(views), latest: views[0] ?? null, totalCount };
}

export function toBookDeliveryView(item: OrderedBookRow): DeliveryView {
  const { order, shipment } = item;

  return {
    cancelledAt: toNullableIsoDateTime(item.cancelledAt),
    cancelReason: item.cancelReason,
    createdAt: item.createdAt.toISOString(),
    currency: order.currency === null ? null : CurrencySchema.parse(order.currency),
    deliveryService: shipment?.deliveryServiceName ?? null,
    expectedDeliveryDate: toNullableIsoDate(shipment?.expectedDeliveryDate ?? null),
    id: item.id,
    isFree: order.isFree,
    note: order.note,
    orderDate: toNullableIsoDate(order.orderDate),
    orderNumber: order.orderNumber,
    price: item.price === null ? null : item.price.toNumber(),
    receivedAt: toNullableIsoDateTime(item.receivedAt),
    status: toOrderedBookStatus(item),
    storeName: order.storeName === NO_STORE_NAME ? null : order.storeName,
    trackingNumber: shipment?.trackingNumber ?? null,
    trackingUrl: resolveTrackingUrl({
      template: shipment?.deliveryService?.trackingUrlTemplate ?? null,
      trackingNumber: shipment?.trackingNumber ?? null,
      trackingUrl: shipment?.trackingUrl ?? null,
    }),
    updatedAt: toLatestTouch(item).toISOString(),
  };
}

function findActiveView(views: DeliveryView[]): Nullable<DeliveryView> {
  return views.find((view) => isActiveShipmentStatus(view.status)) ?? null;
}

function toLatestTouch({ order, shipment, updatedAt }: OrderedBookRow): Date {
  const touches = shipment === null ? [] : [shipment.updatedAt];
  return max([updatedAt, order.updatedAt, ...touches]);
}

function toOrderedBookStatus(item: OrderedBookRow): ShipmentStatus {
  if (item.cancelledAt !== null) {
    return STATUS.cancelled;
  }
  if (item.receivedAt !== null) {
    return STATUS.received;
  }
  if (item.shipment === null) {
    return STATUS.ordered;
  }

  const shipmentStatus = ShipmentStatusSchema.parse(item.shipment.status);
  return isActiveShipmentStatus(shipmentStatus) ? shipmentStatus : STATUS.ordered;
}
