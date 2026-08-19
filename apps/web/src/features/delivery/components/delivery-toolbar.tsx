"use client";

import { SquareCheckBig } from "lucide-react";
import { useTranslations } from "next-intl";

import type {
  DeliveryReadControllerInTransitListFilter,
  DeliveryReadControllerInTransitListSort,
} from "@/shared/api/generated/model";

import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LibraryActiveFilters } from "@/features/books/components/library-active-filters";

import type { DeliveryAdvancedState, DeliveryFilterCounts } from "../model/in-transit-params";

import {
  canSortByOrderTotal,
  DELIVERY_PRIMARY_FILTERS,
  DELIVERY_SORT_DEFAULT,
  DELIVERY_SORT_ORDER,
} from "../model/in-transit-params";
import { useInTransitFilterChips } from "../model/use-in-transit-filter-chips";
import { DeliveryAdvancedFilters } from "./delivery-advanced-filters";
import { DeliverySearchInput } from "./delivery-search-input";
import { DeliverySortSheet } from "./delivery-sort-sheet";

type DeliverySelectionToggle = { isSelecting: boolean; onToggle: () => void };

type DeliveryToolbarProps = {
  advanced: DeliveryAdvancedState;
  advancedCount: number;
  counterLabel: string;
  filter: DeliveryReadControllerInTransitListFilter;
  filterCounts?: DeliveryFilterCounts;
  isPending: boolean;
  loadingLabel: string;
  onApplyAdvanced: (draft: DeliveryAdvancedState) => void;
  onClearAll: () => void;
  onClearSearch: () => void;
  onFilterChange: (value: DeliveryReadControllerInTransitListFilter) => void;
  onSearch: (value: string) => void;
  onSortChange: (value: DeliveryReadControllerInTransitListSort) => void;
  searchValue: string;
  selection?: DeliverySelectionToggle;
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
  onClearAll,
  onClearSearch,
  onFilterChange,
  onSearch,
  onSortChange,
  searchValue,
  selection,
  sort,
}: DeliveryToolbarProps) {
  const tActions = useTranslations("delivery.actions");
  const tFilters = useTranslations("delivery.filters");
  const tSort = useTranslations("delivery.sort");

  const activeFilterChips = useInTransitFilterChips({
    filter,
    onApplyAdvanced,
    onFilterChange,
    state: advanced,
  });

  const filterOptions = DELIVERY_PRIMARY_FILTERS.map((value) => ({
    count: filterCounts?.[value],
    label: tFilters(value),
    value,
  }));

  const sortByTotalHint = canSortByOrderTotal(advanced) ? undefined : tSort("pickOneCurrency");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <DeliverySearchInput onClear={onClearSearch} onSearch={onSearch} value={searchValue} />
        </div>
        <div className="flex items-center gap-1.5 sm:flex-wrap sm:gap-2.5">
          <DeliverySortSheet
            className="sm:hidden"
            disabledSortHint={sortByTotalHint}
            label={tSort("label")}
            onChange={onSortChange}
            value={sort}
          />

          <DeliveryAdvancedFilters
            activeCount={advancedCount}
            onApply={onApplyAdvanced}
            state={advanced}
          />

          {selection === undefined ? null : (
            <Button
              aria-pressed={selection.isSelecting}
              className="h-10 shrink-0 max-sm:w-10 max-sm:px-0"
              onClick={selection.onToggle}
              variant={selection.isSelecting ? "secondary" : "outline"}
            >
              <SquareCheckBig />
              <span className="max-sm:sr-only">
                {selection.isSelecting ? tActions("doneSelecting") : tActions("select")}
              </span>
            </Button>
          )}

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
                  <SelectItem
                    disabled={value === "price" && sortByTotalHint !== undefined}
                    key={value}
                    value={value}
                  >
                    <span className="flex flex-col gap-0.5">
                      {tSort(`options.${value}`)}
                      {value === "price" && sortByTotalHint !== undefined ? (
                        <span className="text-xs text-muted-foreground">{sortByTotalHint}</span>
                      ) : null}
                    </span>
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
