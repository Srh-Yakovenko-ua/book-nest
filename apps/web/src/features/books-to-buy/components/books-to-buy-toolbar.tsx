"use client";

import type { WishlistSort } from "@app/shared";
import type { ReactNode } from "react";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import type { WishlistFilterOption, WishlistViewMode } from "../model/books-to-buy-derive";
import type { UseWishlistQueryResult } from "../model/use-wishlist-query";
import type { WishlistQueryState } from "../model/wishlist-query";

import { WISHLIST_SORT_DEFAULT, WISHLIST_SORT_VALUES } from "../model/wishlist-query";
import { WishlistAdvancedFilters } from "./wishlist-advanced-filters";
import { WishlistSortSheet } from "./wishlist-sort-sheet";

type BooksToBuyToolbarProps = {
  activeFilterCount: number;
  activeFilters?: ReactNode;
  counterLabel: string;
  onRememberEntity: (id: string, name: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (sort: WishlistSort) => void;
  onViewChange: (view: WishlistViewMode) => void;
  resolveEntityName: (id: string) => string | undefined;
  setState: UseWishlistQueryResult["setState"];
  sort: WishlistSort;
  state: WishlistQueryState;
  storeOptions: WishlistFilterOption[];
  view: WishlistViewMode;
};

export function BooksToBuyToolbar({
  activeFilterCount,
  activeFilters,
  counterLabel,
  onRememberEntity,
  onSearchChange,
  onSortChange,
  onViewChange,
  resolveEntityName,
  setState,
  sort,
  state,
  storeOptions,
  view,
}: BooksToBuyToolbarProps) {
  const t = useTranslations("booksToBuy.toolbar");
  const tCommon = useTranslations("common");
  const tSort = useTranslations("booksToBuy.sort");
  const tView = useTranslations("books.library.view");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <DebouncedSearchInput
            clearLabel={t("searchClear")}
            isCommittable={alwaysCommittable}
            label={t("searchLabel")}
            onClear={() => onSearchChange("")}
            onSearch={onSearchChange}
            placeholder={t("searchPlaceholder")}
            value={state.q}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 max-sm:flex-nowrap max-sm:gap-1.5">
          <WishlistSortSheet
            className="sm:hidden"
            label={t("sortLabel")}
            onChange={onSortChange}
            value={sort}
          />

          <div className="hidden sm:block sm:w-80">
            <Select
              onValueChange={(next) => {
                const match = WISHLIST_SORT_VALUES.find((option) => option === next);
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
                {WISHLIST_SORT_VALUES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tSort(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <WishlistAdvancedFilters
            activeCount={activeFilterCount}
            onRememberEntity={onRememberEntity}
            resolveEntityName={resolveEntityName}
            setState={setState}
            state={state}
            storeOptions={storeOptions}
          />

          <Segmented
            className="ml-auto h-10 shrink-0 items-stretch [&_[data-slot=segmented-item]]:py-0 max-sm:[&_[data-slot=segmented-item]]:px-2.5"
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
      </div>

      {activeFilters}

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {counterLabel}
      </p>
    </div>
  );
}

export function BooksToBuyToolbarSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-10 w-full rounded-md lg:flex-1" />
        <div className="flex items-center gap-2.5 max-sm:gap-1.5">
          <Skeleton className="h-10 min-w-0 flex-1 rounded-md sm:w-80 sm:flex-none" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-md sm:w-28" />
          <Skeleton className="ml-auto h-10 w-20 shrink-0 rounded-full" />
        </div>
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
