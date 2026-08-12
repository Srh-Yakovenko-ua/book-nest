"use client";

import { useTranslations } from "next-intl";

import { buildMobileSortGroups, MobileSortSheet } from "@/components/ui/mobile-sort-sheet";

import type { ListBookSortOption } from "../model/list-book-sort";

import { LIST_BOOK_SORT_OPTIONS } from "../model/list-book-sort";

type ListBookSortSheetProps = {
  className?: string;
  label: string;
  onChange: (value: ListBookSortOption) => void;
  value: ListBookSortOption;
};

type SortGroupKey = "author" | "date" | "pages" | "position" | "rating" | "status" | "title";

const SORT_GROUP_BY_VALUE: Record<ListBookSortOption, SortGroupKey> = {
  added_asc: "date",
  added_desc: "date",
  author_asc: "author",
  author_desc: "author",
  pages_asc: "pages",
  pages_desc: "pages",
  position: "position",
  rating_asc: "rating",
  rating_desc: "rating",
  status_read_first: "status",
  status_unread_first: "status",
  title_asc: "title",
  title_desc: "title",
};

export function ListBookSortSheet({ className, label, onChange, value }: ListBookSortSheetProps) {
  const t = useTranslations("lists.details.toolbar.sort.mobile");

  return (
    <MobileSortSheet
      className={className}
      closeLabel={t("close")}
      description={t("description")}
      groups={buildMobileSortGroups({
        groupKeyByValue: SORT_GROUP_BY_VALUE,
        groupLabel: (key) => t(`groups.${key}`),
        optionLabel: (option) => t(`options.${option}`),
        values: LIST_BOOK_SORT_OPTIONS,
      })}
      id="list-book-sort"
      label={label}
      onChange={onChange}
      title={t("title")}
      triggerLabel={t(`trigger.${value}`)}
      value={value}
    />
  );
}
