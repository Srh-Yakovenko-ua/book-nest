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

import type { DeliveryFilterCounts } from "../model/in-transit-params";

import {
  DELIVERY_PRIMARY_FILTERS,
  DELIVERY_SORT_DEFAULT,
  DELIVERY_SORT_ORDER,
} from "../model/in-transit-params";
import { DeliverySearchInput } from "./delivery-search-input";

type DeliveryToolbarProps = {
  counterLabel: string;
  filter: DeliveryReadControllerInTransitListFilter;
  filterCounts?: DeliveryFilterCounts;
  isPending: boolean;
  loadingLabel: string;
  onClearSearch: () => void;
  onFilterChange: (value: DeliveryReadControllerInTransitListFilter) => void;
  onSearch: (value: string) => void;
  onSortChange: (value: DeliveryReadControllerInTransitListSort) => void;
  searchValue: string;
  sort: DeliveryReadControllerInTransitListSort;
};

export function DeliveryToolbar({
  counterLabel,
  filter,
  filterCounts,
  isPending,
  loadingLabel,
  onClearSearch,
  onFilterChange,
  onSearch,
  onSortChange,
  searchValue,
  sort,
}: DeliveryToolbarProps) {
  const tFilters = useTranslations("delivery.filters");
  const tSort = useTranslations("delivery.sort");

  const filterOptions = DELIVERY_PRIMARY_FILTERS.map((value) => ({
    count: filterCounts?.[value],
    label: tFilters(value),
    value,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <DeliverySearchInput onClear={onClearSearch} onSearch={onSearch} value={searchValue} />
        </div>
        <div className="w-full sm:w-56">
          <Select
            onValueChange={(next) => onSortChange(next as DeliveryReadControllerInTransitListSort)}
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

      <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={tFilters("label")}
          mode="single"
          onValueChange={(next) => {
            const match = DELIVERY_PRIMARY_FILTERS.find((value) => value === next);
            if (match !== undefined) onFilterChange(match);
          }}
          options={filterOptions}
          size="sm"
          value={filter}
        />
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {isPending ? loadingLabel : counterLabel}
      </p>
    </div>
  );
}
