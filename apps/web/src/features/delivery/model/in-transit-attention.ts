import type { InTransitAttention, InTransitAttentionReason, Nullable } from "@app/shared";

import { isToday, isTomorrow } from "date-fns";

import type { AttentionItem } from "@/components/attention-block";
import type { UiIconName } from "@/components/icons";

import { formatDayMonth, parseIsoDay } from "@/lib/format";

export type DeliveryAttentionLabels = {
  awaiting_dispatch: {
    detail: (days: number) => string;
    label: (count: number) => string;
  };
  delayed: {
    detail: (days: number) => string;
    label: (count: number) => string;
  };
  pickup_expiring: {
    detail: (count: number) => string;
    detailWithExpired: (count: number, expired: number) => string;
    expired: string;
    expiring: string;
    onDate: (date: string) => string;
    today: string;
    tomorrow: string;
  };
  unassigned_books: {
    detail: (ordersCount: number) => string;
    label: (count: number) => string;
  };
  without_expected_date: {
    label: (count: number) => string;
  };
  without_tracking: {
    label: (count: number) => string;
  };
};

type AttentionText = {
  detail?: string;
  label: string;
};

type PickupExpiringAttention = Extract<InTransitAttention, { reason: "pickup_expiring" }>;

const DELIVERY_ATTENTION_ROW = {
  awaiting_dispatch: { icon: "store", toneClass: "text-warning" },
  delayed: { icon: "alert-triangle", toneClass: "text-destructive" },
  pickup_expiring: { icon: "clock", toneClass: "text-destructive" },
  unassigned_books: { icon: "book-x", toneClass: "text-muted-foreground" },
  without_expected_date: { icon: "circle-slash", toneClass: "text-muted-foreground" },
  without_tracking: { icon: "package", toneClass: "text-warning" },
} as const satisfies Record<InTransitAttentionReason, { icon: UiIconName; toneClass: string }>;

export function buildDeliveryAttentionItems({
  attention,
  labels,
  locale,
}: {
  attention: readonly InTransitAttention[];
  labels: DeliveryAttentionLabels;
  locale: string;
}): AttentionItem<InTransitAttentionReason>[] {
  return attention.map((entry) => {
    const { detail, label } = toAttentionText({ entry, labels, locale });
    const { icon, toneClass } = DELIVERY_ATTENTION_ROW[entry.reason];

    return { detail, icon, id: entry.reason, label, toneClass };
  });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled attention reason: ${JSON.stringify(value)}`);
}

function toAttentionText({
  entry,
  labels,
  locale,
}: {
  entry: InTransitAttention;
  labels: DeliveryAttentionLabels;
  locale: string;
}): AttentionText {
  switch (entry.reason) {
    case "awaiting_dispatch":
      return {
        detail: labels.awaiting_dispatch.detail(entry.maxWaitingDays),
        label: labels.awaiting_dispatch.label(entry.count),
      };
    case "delayed":
      return {
        detail: labels.delayed.detail(entry.maxDelayDays),
        label: labels.delayed.label(entry.count),
      };
    case "pickup_expiring":
      return toPickupExpiringText({ entry, labels, locale });
    case "unassigned_books":
      return {
        detail: labels.unassigned_books.detail(entry.ordersCount),
        label: labels.unassigned_books.label(entry.count),
      };
    case "without_expected_date":
      return { label: labels.without_expected_date.label(entry.count) };
    case "without_tracking":
      return { label: labels.without_tracking.label(entry.count) };
    default:
      return assertNever(entry);
  }
}

function toPickupDeadlineLabel({
  isoDay,
  labels,
  locale,
}: {
  isoDay: Nullable<string>;
  labels: DeliveryAttentionLabels;
  locale: string;
}): string {
  if (isoDay === null) return labels.pickup_expiring.expiring;

  const day = parseIsoDay(isoDay);
  if (isToday(day)) return labels.pickup_expiring.today;
  if (isTomorrow(day)) return labels.pickup_expiring.tomorrow;
  return labels.pickup_expiring.onDate(formatDayMonth(isoDay, locale));
}

function toPickupExpiringText({
  entry,
  labels,
  locale,
}: {
  entry: PickupExpiringAttention;
  labels: DeliveryAttentionLabels;
  locale: string;
}): AttentionText {
  if (entry.expiredCount >= entry.count) {
    return {
      detail: labels.pickup_expiring.detail(entry.count),
      label: labels.pickup_expiring.expired,
    };
  }

  if (entry.expiredCount > 0) {
    return {
      detail: labels.pickup_expiring.detailWithExpired(entry.count, entry.expiredCount),
      label: labels.pickup_expiring.expiring,
    };
  }

  return {
    detail: labels.pickup_expiring.detail(entry.count),
    label: toPickupDeadlineLabel({ isoDay: entry.nearestPickupUntil, labels, locale }),
  };
}
