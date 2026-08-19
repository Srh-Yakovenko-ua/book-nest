import type {
  BookOrderItemRowOrderView,
  BookOrderItemRowShipmentView,
  BookOrderItemRowView,
  BookPreview,
  Nullable,
} from "@app/shared";

import { CurrencySchema, resolveOrderFinancials, ShipmentStatusSchema } from "@app/shared";

import type {
  BookModel,
  BookOrderItemModel,
  BookOrderModel,
  DeliveryServiceModel,
  ShipmentModel,
} from "../../../generated/prisma/models.js";

import { toNullableIsoDate, toNullableIsoDateTime } from "../../../core/iso-date.js";
import { getShipmentUiStatus } from "./delivery-ui-status.js";
import { computeBookOrderDerivedStatus } from "./order-derived-status.js";
import { resolveTrackingUrl } from "./tracking-url.js";

export type BookOrderItemRowSource = BookOrderItemModel & {
  order: RowOrderSource;
  shipment: Nullable<ShipmentModel & { deliveryService: Nullable<DeliveryServiceModel> }>;
};

type RowOrderItemSource = Pick<
  BookOrderItemModel,
  "cancelledAt" | "price" | "receivedAt" | "shipmentId"
> & { book: Pick<BookModel, "deletedAt"> };

type RowOrderSource = BookOrderModel & {
  items: RowOrderItemSource[];
  shipments: Pick<ShipmentModel, "id" | "status">[];
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
    shipment: shipment === null ? null : toRowShipmentView({ items: row.order.items, shipment }),
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

function toRowOrderView(order: RowOrderSource): BookOrderItemRowOrderView {
  const deliveryPrice = order.deliveryPrice === null ? null : order.deliveryPrice.toNumber();
  const discount = order.discount === null ? null : order.discount.toNumber();
  const totalAmount = order.totalAmount === null ? null : order.totalAmount.toNumber();
  const itemPrices = order.items
    .filter((item) => item.book.deletedAt === null)
    .map((item) => (item.price === null ? null : item.price.toNumber()));
  const financials = resolveOrderFinancials({ deliveryPrice, discount, itemPrices, totalAmount });

  return {
    currency: order.currency === null ? null : CurrencySchema.parse(order.currency),
    deliveryPrice,
    derivedStatus: computeBookOrderDerivedStatus({
      items: order.items,
      shipments: order.shipments.map((shipment) => ({
        id: shipment.id,
        status: ShipmentStatusSchema.parse(shipment.status),
      })),
    }),
    discount,
    effectiveTotalAmount: financials.effectiveTotalAmount,
    id: order.id,
    itemsCount: financials.itemsCount,
    orderDate: toNullableIsoDate(order.orderDate),
    orderNumber: order.orderNumber,
    pricedItemsCount: financials.pricedItemsCount,
    storeName: order.storeName,
    totalAmount,
  };
}

function toRowShipmentView({
  items,
  shipment,
}: {
  items: RowOrderItemSource[];
  shipment: ShipmentModel & { deliveryService: Nullable<DeliveryServiceModel> };
}): BookOrderItemRowShipmentView {
  const name = shipment.deliveryServiceName ?? shipment.deliveryService?.name ?? null;

  return {
    activeItemsCount: items.filter(
      (item) =>
        item.shipmentId === shipment.id &&
        item.book.deletedAt === null &&
        item.cancelledAt === null &&
        item.receivedAt === null,
    ).length,
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
