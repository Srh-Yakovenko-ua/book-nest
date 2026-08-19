import type { BookOrderHistorySummaryView, Nullable } from "@app/shared";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { formatNumber } from "@/lib/format";

export type HistorySummaryCardKey = "cancelled" | "completed" | "received" | "seriesToppedUp";

export type HistorySummaryLabels = {
  cancelled: {
    empty: string;
    label: string;
    orders: (count: number) => string;
  };
  completed: {
    empty: string;
    label: string;
    withCancellations: (count: number) => string;
    withoutCancellations: (count: number) => string;
  };
  mobile: (key: HistorySummaryCardKey) => { compact: string; detailed: string };
  received: {
    empty: string;
    label: string;
    orders: (count: number) => string;
    shipments: (count: number) => string;
  };
  seriesToppedUp: {
    allStandalone: (count: number) => string;
    empty: string;
    label: string;
    seriesBooks: (count: number) => string;
    standalone: (count: number) => string;
  };
  units: {
    books: (count: number) => string;
    orders: (count: number) => string;
    series: (count: number) => string;
  };
};

type HistorySummaryCardOptions = {
  labels: HistorySummaryLabels;
  locale: string;
  summary: Nullable<BookOrderHistorySummaryView>;
};

const MICROFACT_SEPARATOR = " · ";

const EMPTY_SUMMARY: BookOrderHistorySummaryView = {
  cancelledBooksCount: 0,
  cancelledOrdersCount: 0,
  completedOrdersCount: 0,
  completedWithCancellationsCount: 0,
  completedWithoutCancellationsCount: 0,
  receivedBooksCount: 0,
  receivedOrdersCount: 0,
  receivedSeriesBooksCount: 0,
  receivedSeriesCount: 0,
  receivedShipmentsCount: 0,
  receivedStandaloneBooksCount: 0,
};

type CardInput = {
  counts: BookOrderHistorySummaryView;
  labels: HistorySummaryLabels;
  locale: string;
};

export function buildHistorySummaryCards({
  labels,
  locale,
  summary,
}: HistorySummaryCardOptions): LibrarySummaryCard[] {
  const counts = summary ?? EMPTY_SUMMARY;

  return [
    toReceivedCard({ counts, labels, locale }),
    toCancelledCard({ counts, labels, locale }),
    toCompletedCard({ counts, labels, locale }),
    toSeriesToppedUpCard({ counts, labels, locale }),
  ];
}

function cancelledMicrofact({ counts, labels }: Omit<CardInput, "locale">): string {
  if (counts.cancelledBooksCount === 0) return labels.cancelled.empty;

  return joinParts(
    counts.cancelledOrdersCount === 0 ? [] : [labels.cancelled.orders(counts.cancelledOrdersCount)],
    labels.cancelled.empty,
  );
}

function completedMicrofact({ counts, labels }: Omit<CardInput, "locale">): string {
  if (counts.completedOrdersCount === 0) return labels.completed.empty;

  return joinParts(
    [
      ...(counts.completedWithoutCancellationsCount === 0
        ? []
        : [labels.completed.withoutCancellations(counts.completedWithoutCancellationsCount)]),
      ...(counts.completedWithCancellationsCount === 0
        ? []
        : [labels.completed.withCancellations(counts.completedWithCancellationsCount)]),
    ],
    labels.completed.empty,
  );
}

function joinParts(parts: readonly string[], fallback: string): string {
  return parts.length === 0 ? fallback : parts.join(MICROFACT_SEPARATOR);
}

function receivedMicrofact({ counts, labels }: Omit<CardInput, "locale">): string {
  if (counts.receivedBooksCount === 0) return labels.received.empty;

  return joinParts(
    [
      ...(counts.receivedOrdersCount === 0
        ? []
        : [labels.received.orders(counts.receivedOrdersCount)]),
      ...(counts.receivedShipmentsCount === 0
        ? []
        : [labels.received.shipments(counts.receivedShipmentsCount)]),
    ],
    labels.received.empty,
  );
}

function seriesToppedUpMicrofact({ counts, labels }: Omit<CardInput, "locale">): string {
  if (counts.receivedBooksCount === 0) return labels.seriesToppedUp.empty;
  if (counts.receivedSeriesCount === 0) {
    return labels.seriesToppedUp.allStandalone(counts.receivedBooksCount);
  }

  return joinParts(
    [
      ...(counts.receivedSeriesBooksCount === 0
        ? []
        : [labels.seriesToppedUp.seriesBooks(counts.receivedSeriesBooksCount)]),
      ...(counts.receivedStandaloneBooksCount === 0
        ? []
        : [labels.seriesToppedUp.standalone(counts.receivedStandaloneBooksCount)]),
    ],
    labels.seriesToppedUp.empty,
  );
}

function toCancelledCard({ counts, labels, locale }: CardInput): LibrarySummaryCard {
  return {
    icon: "x-circle",
    iconTone: "ink",
    label: labels.cancelled.label,
    microfact: cancelledMicrofact({ counts, labels }),
    mobileLabels: labels.mobile("cancelled"),
    unit: labels.units.books(counts.cancelledBooksCount),
    value: formatNumber(counts.cancelledBooksCount, locale),
  };
}

function toCompletedCard({ counts, labels, locale }: CardInput): LibrarySummaryCard {
  return {
    icon: "package-check",
    iconTone: "primary",
    label: labels.completed.label,
    microfact: completedMicrofact({ counts, labels }),
    mobileLabels: labels.mobile("completed"),
    unit: labels.units.orders(counts.completedOrdersCount),
    value: formatNumber(counts.completedOrdersCount, locale),
  };
}

function toReceivedCard({ counts, labels, locale }: CardInput): LibrarySummaryCard {
  return {
    icon: "check-circle",
    iconTone: "success",
    label: labels.received.label,
    microfact: receivedMicrofact({ counts, labels }),
    mobileLabels: labels.mobile("received"),
    unit: labels.units.books(counts.receivedBooksCount),
    value: formatNumber(counts.receivedBooksCount, locale),
  };
}

function toSeriesToppedUpCard({ counts, labels, locale }: CardInput): LibrarySummaryCard {
  return {
    icon: "library-big",
    iconTone: "genre",
    label: labels.seriesToppedUp.label,
    microfact: seriesToppedUpMicrofact({ counts, labels }),
    mobileLabels: labels.mobile("seriesToppedUp"),
    unit: labels.units.series(counts.receivedSeriesCount),
    value: formatNumber(counts.receivedSeriesCount, locale),
  };
}
