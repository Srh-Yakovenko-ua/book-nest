import type { BookOrderItemRowView, DeliveryUiStatus, Nullable } from "@app/shared";

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
  cancelledDateText: Nullable<string>;
  cancelReason: Nullable<string>;
  deliveryService: Nullable<string>;
  expectedDateText: Nullable<string>;
  id: string;
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
  item: BookOrderItemRowView,
  options: { labels: DeliveryHistoryLabels; locale: string },
): DeliveryHistoryCardModel {
  const { book, order, shipment } = item;
  const trackingUrl = shipment?.trackingUrl ?? null;
  const trackingHref = trackingUrl !== null && isHttpsUrl(trackingUrl) ? trackingUrl : null;
  const expectedDeliveryDate = shipment?.expectedDeliveryDate ?? null;

  return {
    badge: resolveHistoryBadge(item, options.labels.badge),
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
    cancelledDateText:
      item.cancelledAt === null ? null : formatDate(item.cancelledAt, options.locale),
    cancelReason: item.cancelReason,
    deliveryService: shipment?.deliveryService?.name ?? null,
    expectedDateText:
      expectedDeliveryDate === null ? null : formatDate(expectedDeliveryDate, options.locale),
    id: item.id,
    note: shipment?.note ?? null,
    orderDateText: order.orderDate === null ? null : formatDate(order.orderDate, options.locale),
    orderNumber: order.orderNumber,
    priceText:
      item.price === null
        ? null
        : formatMoney({
            amount: item.price,
            currency: order.currency,
            locale: options.locale,
          }),
    receivedDateText: item.receivedAt === null ? null : formatDate(item.receivedAt, options.locale),
    storeName: order.storeName,
    trackingHref,
    trackingNumber: shipment?.trackingNumber ?? null,
  };
}

function historyBadgeKey(item: BookOrderItemRowView): DeliveryHistoryBadgeKey {
  if (item.cancelledAt !== null) return "cancelled";
  if (item.receivedAt !== null) return "received";
  if (item.uiStatus !== null) return item.uiStatus;
  if (item.shipment === null) return "ordered";
  if (item.shipment.status === "in_transit") return "in_transit";
  if (item.shipment.status === "ready_for_pickup") return "ready_for_pickup";
  return "ordered";
}

function resolveHistoryBadge(
  item: BookOrderItemRowView,
  label: (key: DeliveryHistoryBadgeKey) => string,
): StatusEntry {
  const key = historyBadgeKey(item);

  if (key === "arriving_soon" || key === "delayed" || key === "no_delivery_date") {
    const meta = UI_BADGE_META[key];
    return { icon: meta.icon, label: label(key), tone: meta.tone, value: key };
  }

  const base = deliveryStatuses.find((entry) => entry.value === key) ?? deliveryStatuses[0];
  return { ...base, label: label(key) };
}
