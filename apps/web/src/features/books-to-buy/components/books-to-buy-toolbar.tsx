"use client";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import type {
  WishlistFilterOptions,
  WishlistFilters,
  WishlistSort,
  WishlistViewMode,
} from "../model/books-to-buy-derive";

import { WISHLIST_SORT_DEFAULT, WISHLIST_SORT_OPTIONS } from "../model/books-to-buy-derive";
import { WishlistAdvancedFilters } from "./wishlist-advanced-filters";

type BooksToBuyToolbarProps = {
  counterLabel: string;
  filters: WishlistFilters;
  onFiltersChange: (filters: WishlistFilters) => void;
  onSortChange: (sort: WishlistSort) => void;
  onViewChange: (view: WishlistViewMode) => void;
  options: WishlistFilterOptions;
  sort: WishlistSort;
  view: WishlistViewMode;
};

export function BooksToBuyToolbar({
  counterLabel,
  filters,
  onFiltersChange,
  onSortChange,
  onViewChange,
  options,
  sort,
  view,
}: BooksToBuyToolbarProps) {
  const t = useTranslations("booksToBuy.toolbar");
  const tCommon = useTranslations("common");
  const tSort = useTranslations("booksToBuy.sort");
  const tSortMobile = useTranslations("booksToBuy.sortMobile");
  const tView = useTranslations("books.library.view");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 lg:flex-row lg:items-center lg:gap-3">
        <div className="min-w-0 flex-1">
          <DebouncedSearchInput
            clearLabel={t("searchClear")}
            isCommittable={alwaysCommittable}
            label={t("searchLabel")}
            onClear={() => onFiltersChange({ ...filters, search: "" })}
            onSearch={(value) => onFiltersChange({ ...filters, search: value })}
            placeholder={t("searchPlaceholder")}
            value={filters.search}
          />
        </div>

        <MobileSortSheet
          className="max-w-[9.5rem] sm:hidden"
          closeLabel={tSortMobile("close")}
          groups={[
            {
              key: "sort",
              options: WISHLIST_SORT_OPTIONS.map((value) => ({ label: tSort(value), value })),
            },
          ]}
          id="books-to-buy-sort"
          label={t("sortLabel")}
          onChange={onSortChange}
          title={tSortMobile("title")}
          triggerLabel={tSortMobile(`trigger.${sort}`)}
          value={sort}
        />

        <div className="hidden sm:block sm:w-80">
          <Select
            onValueChange={(next) => {
              const match = WISHLIST_SORT_OPTIONS.find((option) => option === next);
              if (match !== undefined) onSortChange(match);
            }}
            value={sort}
          >
            <SelectTrigger
              aria-label={t("sortLabel")}
              className="w-full data-[size=default]:h-10"
              clearLabel={tCommon("clear")}
              isClearable={sort !== WISHLIST_SORT_DEFAULT}
              onClear={() => onSortChange(WISHLIST_SORT_DEFAULT)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WISHLIST_SORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {tSort(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <WishlistAdvancedFilters filters={filters} onApply={onFiltersChange} options={options} />

        <Segmented
          className="ml-auto h-10 shrink-0 items-stretch sm:ml-0 [&_[data-slot=segmented-item]]:py-0 max-sm:[&_[data-slot=segmented-item]]:px-2.5"
          label={tView("label")}
          onValueChange={(next) => onViewChange(next === "list" ? "list" : "grid")}
          options={[
            {
              icon: <LayoutGrid />,
              label: <span className="max-sm:sr-only">{tView("grid")}</span>,
              value: "grid",
            },
            {
              icon: <List />,
              label: <span className="max-sm:sr-only">{tView("list")}</span>,
              value: "list",
            },
          ]}
          value={view}
        />
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {counterLabel}
      </p>
    </div>
  );
}

export function BooksToBuyToolbarSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-10 w-full rounded-md lg:flex-1" />
        <Skeleton className="h-10 w-full rounded-md lg:w-80" />
        <Skeleton className="h-10 w-20 shrink-0 rounded-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-8 w-24 rounded-full" key={index} />
        ))}
      </div>
    </div>
  );
}

function alwaysCommittable(): boolean {
  return true;
}
