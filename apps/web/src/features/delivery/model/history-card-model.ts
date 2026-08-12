import type { DeliveryListItemView, DeliveryUiStatus, Nullable, ShipmentStatus } from "@app/shared";

import { isActiveShipmentStatus } from "@app/shared";

import type { UiIconName } from "@/components/icons";
import type { StatusEntry, StatusTone } from "@/lib/book-status";

import { deliveryStatuses } from "@/lib/book-status";
import { formatDate } from "@/lib/format";
import { isHttpsUrl } from "@/lib/is-https-url";

import { formatMoney } from "./money-format";

export const DELIVERY_HISTORY_BADGE_KEYS = [
  "delayed",
  "arriving_soon",
  "no_delivery_date",
  "ordered",
  "in_transit",
  "ready_for_pickup",
  "received",
  "cancelled",
] as const;

export type DeliveryHistoryBadgeKey = (typeof DELIVERY_HISTORY_BADGE_KEYS)[number];

export type DeliveryHistoryBook = {
  authorName: string;
  coverSrc?: string;
  href: string;
  seriesText: Nullable<string>;
  title: string;
};

export type DeliveryHistoryCardModel = {
  badge: StatusEntry;
  book: Nullable<DeliveryHistoryBook>;
  bookId: string;
  cancelledDateText: Nullable<string>;
  cancelReason: Nullable<string>;
  deliveryId: string;
  deliveryService: Nullable<string>;
  expectedDateText: Nullable<string>;
  id: string;
  isActive: boolean;
  note: Nullable<string>;
  orderDateText: Nullable<string>;
  orderNumber: Nullable<string>;
  priceText: Nullable<string>;
  receivedDateText: Nullable<string>;
  storeName: Nullable<string>;
  trackingHref: Nullable<string>;
  trackingNumber: Nullable<string>;
};

export type DeliveryHistoryLabels = {
  badge: (key: DeliveryHistoryBadgeKey) => string;
  seriesPart: (input: { name: string; part: number }) => string;
};

const UI_BADGE_META: Record<DeliveryUiStatus, { icon: UiIconName; tone: StatusTone }> = {
  arriving_soon: { icon: "clock", tone: "info" },
  delayed: { icon: "alert-triangle", tone: "danger" },
  no_delivery_date: { icon: "circle-slash", tone: "neutral" },
};

export function toHistoryCardModel(
  item: DeliveryListItemView,
  options: { labels: DeliveryHistoryLabels; locale: string },
): DeliveryHistoryCardModel {
  const { book, delivery, uiStatus } = item;
  const trackingHref =
    delivery.trackingUrl !== null && isHttpsUrl(delivery.trackingUrl) ? delivery.trackingUrl : null;

  return {
    badge: resolveHistoryBadge({ status: delivery.status, uiStatus }, options.labels.badge),
    book: {
      authorName: book.firstAuthorName,
      coverSrc: book.cover?.urls.thumb,
      href: `/books/${book.id}`,
      seriesText:
        book.series === null
          ? null
          : book.series.partNumber === null
            ? book.series.name
            : options.labels.seriesPart({ name: book.series.name, part: book.series.partNumber }),
      title: book.title,
    },
    bookId: book.id,
    cancelledDateText:
      delivery.cancelledAt === null ? null : formatDate(delivery.cancelledAt, options.locale),
    cancelReason: delivery.cancelReason,
    deliveryId: delivery.id,
    deliveryService: delivery.deliveryService,
    expectedDateText:
      delivery.expectedDeliveryDate === null
        ? null
        : formatDate(delivery.expectedDeliveryDate, options.locale),
    id: item.id,
    isActive: isActiveShipmentStatus(delivery.status),
    note: delivery.note,
    orderDateText:
      delivery.orderDate === null ? null : formatDate(delivery.orderDate, options.locale),
    orderNumber: delivery.orderNumber,
    priceText:
      delivery.price === null
        ? null
        : formatMoney({
            amount: delivery.price,
            currency: delivery.currency,
            locale: options.locale,
          }),
    receivedDateText:
      delivery.receivedAt === null ? null : formatDate(delivery.receivedAt, options.locale),
    storeName: delivery.storeName,
    trackingHref,
    trackingNumber: delivery.trackingNumber,
  };
}

function resolveHistoryBadge(
  input: { status: ShipmentStatus; uiStatus: Nullable<DeliveryUiStatus> },
  label: (key: DeliveryHistoryBadgeKey) => string,
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

  const base =
    deliveryStatuses.find((entry) => entry.value === input.status) ?? deliveryStatuses[0];
  return { ...base, label: label(input.status) };
}
