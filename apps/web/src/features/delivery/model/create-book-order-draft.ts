import type { ActiveShipmentStatus, CreateBookOrderInput, Currency } from "@app/shared";

import { resolveOrderFinancials } from "@app/shared";

export type OrderDraft = {
  currency: "" | Currency;
  deliveryPrice: string;
  discount: string;
  note: string;
  orderDate: string;
  orderNumber: string;
  storeName: string;
  totalAmount: string;
};

export type ShipmentDraft = {
  bookIds: string[];
  deliveryService: string;
  expectedDeliveryDate: string;
  id: string;
  note: string;
  pickupUntil: string;
  status: ActiveShipmentStatus;
  trackingNumber: string;
  trackingUrl: string;
};

export const EMPTY_ORDER: OrderDraft = {
  currency: "UAH",
  deliveryPrice: "",
  discount: "",
  note: "",
  orderDate: "",
  orderNumber: "",
  storeName: "",
  totalAmount: "",
};

export function createEmptyShipment(id = crypto.randomUUID()): ShipmentDraft {
  return {
    bookIds: [],
    deliveryService: "",
    expectedDeliveryDate: "",
    id,
    note: "",
    pickupUntil: "",
    status: "ordered",
    trackingNumber: "",
    trackingUrl: "",
  };
}

export function toCreateBookOrderInput({
  books,
  order,
  shipments,
}: {
  books: { bookId: string; price: string }[];
  order: OrderDraft;
  shipments: ShipmentDraft[];
}): CreateBookOrderInput {
  const financials = resolveOrderFinancials({
    deliveryPrice: optionalNumber(order.deliveryPrice),
    discount: optionalNumber(order.discount),
    itemPrices: books.map(({ price }) => optionalNumber(price)),
    totalAmount: optionalNumber(order.totalAmount),
  });
  return {
    items: books.map(({ bookId, price }) => ({
      bookId,
      ...optionalNumberProperty("price", price),
    })),
    storeName: order.storeName.trim(),
    ...(order.currency === "" ? {} : { currency: order.currency }),
    ...optionalNumberProperty("deliveryPrice", order.deliveryPrice),
    ...optionalNumberProperty("discount", order.discount),
    ...optionalTextProperty("note", order.note),
    ...optionalTextProperty("orderDate", order.orderDate),
    ...optionalTextProperty("orderNumber", order.orderNumber),
    ...(financials.effectiveTotalAmount === null
      ? {}
      : { totalAmount: financials.effectiveTotalAmount }),
    ...(shipments.length === 0
      ? {}
      : {
          shipments: shipments.map((shipment) => ({
            bookIds: shipment.bookIds,
            status: shipment.status,
            ...optionalTextProperty("deliveryService", shipment.deliveryService),
            ...optionalTextProperty("expectedDeliveryDate", shipment.expectedDeliveryDate),
            ...optionalTextProperty("note", shipment.note),
            ...optionalTextProperty("pickupUntil", shipment.pickupUntil),
            ...optionalTextProperty("trackingNumber", shipment.trackingNumber),
            ...optionalTextProperty("trackingUrl", shipment.trackingUrl),
          })),
        }),
  };
}

function optionalNumber(value: string): null | number {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

function optionalNumberProperty<K extends string>(
  key: K,
  value: string,
): Partial<Record<K, number>> {
  const trimmed = value.trim();
  return trimmed === "" ? {} : ({ [key]: Number(trimmed) } as Record<K, number>);
}

function optionalTextProperty<K extends string>(key: K, value: string): Partial<Record<K, string>> {
  const trimmed = value.trim();
  return trimmed === "" ? {} : ({ [key]: trimmed } as Record<K, string>);
}
