"use client";

import { useTranslations } from "next-intl";

import type { DeliveryReadControllerInTransitListSort } from "@/shared/api/generated/model";

import { buildMobileSortGroups, MobileSortSheet } from "@/components/ui/mobile-sort-sheet";

import { DELIVERY_SORT_ORDER } from "../model/in-transit-params";

type DeliverySortSheetProps = {
  className?: string;
  disabledSortHint?: string;
  label: string;
  onChange: (value: DeliveryReadControllerInTransitListSort) => void;
  value: DeliveryReadControllerInTransitListSort;
};

type SortGroupKey =
  "author" | "delivery_date" | "order_date" | "price" | "service" | "status" | "store" | "title";

const SORT_GROUP_BY_VALUE: Record<DeliveryReadControllerInTransitListSort, SortGroupKey> = {
  author: "author",
  closest_delivery: "delivery_date",
  delayed_first: "status",
  newest_orders: "order_date",
  oldest_orders: "order_date",
  price: "price",
  service: "service",
  store: "store",
  title: "title",
};

export function DeliverySortSheet({
  className,
  disabledSortHint,
  label,
  onChange,
  value,
}: DeliverySortSheetProps) {
  const t = useTranslations("delivery.sort.mobile");

  return (
    <MobileSortSheet
      className={className}
      closeLabel={t("close")}
      description={t("description")}
      groups={buildMobileSortGroups({
        disabledHint: (option) => (option === "price" ? disabledSortHint : undefined),
        groupKeyByValue: SORT_GROUP_BY_VALUE,
        groupLabel: (key) => t(`groups.${key}`),
        optionLabel: (option) => t(`options.${option}`),
        values: DELIVERY_SORT_ORDER,
      })}
      id="delivery-sort"
      label={label}
      onChange={onChange}
      title={t("title")}
      triggerLabel={t(`trigger.${value}`)}
      value={value}
    />
  );
}
