"use client";

import { useTranslations } from "next-intl";

import type { DeliveryReadControllerHistoryListSort } from "@/shared/api/generated/model";

import { PageTabs } from "@/components/page-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LibraryActiveFilters } from "@/features/books/components/library-active-filters";

import type { DeliveryHistoryAdvancedState, DeliveryHistoryTab } from "../model/history-params";

import {
  comparesHistoryPrices,
  DELIVERY_HISTORY_PANEL_ID,
  DELIVERY_HISTORY_SORT_DEFAULT,
  DELIVERY_HISTORY_SORT_ORDER,
  DELIVERY_HISTORY_TABS,
} from "../model/history-params";
import { useHistoryFilterChips } from "../model/use-history-filter-chips";
import { DeliveryHistoryAdvancedFilters } from "./delivery-history-advanced-filters";
import { DeliveryHistorySortSheet } from "./delivery-history-sort-sheet";
import { DeliverySearchInput } from "./delivery-search-input";

type DeliveryHistoryToolbarProps = {
  advanced: DeliveryHistoryAdvancedState;
  advancedCount: number;
  canSortByPrice: boolean;
  counterLabel: string;
  isPending: boolean;
  loadingLabel: string;
  onApplyAdvanced: (draft: DeliveryHistoryAdvancedState) => void;
  onClearAdvanced: () => void;
  onClearSearch: () => void;
  onSearch: (value: string) => void;
  onSortChange: (value: DeliveryReadControllerHistoryListSort) => void;
  onTabChange: (value: DeliveryHistoryTab) => void;
  searchValue: string;
  sort: DeliveryReadControllerHistoryListSort;
  tab: DeliveryHistoryTab;
};

export function DeliveryHistoryToolbar({
  advanced,
  advancedCount,
  canSortByPrice,
  counterLabel,
  isPending,
  loadingLabel,
  onApplyAdvanced,
  onClearAdvanced,
  onClearSearch,
  onSearch,
  onSortChange,
  onTabChange,
  searchValue,
  sort,
  tab,
}: DeliveryHistoryToolbarProps) {
  const tTabs = useTranslations("delivery.history.tabs");
  const tSort = useTranslations("delivery.history.sort");

  const tabOptions = DELIVERY_HISTORY_TABS.map((value) => ({ label: tTabs(value), value }));

  const priceSortHint = canSortByPrice ? undefined : tSort("pickOneCurrency");

  const activeFilterChips = useHistoryFilterChips({
    onApplyAdvanced,
    state: advanced,
    tab,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageTabs
        ariaLabel={tTabs("label")}
        items={tabOptions}
        onValueChange={(next) => {
          const match = DELIVERY_HISTORY_TABS.find((value) => value === next);
          if (match !== undefined) onTabChange(match);
        }}
        panelId={DELIVERY_HISTORY_PANEL_ID}
        value={tab}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <DeliverySearchInput onClear={onClearSearch} onSearch={onSearch} value={searchValue} />
        </div>
        <div className="flex gap-3">
          <DeliveryHistorySortSheet
            className="sm:hidden"
            disabledSortHint={priceSortHint}
            label={tSort("label")}
            onChange={onSortChange}
            value={sort}
          />

          <div className="hidden sm:block sm:w-80">
            <Select
              onValueChange={(next) => onSortChange(next as DeliveryReadControllerHistoryListSort)}
              value={sort}
            >
              <SelectTrigger
                aria-label={tSort("label")}
                className="h-10 w-full data-[size=default]:h-10"
                isClearable={sort !== DELIVERY_HISTORY_SORT_DEFAULT}
                onClear={() => onSortChange(DELIVERY_HISTORY_SORT_DEFAULT)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_HISTORY_SORT_ORDER.map((value) => (
                  <SelectItem
                    disabled={comparesHistoryPrices(value) && priceSortHint !== undefined}
                    key={value}
                    value={value}
                  >
                    <span className="flex flex-col gap-0.5">
                      {tSort(`options.${value}`)}
                      {comparesHistoryPrices(value) && priceSortHint !== undefined ? (
                        <span className="text-xs text-muted-foreground">{priceSortHint}</span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DeliveryHistoryAdvancedFilters
            activeCount={advancedCount}
            onApply={onApplyAdvanced}
            state={advanced}
            tab={tab}
          />
        </div>
      </div>

      <LibraryActiveFilters chips={activeFilterChips} onClearAll={onClearAdvanced} />

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {isPending ? loadingLabel : counterLabel}
      </p>
    </div>
  );
}
