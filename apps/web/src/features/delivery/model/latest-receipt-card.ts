import type { BookOrderHistorySummaryView, DeliveryBookPreview, Nullable } from "@app/shared";

import { differenceInCalendarDays, startOfDay } from "date-fns";

import { formatDate, parseIsoDay } from "@/lib/format";

import type { DeliveryBookPreviewModel } from "./delivery-book-preview";

import { DELIVERY_BOOK_PREVIEW, toDeliveryBookPreviewModel } from "./delivery-book-preview";

export type DeliveryLatestReceiptCardModel = {
  books: DeliveryReceiptBooks;
  orderId: string;
  receivedDateText: string;
  relativeDayText: string;
  sameDayText: Nullable<string>;
  serviceName: Nullable<string>;
  shipmentId: Nullable<string>;
  storeName: string;
};

export type DeliveryLatestReceiptLabels = {
  booksCount: (count: number) => string;
  daysAgo: (count: number) => string;
  sameDay: (count: number) => string;
  today: string;
  yesterday: string;
};

type DeliveryReceiptBooks =
  | { book: DeliveryBookPreviewModel; kind: "single" }
  | { countText: string; covers: DeliveryBookPreviewModel[]; kind: "stack" };

export function buildDeliveryLatestReceiptCard({
  labels,
  locale,
  now,
  summary,
}: {
  labels: DeliveryLatestReceiptLabels;
  locale: string;
  now: Date;
  summary: Nullable<BookOrderHistorySummaryView>;
}): Nullable<DeliveryLatestReceiptCardModel> {
  const receipt = summary?.latestReceipt ?? null;
  if (receipt === null) return null;

  return {
    books: toBooks({ booksCount: receipt.booksCount, labels, previews: receipt.bookPreviews }),
    orderId: receipt.orderId,
    receivedDateText: formatDate(receipt.receivedAt, locale),
    relativeDayText: toRelativeDayText({ iso: receipt.receivedAt, labels, now }),
    sameDayText: receipt.sameDayCount === 0 ? null : labels.sameDay(receipt.sameDayCount),
    serviceName: receipt.deliveryService?.name ?? null,
    shipmentId: receipt.shipmentId,
    storeName: receipt.storeName,
  };
}

function toBooks({
  booksCount,
  labels,
  previews,
}: {
  booksCount: number;
  labels: DeliveryLatestReceiptLabels;
  previews: readonly DeliveryBookPreview[];
}): DeliveryReceiptBooks {
  const books = previews.map((preview) => toDeliveryBookPreviewModel(preview));
  const [only] = books;

  if (booksCount === 1 && only !== undefined) {
    return { book: only, kind: "single" };
  }

  return {
    countText: labels.booksCount(booksCount),
    covers: books.slice(0, DELIVERY_BOOK_PREVIEW.coversMax),
    kind: "stack",
  };
}

function toRelativeDayText({
  iso,
  labels,
  now,
}: {
  iso: string;
  labels: DeliveryLatestReceiptLabels;
  now: Date;
}): string {
  const days = differenceInCalendarDays(startOfDay(now), startOfDay(parseIsoDay(iso)));

  if (days <= 0) return labels.today;
  if (days === 1) return labels.yesterday;
  return labels.daysAgo(days);
}
