"use client";

import { useTranslations } from "next-intl";

import { buildMobileSortGroups, MobileSortSheet } from "@/components/ui/mobile-sort-sheet";

import type { ListSort } from "../model/lists-query";

import { LIST_SORT_OPTIONS } from "../model/lists-query";

type ListsSortSheetProps = {
  className?: string;
  label: string;
  onChange: (value: ListSort) => void;
  value: ListSort;
};

type SortGroupKey = "books_count" | "date" | "title";

const SORT_GROUP_BY_VALUE: Record<ListSort, SortGroupKey> = {
  books_count_asc: "books_count",
  books_count_desc: "books_count",
  created_asc: "date",
  created_desc: "date",
  title_asc: "title",
  title_desc: "title",
  updated_desc: "date",
};

export function ListsSortSheet({ className, label, onChange, value }: ListsSortSheetProps) {
  const t = useTranslations("lists.catalog.sort.mobile");

  return (
    <MobileSortSheet
      className={className}
      closeLabel={t("close")}
      description={t("description")}
      groups={buildMobileSortGroups({
        groupKeyByValue: SORT_GROUP_BY_VALUE,
        groupLabel: (key) => t(`groups.${key}`),
        optionLabel: (option) => t(`options.${option}`),
        values: LIST_SORT_OPTIONS,
      })}
      id="lists-sort"
      label={label}
      onChange={onChange}
      title={t("title")}
      triggerLabel={t(`trigger.${value}`)}
      value={value}
    />
  );
}
