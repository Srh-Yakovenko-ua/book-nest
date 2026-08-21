"use client";

import { useTranslations } from "next-intl";

import type { BooksControllerListSort } from "@/shared/api/generated/model";

import { buildMobileSortGroups, MobileSortSheet } from "@/components/ui/mobile-sort-sheet";

import type { LibrarySortOption } from "./library-sort-select";

type LibrarySortSheetProps = {
  className?: string;
  label: string;
  onChange: (value: BooksControllerListSort) => void;
  options: LibrarySortOption[];
  value: BooksControllerListSort;
};

type SortGroupKey = "author" | "date" | "favorite_added" | "pages" | "rating" | "title" | "year";

const SORT_GROUP_BY_VALUE: Record<BooksControllerListSort, SortGroupKey> = {
  author_asc: "author",
  author_desc: "author",
  created_asc: "date",
  created_desc: "date",
  favorite_added_asc: "favorite_added",
  favorite_added_desc: "favorite_added",
  pages_asc: "pages",
  pages_desc: "pages",
  rating_asc: "rating",
  rating_desc: "rating",
  title_asc: "title",
  title_desc: "title",
  updated_desc: "date",
  year_asc: "year",
  year_desc: "year",
};

export function LibrarySortSheet({
  className,
  label,
  onChange,
  options,
  value,
}: LibrarySortSheetProps) {
  const t = useTranslations("books.library.sort.mobile");

  return (
    <MobileSortSheet
      className={className}
      closeLabel={t("close")}
      description={t("description")}
      groups={buildMobileSortGroups({
        groupKeyByValue: SORT_GROUP_BY_VALUE,
        groupLabel: (key) => t(`groups.${key}`),
        optionLabel: (option) => t(`options.${option}`),
        values: options.map((option) => option.value),
      })}
      id="library-sort"
      label={label}
      onChange={onChange}
      title={t("title")}
      triggerLabel={t(`trigger.${value}`)}
      value={value}
    />
  );
}
