"use client";

import type { WishlistSort } from "@app/shared";

import { useTranslations } from "next-intl";

import { buildMobileSortGroups, MobileSortSheet } from "@/components/ui/mobile-sort-sheet";

import { WISHLIST_SORT_VALUES } from "../model/wishlist-query";

type SortGroupKey = "added" | "author" | "price" | "publisher" | "stores" | "title";

type WishlistSortSheetProps = {
  className?: string;
  label: string;
  onChange: (value: WishlistSort) => void;
  value: WishlistSort;
};

const SORT_GROUP_BY_VALUE: Record<WishlistSort, SortGroupKey> = {
  added_asc: "added",
  added_desc: "added",
  author_asc: "author",
  price_asc: "price",
  price_desc: "price",
  publisher_asc: "publisher",
  stores_desc: "stores",
  title_asc: "title",
};

export function WishlistSortSheet({ className, label, onChange, value }: WishlistSortSheetProps) {
  const t = useTranslations("booksToBuy.sortMobile");

  return (
    <MobileSortSheet
      className={className}
      closeLabel={t("close")}
      description={t("description")}
      groups={buildMobileSortGroups({
        groupKeyByValue: SORT_GROUP_BY_VALUE,
        groupLabel: (key) => t(`groups.${key}`),
        optionLabel: (option) => t(`options.${option}`),
        values: WISHLIST_SORT_VALUES,
      })}
      id="books-to-buy-sort"
      label={label}
      onChange={onChange}
      title={t("title")}
      triggerLabel={t(`trigger.${value}`)}
      value={value}
    />
  );
}
