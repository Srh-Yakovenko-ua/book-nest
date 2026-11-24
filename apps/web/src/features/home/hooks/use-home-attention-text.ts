"use client";

import type { HomeAttentionGroup, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { assertNever } from "@/lib/assert-never";
import { formatDateShort } from "@/lib/format";

type HomeAttentionText = {
  detail: Nullable<string>;
  title: string;
};

type SeriesOrderGroup = Extract<HomeAttentionGroup, { reason: "series_order_issue" }>;

export function useHomeAttentionText(group: HomeAttentionGroup): HomeAttentionText {
  const t = useTranslations("home.attention");
  const locale = useLocale();
  const items = t(`units.${group.unit}`, { count: group.count });
  const due =
    group.dueDate === null ? null : t("due", { date: formatDateShort(group.dueDate, locale) });

  switch (group.reason) {
    case "delivery_awaiting_dispatch":
      return {
        detail: t("detail.waiting", { count: group.maxWaitingDays }),
        title: t("reason.delivery_awaiting_dispatch", { items }),
      };
    case "delivery_delayed":
      return {
        detail: t("detail.delayed", { count: group.maxDelayDays }),
        title: t("reason.delivery_delayed", { items }),
      };
    case "delivery_pickup_expiring":
      if (group.expiredCount >= group.count) {
        return { detail: null, title: t("reason.delivery_pickup_expired", { items }) };
      }
      return {
        detail: group.expiredCount > 0 ? t("detail.expired", { count: group.expiredCount }) : due,
        title: t("reason.delivery_pickup_expiring", { items }),
      };
    case "delivery_ready_for_pickup":
      return { detail: due, title: t("reason.delivery_ready_for_pickup", { items }) };
    case "delivery_unassigned_books":
      return {
        detail: group.ordersCount > 0 ? t("detail.orders", { count: group.ordersCount }) : null,
        title: t("reason.delivery_unassigned_books", { items }),
      };
    case "goal_at_risk":
      return {
        detail: t(`detail.goalRisk.${group.riskReason}`),
        title: t("reason.goal_at_risk", {
          name: group.goalName ?? group.listName ?? t("goalFallback"),
        }),
      };
    case "loan_overdue":
      return {
        detail:
          group.dueDate === null
            ? null
            : t("overdueSince", { date: formatDateShort(group.dueDate, locale) }),
        title: t(`reason.loan_overdue.${group.direction}`, { items }),
      };
    case "loan_return_soon":
      return { detail: due, title: t(`reason.loan_return_soon.${group.direction}`, { items }) };
    case "queue_deadline":
      return {
        detail: due,
        title:
          group.count === 1 && group.bookTitle !== null
            ? t("reason.queue_deadline_book", { title: group.bookTitle })
            : t("reason.queue_deadline", { items }),
      };
    case "reading_stale":
      return {
        detail: null,
        title:
          group.count === 1 && group.bookTitle !== null
            ? t("reason.reading_stale_book", { title: group.bookTitle })
            : t("reason.reading_stale", { items }),
      };
    case "series_order_issue":
      return { detail: null, title: seriesOrderTitle({ group, items, t }) };
    default:
      return assertNever(group);
  }
}

function seriesOrderTitle({
  group,
  items,
  t,
}: {
  group: SeriesOrderGroup;
  items: string;
  t: ReturnType<typeof useTranslations<"home.attention">>;
}): string {
  const isBroken = group.severity !== "low";
  if (group.seriesTitle === null) {
    return isBroken
      ? t("reason.series_order_issue_broken", { items })
      : t("reason.series_order_issue", { items });
  }
  return isBroken
    ? t("reason.series_order_issue_series_broken", { title: group.seriesTitle })
    : t("reason.series_order_issue_series", { title: group.seriesTitle });
}
