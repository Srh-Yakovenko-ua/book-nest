import type {
  BookOrderItemRowOrderView,
  BookOrderItemRowShipmentView,
  BookOrderItemRowView,
  Currency,
  DeliveryUiStatus,
  Nullable,
} from "@app/shared";

import type { UiIconName } from "@/components/icons";
import type { StatusEntry, StatusTone } from "@/lib/book-status";

import { deliveryStatuses } from "@/lib/book-status";
import { formatDate } from "@/lib/format";
import { isHttpsUrl } from "@/lib/is-https-url";

import { toOrderStatusBadge } from "./statistics-view-model";

const MONEY_PRECISION = 2;

export type DeliveryBadgeKey =
  "arriving_soon" | "delayed" | "in_transit" | "no_delivery_date" | "ordered" | "ready_for_pickup";

export type DeliveryCardLabels = {
  badge: (key: DeliveryBadgeKey) => string;
  orderStatus: (key: BookOrderItemRowOrderView["derivedStatus"]) => string;
  seriesPart: (input: { name: string; part: number }) => string;
};

export type DeliveryOrderBookModel = {
  authorName: string;
  bookHref: string;
  bookId: string;
  coverSrc?: string;
  id: string;
  priceText: Nullable<string>;
  seriesText: Nullable<string>;
  title: string;
};

export type DeliveryOrderCardModel = {
  badge: StatusEntry;
  booksCount: number;
  id: string;
  orderDateText: Nullable<string>;
  orderNumber: Nullable<string>;
  shipments: DeliveryShipmentGroupModel[];
  storeName: string;
  totalText: Nullable<string>;
};

export type DeliveryShipmentGroupModel = {
  badge: StatusEntry;
  books: DeliveryOrderBookModel[];
  expectedDateText: Nullable<string>;
  id: Nullable<string>;
  note: Nullable<string>;
  pickupUntilText: Nullable<string>;
  serviceName: Nullable<string>;
  trackingHref: Nullable<string>;
  trackingNumber: Nullable<string>;
};

type CardOptions = { labels: DeliveryCardLabels; locale: string };

type OrderGroup = {
  items: BookOrderItemRowView[];
  order: BookOrderItemRowOrderView;
  shipments: Map<Nullable<string>, ShipmentGroup>;
};

type ShipmentGroup = {
  first: BookOrderItemRowView;
  id: Nullable<string>;
  items: BookOrderItemRowView[];
};

const UI_BADGE_META: Record<DeliveryUiStatus, { icon: UiIconName; tone: StatusTone }> = {
  arriving_soon: { icon: "clock", tone: "info" },
  delayed: { icon: "alert-triangle", tone: "danger" },
  no_delivery_date: { icon: "circle-slash", tone: "neutral" },
};

export function toDeliveryOrderCards(
  items: BookOrderItemRowView[],
  options: CardOptions,
): DeliveryOrderCardModel[] {
  return groupByOrder(items).map((group) => ({
    badge: toOrderStatusBadge(group.order.derivedStatus, options.labels.orderStatus),
    booksCount: group.items.length,
    id: group.order.id,
    orderDateText:
      group.order.orderDate === null ? null : formatDate(group.order.orderDate, options.locale),
    orderNumber: group.order.orderNumber,
    shipments: dispatchedFirst(group).map((shipment) => toShipmentGroupModel(shipment, options)),
    storeName: group.order.storeName,
    totalText: formatPrice(
      group.order.totalAmount ?? sumItemPrices(group.items),
      group.order.currency,
      options.locale,
    ),
  }));
}

function dispatchedFirst(group: OrderGroup): ShipmentGroup[] {
  const shipments = Array.from(group.shipments.values());
  return [
    ...shipments.filter((shipment) => shipment.id !== null),
    ...shipments.filter((shipment) => shipment.id === null),
  ];
}

