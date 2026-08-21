"use client";

import type { InTransitAttention, InTransitAttentionReason, Nullable } from "@app/shared";

import { IN_TRANSIT_ATTENTION_THRESHOLDS } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { AttentionBlock } from "@/components/attention-block";

import type { DeliveryAttentionLabels } from "../model/in-transit-attention";

import { buildDeliveryAttentionItems } from "../model/in-transit-attention";

type DeliveryAttentionBlockProps = {
  activeReason: Nullable<InTransitAttentionReason>;
  attention: readonly InTransitAttention[];
  isLoading: boolean;
  onSelect: (reason: InTransitAttentionReason) => void;
};

const DELIVERY_ATTENTION_BLOCK = {
  collapsedRows: 4,
} as const;

export function DeliveryAttentionBlock({
  activeReason,
  attention,
  isLoading,
  onSelect,
}: DeliveryAttentionBlockProps) {
  const t = useTranslations("delivery.attention");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);

  const labels: DeliveryAttentionLabels = {
    awaiting_dispatch: {
      detail: (days) => t("awaiting_dispatch.detail", { days }),
      label: (count) =>
        t("awaiting_dispatch.label", {
          count,
          days: IN_TRANSIT_ATTENTION_THRESHOLDS.awaitingDispatchDays,
        }),
    },
    delayed: {
      detail: (days) => t("delayed.detail", { days }),
      label: (count) => t("delayed.label", { count }),
    },
    pickup_expiring: {
      detail: (count) => t("pickup_expiring.detail", { count }),
      detailWithExpired: (count, expired) => t("pickup_expiring.alsoExpired", { count, expired }),
      expired: t("pickup_expiring.expired"),
      expiring: t("pickup_expiring.expiring"),
      onDate: (date) => t("pickup_expiring.onDate", { date }),
      today: t("pickup_expiring.today"),
      tomorrow: t("pickup_expiring.tomorrow"),
    },
    unassigned_books: {
      detail: (ordersCount) => t("unassigned_books.detail", { count: ordersCount }),
      label: (count) => t("unassigned_books.label", { count }),
    },
    without_expected_date: {
      label: (count) => t("without_expected_date.label", { count }),
    },
    without_tracking: {
      label: (count) => t("without_tracking.label", { count }),
    },
  };

  const items = buildDeliveryAttentionItems({ attention, labels, locale });
  const visibleItems = expanded ? items : items.slice(0, DELIVERY_ATTENTION_BLOCK.collapsedRows);

  return (
    <AttentionBlock
      activeId={activeReason}
      allClearLabel={t("allClear.text")}
      allClearTitle={t("allClear.title")}
      isLoading={isLoading}
      items={visibleItems}
      onSelect={onSelect}
      title={t("title")}
      viewAll={
        items.length === visibleItems.length
          ? undefined
          : {
              active: false,
              label: t("viewAll", { count: items.length }),
              onSelect: () => setExpanded(true),
            }
      }
    />
  );
}
