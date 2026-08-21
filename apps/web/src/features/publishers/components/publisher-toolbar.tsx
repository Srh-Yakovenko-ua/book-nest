"use client";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";

import type {
  PublishersControllerLibraryListGeography,
  PublishersControllerLibraryListOrder,
  PublishersControllerLibraryListSort,
  PublishersControllerLibraryListSource,
} from "@/shared/api/generated/model";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { PublisherBooleanFilter, PublishersViewMode } from "../model/publisher-query";

import {
  PUBLISHERS_BOOLEAN_FILTERS,
  PUBLISHERS_GEOGRAPHY_OPTIONS,
  PUBLISHERS_SORT_OPTIONS,
  PUBLISHERS_SOURCE_OPTIONS,
} from "../model/publisher-query";

type PublisherBooleanFilterState = Record<PublisherBooleanFilter, boolean | null>;

type PublisherToolbarProps = {
  booleanFilters: PublisherBooleanFilterState;
  geography: PublishersControllerLibraryListGeography;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onGeographyChange: (value: PublishersControllerLibraryListGeography) => void;
  onOrderChange: (value: PublishersControllerLibraryListOrder) => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onSortChange: (value: PublishersControllerLibraryListSort) => void;
  onSourceChange: (value: PublishersControllerLibraryListSource) => void;
  onToggleBoolFilter: (filter: PublisherBooleanFilter, value: boolean | null) => void;
  onViewChange: (value: PublishersViewMode) => void;
  order: PublishersControllerLibraryListOrder;
  search: string;
  sort: PublishersControllerLibraryListSort;
  source: PublishersControllerLibraryListSource;
  view: PublishersViewMode;
};

export function PublisherToolbar({
  booleanFilters,
  geography,
  hasActiveFilters,
  onClearFilters,
  onGeographyChange,
  onOrderChange,
  onSearchChange,
  onSearchClear,
  onSortChange,
  onSourceChange,
  onToggleBoolFilter,
  onViewChange,
  order,
  search,
  sort,
  source,
  view,
}: PublisherToolbarProps) {
  const t = useTranslations("publishers.toolbar");
  const tSort = useTranslations("publishers.toolbar.sort");
  const tSortMobile = useTranslations("publishers.toolbar.sortMobile");
  const tGeography = useTranslations("publishers.toolbar.geography");
  const tSource = useTranslations("publishers.toolbar.source");
  const tFilters = useTranslations("publishers.toolbar.filters");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <DebouncedSearchInput
            clearLabel={t("searchClear")}
            label={t("searchLabel")}
            onClear={onSearchClear}
            onSearch={onSearchChange}
            placeholder={t("searchPlaceholder")}
            value={search}
          />
        </div>

        <div className="flex items-center gap-1.5 sm:flex-wrap sm:gap-2.5">
          <MobileSortSheet
            className="sm:hidden"
            closeLabel={tSortMobile("close")}
            description={tSortMobile("description")}
            groups={[
              {
                key: "sort",
                options: PUBLISHERS_SORT_OPTIONS.map((value) => ({ label: tSort(value), value })),
              },
            ]}
            id="publishers-sort"
            label={t("sortLabel")}
            onChange={onSortChange}
            title={tSortMobile("title")}
            triggerLabel={tSortMobile(`trigger.${sort}`)}
            value={sort}
          />
          <div className="hidden sm:block sm:w-52">
            <ToolbarSelect
              label={t("sortLabel")}
              onChange={onSortChange}
              options={PUBLISHERS_SORT_OPTIONS.map((value) => ({ label: tSort(value), value }))}
              value={sort}
            />
          </div>
          <Segmented
            className="h-10 shrink-0 items-stretch [&_[data-slot=segmented-item]]:py-0 max-sm:[&_[data-slot=segmented-item]]:px-2.5"
            label={t("orderLabel")}
            onValueChange={(next) => onOrderChange(next === "asc" ? "asc" : "desc")}
            options={[
              {
                icon: <UiIcon name="arrow-down" />,
                label: <span className="max-sm:sr-only">{t("order.desc")}</span>,
                value: "desc",
              },
              {
                icon: <UiIcon name="arrow-up" />,
                label: <span className="max-sm:sr-only">{t("order.asc")}</span>,
                value: "asc",
              },
            ]}
            value={order}
          />
          <Segmented
            className="ml-auto h-10 shrink-0 items-stretch sm:ml-0 [&_[data-slot=segmented-item]]:py-0 max-sm:[&_[data-slot=segmented-item]]:px-2.5"
            label={t("viewLabel")}
            onValueChange={(next) => onViewChange(next === "list" ? "list" : "grid")}
            options={[
              {
                icon: <LayoutGrid />,
                label: <span className="max-sm:sr-only">{t("viewGrid")}</span>,
                value: "grid",
              },
              {
                icon: <List />,
                label: <span className="max-sm:sr-only">{t("viewList")}</span>,
                value: "list",
              },
            ]}
            value={view}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
        <ToolbarSelect
          label={t("geographyLabel")}
          onChange={onGeographyChange}
          options={PUBLISHERS_GEOGRAPHY_OPTIONS.map((value) => ({
            label: tGeography(value),
            value,
          }))}
          value={geography}
        />
        <ToolbarSelect
          label={t("sourceLabel")}
          onChange={onSourceChange}
          options={PUBLISHERS_SOURCE_OPTIONS.map((value) => ({ label: tSource(value), value }))}
          value={source}
        />
      </div>

      <div className="-mx-1 -my-1 no-scrollbar flex items-center gap-2 overflow-x-auto px-1 py-1 sm:flex-wrap sm:gap-2.5">
        {PUBLISHERS_BOOLEAN_FILTERS.map((filter) => {
          const active = booleanFilters[filter] === true;
          return (
            <Button
              aria-pressed={active}
              className="h-10 shrink-0 max-sm:h-9 max-sm:px-3 max-sm:text-xs"
              key={filter}
              onClick={() => onToggleBoolFilter(filter, active ? null : true)}
              variant={active ? "secondary" : "outline"}
            >
              {active ? <UiIcon name="check" size={16} /> : null}
              {tFilters(filter)}
            </Button>
          );
        })}
        {hasActiveFilters ? (
          <Button
            className="h-10 shrink-0 max-sm:h-9 max-sm:px-3 max-sm:text-xs"
            onClick={onClearFilters}
            variant="ghost"
          >
            <UiIcon name="x" size={16} />
            {t("clearFilters")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ToolbarSelect<TValue extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: TValue) => void;
  options: { label: string; value: TValue }[];
  value: TValue;
}) {
  return (
    <div className="w-full min-w-0 sm:w-52">
      <Select onValueChange={(next) => onChange(next as TValue)} value={value}>
        <SelectTrigger aria-label={label} className="h-10 w-full data-[size=default]:h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
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
