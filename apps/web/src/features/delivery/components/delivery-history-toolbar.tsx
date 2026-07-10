"use client";

import { useTranslations } from "next-intl";

import type {
  DeliveryControllerHistoryListSort,
  DeliveryControllerHistoryListTab,
} from "@/shared/api/generated/model";

import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { DeliveryHistoryQueryState } from "../model/history-params";
import type { HistoryFilterPatch } from "../model/use-history-params";

import {
  DELIVERY_HISTORY_SORT_DEFAULT,
  DELIVERY_HISTORY_SORT_ORDER,
  DELIVERY_HISTORY_TABS,
} from "../model/history-params";
import { DeliveryHistoryFilters } from "./delivery-history-filters";
import { DeliverySearchInput } from "./delivery-search-input";

type DeliveryHistoryToolbarProps = {
  counterLabel: string;
  filterCount: number;
  isPending: boolean;
  loadingLabel: string;
  onApplyFilters: (patch: HistoryFilterPatch) => void;
  onClearSearch: () => void;
  onResetFilters: () => void;
  onSearch: (value: string) => void;
  onSortChange: (value: DeliveryControllerHistoryListSort) => void;
  onTabChange: (value: DeliveryControllerHistoryListTab) => void;
  sort: DeliveryControllerHistoryListSort;
  state: DeliveryHistoryQueryState;
  tab: DeliveryControllerHistoryListTab;
};

export function DeliveryHistoryToolbar({
  counterLabel,
  filterCount,
  isPending,
  loadingLabel,
  onApplyFilters,
  onClearSearch,
  onResetFilters,
  onSearch,
  onSortChange,
  onTabChange,
  sort,
  state,
  tab,
}: DeliveryHistoryToolbarProps) {
  const tTabs = useTranslations("delivery.history.tabs");
  const tSort = useTranslations("delivery.history.sort");

  const tabOptions = DELIVERY_HISTORY_TABS.map((value) => ({ label: tTabs(value), value }));

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 no-scrollbar overflow-x-auto px-1">
        <Segmented
          label={tTabs("label")}
          onValueChange={(next) => {
            const match = DELIVERY_HISTORY_TABS.find((value) => value === next);
            if (match !== undefined) onTabChange(match);
          }}
          options={tabOptions}
          value={tab}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <DeliverySearchInput onClear={onClearSearch} onSearch={onSearch} value={state.q} />
        </div>
        <div className="flex gap-3">
          <div className="w-full sm:w-56">
            <Select
              onValueChange={(next) => onSortChange(next as DeliveryControllerHistoryListSort)}
              value={sort}
            >
              <SelectTrigger
                aria-label={tSort("label")}
                className="h-10 w-full"
                isClearable={sort !== DELIVERY_HISTORY_SORT_DEFAULT}
                onClear={() => onSortChange(DELIVERY_HISTORY_SORT_DEFAULT)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_HISTORY_SORT_ORDER.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tSort(`options.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DeliveryHistoryFilters
            filterCount={filterCount}
            onApply={onApplyFilters}
            onReset={onResetFilters}
            state={state}
          />
        </div>
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {isPending ? loadingLabel : counterLabel}
      </p>
    </div>
  );
}
