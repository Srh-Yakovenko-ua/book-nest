import type { InTransitSummaryView, NextShipmentView, Nullable } from "@app/shared";

import { differenceInCalendarDays, startOfDay } from "date-fns";

import { formatDate, parseIsoDay } from "@/lib/format";

import type { DeliveryBookPreviewModel } from "./delivery-book-preview";

import { DELIVERY_BOOK_PREVIEW, toDeliveryBookPreviewModel } from "./delivery-book-preview";

export type DeliveryNextShipmentCardModel = {
  books: DeliveryNextShipmentBooks;
  expectedDateText: string;
  orderId: string;
  relativeDayText: string;
  sameDayText: Nullable<string>;
  serviceName: Nullable<string>;
  shipmentId: string;
  storeName: string;
  trackingText: Nullable<string>;
};

export type DeliveryNextShipmentLabels = {
  booksCount: (count: number) => string;
  inDays: (count: number) => string;
  sameDay: (count: number) => string;
  today: string;
  tomorrow: string;
};

type DeliveryNextShipmentBooks =
  | { book: DeliveryBookPreviewModel; kind: "single" }
  | { countText: string; covers: DeliveryBookPreviewModel[]; kind: "stack" };

export const NEXT_SHIPMENT_CARD = {
  trackingTailLength: 4,
  truncateTrackingFrom: 8,
} as const;

export function buildDeliveryNextShipmentCard({
  labels,
  locale,
  now,
  summary,
}: {
  labels: DeliveryNextShipmentLabels;
  locale: string;
  now: Date;
  summary: Nullable<InTransitSummaryView>;
}): Nullable<DeliveryNextShipmentCardModel> {
  const shipment = summary?.nextShipment ?? null;
  if (shipment === null) return null;

  return {
    books: toBooks(shipment, labels),
    expectedDateText: formatDate(shipment.expectedDeliveryDate, locale),
    orderId: shipment.orderId,
    relativeDayText: toRelativeDayText({ isoDay: shipment.expectedDeliveryDate, labels, now }),
    sameDayText: shipment.sameDayCount === 0 ? null : labels.sameDay(shipment.sameDayCount),
    serviceName: shipment.deliveryService?.name ?? null,
    shipmentId: shipment.shipmentId,
    storeName: shipment.storeName,
    trackingText: toTrackingText(shipment.trackingNumber),
  };
}

function toBooks(
  shipment: NextShipmentView,
  labels: DeliveryNextShipmentLabels,
): DeliveryNextShipmentBooks {
  const books = shipment.bookPreviews.map((preview) => toDeliveryBookPreviewModel(preview));
  const [only] = books;

  if (shipment.booksCount === 1 && only !== undefined) {
    return { book: only, kind: "single" };
  }

  return {
    countText: labels.booksCount(shipment.booksCount),
    covers: books.slice(0, DELIVERY_BOOK_PREVIEW.coversMax),
    kind: "stack",
  };
}

function toRelativeDayText({
  isoDay,
  labels,
  now,
}: {
  isoDay: string;
  labels: DeliveryNextShipmentLabels;
  now: Date;
}): string {
  const days = differenceInCalendarDays(parseIsoDay(isoDay), startOfDay(now));

  if (days <= 0) return labels.today;
  if (days === 1) return labels.tomorrow;
  return labels.inDays(days);
}

function toTrackingText(trackingNumber: Nullable<string>): Nullable<string> {
  if (trackingNumber === null) return null;

  const trimmed = trackingNumber.trim();
  if (trimmed === "") return null;
  if (trimmed.length <= NEXT_SHIPMENT_CARD.truncateTrackingFrom) return trimmed;

  return `…${trimmed.slice(-NEXT_SHIPMENT_CARD.trackingTailLength)}`;
}
