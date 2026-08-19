"use client";

import { useTranslations } from "next-intl";

import type {
  DeliveryReadControllerInTransitListFilter,
  DeliveryReadControllerInTransitListSort,
} from "@/shared/api/generated/model";

import { ChipGroup } from "@/components/ui/chip-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ActiveFilterChip,
  LibraryActiveFilters,
} from "@/features/books/components/library-active-filters";

import type { DeliveryAdvancedState, DeliveryFilterCounts } from "../model/in-transit-params";

import {
  DELIVERY_FILTER_DEFAULT,
  DELIVERY_PRIMARY_FILTERS,
  DELIVERY_SORT_DEFAULT,
  DELIVERY_SORT_ORDER,
  isDeliveryPrimaryFilter,
  toDeliveryAttentionReason,
} from "../model/in-transit-params";
import { DeliveryAdvancedFilters } from "./delivery-advanced-filters";
import { DeliverySearchInput } from "./delivery-search-input";
import { DeliverySortSheet } from "./delivery-sort-sheet";

type DeliveryToolbarProps = {
  advanced: DeliveryAdvancedState;
  advancedCount: number;
  counterLabel: string;
  filter: DeliveryReadControllerInTransitListFilter;
  filterCounts?: DeliveryFilterCounts;
  isPending: boolean;
  loadingLabel: string;
  onApplyAdvanced: (draft: DeliveryAdvancedState) => void;
  onClearAdvanced: () => void;
  onClearAll: () => void;
  onClearSearch: () => void;
  onFilterChange: (value: DeliveryReadControllerInTransitListFilter) => void;
  onSearch: (value: string) => void;
  onSortChange: (value: DeliveryReadControllerInTransitListSort) => void;
  searchValue: string;
  sort: DeliveryReadControllerInTransitListSort;
};

export function DeliveryToolbar({
  advanced,
  advancedCount,
  counterLabel,
  filter,
  filterCounts,
  isPending,
  loadingLabel,
  onApplyAdvanced,
  onClearAdvanced,
  onClearAll,
  onClearSearch,
  onFilterChange,
  onSearch,
  onSortChange,
  searchValue,
  sort,
}: DeliveryToolbarProps) {
  const tActiveFilters = useTranslations("delivery.activeFilters");
  const tAttention = useTranslations("delivery.attention.chip");
  const tFilters = useTranslations("delivery.filters");
  const tSort = useTranslations("delivery.sort");

  const attentionReason = isDeliveryPrimaryFilter(filter)
    ? null
    : toDeliveryAttentionReason(filter);

  const filterOptions = DELIVERY_PRIMARY_FILTERS.map((value) => ({
    count: filterCounts?.[value],
    label: tFilters(value),
    value,
  }));

  const activeFilterChips: ActiveFilterChip[] = [
    ...(attentionReason === null
      ? []
      : [
          {
            key: "attention",
            label: tActiveFilters("attention", { label: tAttention(attentionReason) }),
            onRemove: () => onFilterChange(DELIVERY_FILTER_DEFAULT),
          },
        ]),
    ...(advancedCount === 0
      ? []
      : [
          {
            key: "advanced",
            label: tActiveFilters("advanced", { count: advancedCount }),
            onRemove: onClearAdvanced,
          },
        ]),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <DeliverySearchInput onClear={onClearSearch} onSearch={onSearch} value={searchValue} />
        </div>
        <div className="flex items-center gap-1.5 sm:flex-wrap sm:gap-2.5">
          <DeliverySortSheet
            className="sm:hidden"
            label={tSort("label")}
            onChange={onSortChange}
            value={sort}
          />

          <DeliveryAdvancedFilters
            activeCount={advancedCount}
            onApply={onApplyAdvanced}
            state={advanced}
          />

          <div className="hidden sm:block sm:w-80">
            <Select
              onValueChange={(next) =>
                onSortChange(next as DeliveryReadControllerInTransitListSort)
              }
              value={sort}
            >
              <SelectTrigger
                aria-label={tSort("label")}
                className="h-10 w-full data-[size=default]:h-10"
                isClearable={sort !== DELIVERY_SORT_DEFAULT}
                onClear={() => onSortChange(DELIVERY_SORT_DEFAULT)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_SORT_ORDER.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tSort(`options.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={tFilters("label")}
          mode="single"
          onValueChange={(next) => {
            const match = filterOptions.find((option) => option.value === next);
            if (match !== undefined) onFilterChange(match.value);
          }}
          options={filterOptions}
          size="sm"
          value={filter}
        />
      </div>

      <LibraryActiveFilters chips={activeFilterChips} onClearAll={onClearAll} />

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {isPending ? loadingLabel : counterLabel}
      </p>
    </div>
  );
}
