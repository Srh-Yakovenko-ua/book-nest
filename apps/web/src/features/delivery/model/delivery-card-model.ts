import type {
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

export const DELIVERY_BADGE_KEYS = [
  "delayed",
  "arriving_soon",
  "no_delivery_date",
  "ordered",
  "in_transit",
  "ready_for_pickup",
] as const;

export type DeliveryBadgeKey = (typeof DELIVERY_BADGE_KEYS)[number];

export type DeliveryCardLabels = {
  badge: (key: DeliveryBadgeKey) => string;
  seriesPart: (input: { name: string; part: number }) => string;
};

export type DeliveryCardModel = {
  authorName: string;
  badge: StatusEntry;
  bookHref: string;
  bookId: string;
  coverSrc?: string;
  deliveryId: string;
  deliveryService: Nullable<string>;
  expectedDateText: Nullable<string>;
  id: string;
  orderDateText: Nullable<string>;
  orderNumber: Nullable<string>;
  priceText: Nullable<string>;
  seriesText: Nullable<string>;
  storeName: Nullable<string>;
  title: string;
  trackingHref: Nullable<string>;
  trackingNumber: Nullable<string>;
};

const UI_BADGE_META: Record<DeliveryUiStatus, { icon: UiIconName; tone: StatusTone }> = {
  arriving_soon: { icon: "clock", tone: "info" },
  delayed: { icon: "alert-triangle", tone: "danger" },
  no_delivery_date: { icon: "circle-slash", tone: "neutral" },
};

export function toDeliveryCardModel(
  item: BookOrderItemRowView,
  options: { labels: DeliveryCardLabels; locale: string },
): DeliveryCardModel {
  const { book, order, shipment, uiStatus } = item;
  const trackingUrl = shipment?.trackingUrl ?? null;
  const trackingHref = trackingUrl !== null && isHttpsUrl(trackingUrl) ? trackingUrl : null;
  const expectedDeliveryDate = shipment?.expectedDeliveryDate ?? null;

  return {
    authorName: book.firstAuthorName,
    badge: resolveDeliveryBadge({ shipment, uiStatus }, options.labels.badge),
    bookHref: `/books/${book.id}`,
    bookId: book.id,
    coverSrc: book.cover?.urls.thumb,
    deliveryId: item.id,
    deliveryService: shipment?.deliveryService?.name ?? null,
    expectedDateText:
      expectedDeliveryDate === null ? null : formatDate(expectedDeliveryDate, options.locale),
    id: item.id,
    orderDateText: order.orderDate === null ? null : formatDate(order.orderDate, options.locale),
    orderNumber: order.orderNumber,
    priceText: formatPrice(item.price, order.currency, options.locale),
    seriesText:
      book.series === null
        ? null
        : book.series.partNumber === null
          ? book.series.name
          : options.labels.seriesPart({ name: book.series.name, part: book.series.partNumber }),
    storeName: order.storeName,
    title: book.title,
    trackingHref,
    trackingNumber: shipment?.trackingNumber ?? null,
  };
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
