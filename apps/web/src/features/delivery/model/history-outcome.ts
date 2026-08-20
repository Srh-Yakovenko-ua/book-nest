import type {
  Nullable,
  ReceivedSeriesInsight,
  ReceivedSeriesInsightKind,
  ReceivedUnreadView,
} from "@app/shared";

import type { UiIconName } from "@/components/icons";

import type { DeliveryBookPreviewModel } from "./delivery-book-preview";

import { DELIVERY_BOOK_PREVIEW, toDeliveryBookPreviewModel } from "./delivery-book-preview";

export type DeliverySeriesOutcomeLabels = {
  series_completed: { detail: (count: number) => string; label: (count: number) => string };
  series_gaps_closed: { detail: (count: number) => string; label: (count: number) => string };
  series_topped_up: { detail: (count: number) => string; label: (count: number) => string };
};

export type DeliverySeriesOutcomeRow = {
  detail: string;
  icon: UiIconName;
  id: ReceivedSeriesInsightKind;
  label: string;
};

export type DeliveryUnreadReceivedLabels = {
  booksCount: (count: number) => string;
  inQueue: (count: number) => string;
};

export type DeliveryUnreadReceivedModel = {
  books: DeliveryUnreadReceivedBooks;
  booksCountText: string;
  inQueueText: Nullable<string>;
};

type DeliveryUnreadReceivedBooks =
  | { book: DeliveryBookPreviewModel; kind: "single" }
  | { covers: DeliveryBookPreviewModel[]; kind: "stack" }
  | { kind: "none" };

const SERIES_OUTCOME_ICON = {
  series_completed: "library-big",
  series_gaps_closed: "layers",
  series_topped_up: "book",
} as const satisfies Record<ReceivedSeriesInsightKind, UiIconName>;

export function buildDeliverySeriesOutcomeRows({
  insights,
  labels,
}: {
  insights: readonly ReceivedSeriesInsight[];
  labels: DeliverySeriesOutcomeLabels;
}): DeliverySeriesOutcomeRow[] {
  return insights.map((insight) => ({
    detail: labels[insight.kind].detail(insight.booksCount),
    icon: SERIES_OUTCOME_ICON[insight.kind],
    id: insight.kind,
    label: labels[insight.kind].label(insight.seriesCount),
  }));
}

export function buildDeliveryUnreadReceived({
  labels,
  unreadReceived,
}: {
  labels: DeliveryUnreadReceivedLabels;
  unreadReceived: Nullable<ReceivedUnreadView>;
}): Nullable<DeliveryUnreadReceivedModel> {
  if (unreadReceived === null) return null;

  return {
    books: toUnreadBooks(unreadReceived),
    booksCountText: labels.booksCount(unreadReceived.booksCount),
    inQueueText:
      unreadReceived.inQueueCount === 0 ? null : labels.inQueue(unreadReceived.inQueueCount),
  };
}

function toUnreadBooks(unreadReceived: ReceivedUnreadView): DeliveryUnreadReceivedBooks {
  const books = unreadReceived.bookPreviews.map((preview) => toDeliveryBookPreviewModel(preview));
  const [only] = books;

  if (books.length === 0) return { kind: "none" };
  if (unreadReceived.booksCount === 1 && only !== undefined) {
    return { book: only, kind: "single" };
  }

  return { covers: books.slice(0, DELIVERY_BOOK_PREVIEW.coversMax), kind: "stack" };
}
