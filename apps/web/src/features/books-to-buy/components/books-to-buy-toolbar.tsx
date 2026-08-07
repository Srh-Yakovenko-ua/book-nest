"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { ChipGroup } from "@/components/ui/chip-group";
import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import type {
  WishlistFilterOption,
  WishlistFilterOptions,
  WishlistFilters,
  WishlistLinkFilter,
  WishlistSort,
} from "../model/books-to-buy-derive";

import {
  WISHLIST_LINK_FILTERS,
  WISHLIST_SORT_DEFAULT,
  WISHLIST_SORT_OPTIONS,
} from "../model/books-to-buy-derive";

const ANY_VALUE = "__any__";

type BooksToBuyToolbarProps = {
  filters: WishlistFilters;
  linkFilterCounts: Record<WishlistLinkFilter, number>;
  onFiltersChange: (filters: WishlistFilters) => void;
  onSortChange: (sort: WishlistSort) => void;
  options: WishlistFilterOptions;
  sort: WishlistSort;
};

export function BooksToBuyToolbar({
  filters,
  linkFilterCounts,
  onFiltersChange,
  onSortChange,
  options,
  sort,
}: BooksToBuyToolbarProps) {
  const t = useTranslations("booksToBuy.toolbar");
  const tCommon = useTranslations("common");
  const tLink = useTranslations("booksToBuy.linkFilter");
  const tSort = useTranslations("booksToBuy.sort");
  const tSortMobile = useTranslations("booksToBuy.sortMobile");

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

        <div className="hidden sm:block sm:w-60">
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
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
          <ChipGroup
            className="flex-nowrap"
            label={t("linkFilterLabel")}
            mode="single"
            onValueChange={(next) => {
              const match = WISHLIST_LINK_FILTERS.find((option) => option === next);
              if (match !== undefined) onFiltersChange({ ...filters, link: match });
            }}
            options={WISHLIST_LINK_FILTERS.map((option) => ({
              count: linkFilterCounts[option],
              label: tLink(option),
              value: option,
            }))}
            size="sm"
            value={filters.link}
          />
        </div>

        <div className="-mx-1 -my-1 no-scrollbar flex items-center gap-1.5 overflow-x-auto px-1 py-1 sm:mx-0 sm:my-0 sm:flex-wrap sm:gap-2.5 sm:overflow-visible sm:px-0 sm:py-0">
          <ValueFilterSelect
            anyLabel={t("storeAny")}
            label={t("storeLabel")}
            onChange={(storeName) => onFiltersChange({ ...filters, storeName })}
            options={options.stores}
            shortLabel={t("storeShort")}
            value={filters.storeName}
          />
          <ValueFilterSelect
            anyLabel={t("publisherAny")}
            label={t("publisherLabel")}
            onChange={(publisherId) => onFiltersChange({ ...filters, publisherId })}
            options={options.publishers}
            shortLabel={t("publisherShort")}
            value={filters.publisherId}
          />
          <ValueFilterSelect
            anyLabel={t("genreAny")}
            label={t("genreLabel")}
            onChange={(genreKey) => onFiltersChange({ ...filters, genreKey })}
            options={options.genres}
            shortLabel={t("genreShort")}
            value={filters.genreKey}
          />
          <ValueFilterSelect
            anyLabel={t("tagAny")}
            label={t("tagLabel")}
            onChange={(tagId) => onFiltersChange({ ...filters, tagId })}
            options={options.tags}
            shortLabel={t("tagShort")}
            value={filters.tagId}
          />
        </div>
      </div>
    </div>
  );
}

export function BooksToBuyToolbarSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-10 w-full rounded-md lg:flex-1" />
        <Skeleton className="h-10 w-full rounded-md lg:w-60" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: WISHLIST_LINK_FILTERS.length }, (_, index) => (
          <Skeleton className="h-8 w-24 rounded-full" key={index} />
        ))}
      </div>
    </div>
  );
}

function alwaysCommittable(): boolean {
  return true;
}

function ValueFilterSelect({
  anyLabel,
  label,
  onChange,
  options,
  shortLabel,
  value,
}: {
  anyLabel: string;
  label: string;
  onChange: (value: Nullable<string>) => void;
  options: WishlistFilterOption[];
  shortLabel: string;
  value: Nullable<string>;
}) {
  if (options.length === 0) return null;

  const selected = options.find((option) => option.value === value);

  return (
    <div className="w-[9.5rem] shrink-0 sm:w-52">
      <Select
        onValueChange={(next) => onChange(next === ANY_VALUE ? null : next)}
        value={value ?? ANY_VALUE}
      >
        <SelectTrigger aria-label={label} className="w-full data-[size=default]:h-10">
          <SelectValue>
            {selected === undefined ? (
              <>
                <span className="sm:hidden">{shortLabel}</span>
                <span className="max-sm:hidden">{anyLabel}</span>
              </>
            ) : (
              selected.label
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_VALUE}>{anyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