function formatPrice(
  price: Nullable<number>,
  currency: Nullable<Currency>,
  locale: string,
): Nullable<string> {
  if (price === null) return null;
  const amount = new Intl.NumberFormat(locale).format(price);
  return currency === null ? amount : `${amount} ${currency}`;
}

function groupByOrder(items: BookOrderItemRowView[]): OrderGroup[] {
  const orders = new Map<string, OrderGroup>();

  for (const item of items) {
    const group = orders.get(item.order.id) ?? {
      items: [],
      order: item.order,
      shipments: new Map<Nullable<string>, ShipmentGroup>(),
    };
    orders.set(item.order.id, group);
    group.items.push(item);

    const shipmentId = item.shipment?.id ?? null;
    const shipment = group.shipments.get(shipmentId);
    if (shipment === undefined) {
      group.shipments.set(shipmentId, { first: item, id: shipmentId, items: [item] });
      continue;
    }
    shipment.items.push(item);
  }

  return Array.from(orders.values());
}

function resolveDeliveryBadge(
  input: {
    shipment: Nullable<BookOrderItemRowShipmentView>;
    uiStatus: Nullable<DeliveryUiStatus>;
  },
  label: (key: DeliveryBadgeKey) => string,
): StatusEntry {
  if (input.uiStatus !== null) {
    const meta = UI_BADGE_META[input.uiStatus];
    return {
      icon: meta.icon,
      label: label(input.uiStatus),
      tone: meta.tone,
      value: input.uiStatus,
    };
  }

  const key = shipmentBadgeKey(input.shipment);
  const base = deliveryStatuses.find((entry) => entry.value === key) ?? deliveryStatuses[0];
  return { ...base, label: label(key) };
}

function shipmentBadgeKey(shipment: Nullable<BookOrderItemRowShipmentView>): DeliveryBadgeKey {
  if (shipment === null) return "ordered";
  if (shipment.status === "in_transit") return "in_transit";
  if (shipment.status === "ready_for_pickup") return "ready_for_pickup";
  return "ordered";
}

function sumItemPrices(items: BookOrderItemRowView[]): Nullable<number> {
  const prices = items.flatMap((item) => (item.price === null ? [] : [item.price]));
  if (prices.length === 0) return null;
  return Number(prices.reduce((total, price) => total + price, 0).toFixed(MONEY_PRECISION));
}

function toBookModel(item: BookOrderItemRowView, options: CardOptions): DeliveryOrderBookModel {
  const { book, order } = item;

  return {
    authorName: book.firstAuthorName,
    bookHref: `/books/${book.id}`,
    bookId: book.id,
    coverSrc: book.cover?.urls.thumb,
    id: item.id,
    priceText: formatPrice(item.price, order.currency, options.locale),
    seriesText:
      book.series === null
        ? null
        : book.series.partNumber === null
          ? book.series.name
          : options.labels.seriesPart({ name: book.series.name, part: book.series.partNumber }),
    title: book.title,
  };
}

function toShipmentGroupModel(
  group: ShipmentGroup,
  options: CardOptions,
): DeliveryShipmentGroupModel {
  const { shipment } = group.first;
  const trackingUrl = shipment?.trackingUrl ?? null;
  const expectedDeliveryDate = shipment?.expectedDeliveryDate ?? null;
  const pickupUntil = shipment?.pickupUntil ?? null;

  return {
    badge: resolveDeliveryBadge(
      { shipment, uiStatus: shipment === null ? null : group.first.uiStatus },
      options.labels.badge,
    ),
    books: group.items.map((item) => toBookModel(item, options)),
    expectedDateText:
      expectedDeliveryDate === null ? null : formatDate(expectedDeliveryDate, options.locale),
    id: group.id,
    note: shipment?.note ?? null,
    pickupUntilText: pickupUntil === null ? null : formatDate(pickupUntil, options.locale),
    serviceName: shipment?.deliveryService?.name ?? null,
    trackingHref: trackingUrl !== null && isHttpsUrl(trackingUrl) ? trackingUrl : null,
    trackingNumber: shipment?.trackingNumber ?? null,
  };
}
