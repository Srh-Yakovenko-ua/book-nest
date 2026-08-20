"use client";

import { useTranslations } from "next-intl";

import type { DeliveryReadControllerHistoryListSort } from "@/shared/api/generated/model";

import { buildMobileSortGroups, MobileSortSheet } from "@/components/ui/mobile-sort-sheet";

import { comparesHistoryPrices, DELIVERY_HISTORY_SORT_ORDER } from "../model/history-params";

type DeliveryHistorySortSheetProps = {
  className?: string;
  disabledSortHint?: string;
  label: string;
  onChange: (value: DeliveryReadControllerHistoryListSort) => void;
  value: DeliveryReadControllerHistoryListSort;
};

type SortGroupKey = "order_date" | "price" | "store" | "updated";

const SORT_GROUP_BY_VALUE: Record<DeliveryReadControllerHistoryListSort, SortGroupKey> = {
  newest_orders: "order_date",
  oldest_orders: "order_date",
  price_asc: "price",
  price_desc: "price",
  recently_updated: "updated",
  store: "store",
};

export function DeliveryHistorySortSheet({
  className,
  disabledSortHint,
  label,
  onChange,
  value,
}: DeliveryHistorySortSheetProps) {
  const t = useTranslations("delivery.history.sort.mobile");

  return (
    <MobileSortSheet
      className={className}
      closeLabel={t("close")}
      description={t("description")}
      groups={buildMobileSortGroups({
        disabledHint: (option) => (comparesHistoryPrices(option) ? disabledSortHint : undefined),
        groupKeyByValue: SORT_GROUP_BY_VALUE,
        groupLabel: (key) => t(`groups.${key}`),
        optionLabel: (option) => t(`options.${option}`),
        values: DELIVERY_HISTORY_SORT_ORDER,
      })}
      id="delivery-history-sort"
      label={label}
      onChange={onChange}
      title={t("title")}
      triggerLabel={t(`trigger.${value}`)}
      value={value}
    />
  );
}
