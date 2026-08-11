"use client";

import type { WishlistSort } from "@app/shared";

import { useTranslations } from "next-intl";

import type { MobileSortGroup } from "@/components/ui/mobile-sort-sheet";

import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";

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

  const groups: MobileSortGroup<WishlistSort>[] = [];

  for (const option of WISHLIST_SORT_VALUES) {
    const key = SORT_GROUP_BY_VALUE[option];
    const entry = { label: t(`options.${option}`), value: option };
    const group = groups.find((candidate) => candidate.key === key);
    if (group === undefined) groups.push({ key, label: t(`groups.${key}`), options: [entry] });
    else group.options.push(entry);
  }

  return (
    <MobileSortSheet
      className={className}
      closeLabel={t("close")}
      groups={groups}
      id="books-to-buy-sort"
      label={label}
      onChange={onChange}
      title={t("title")}
      triggerLabel={t(`trigger.${value}`)}
      value={value}
    />
  );
}
