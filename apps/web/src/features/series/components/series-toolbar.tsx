"use client";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type {
  SeriesAdvancedFilters as SeriesAdvancedFiltersValue,
  SeriesListLayout,
  SeriesReadingFilter,
  SeriesSort,
  SeriesStatusFilter,
} from "../model/series-derive";

import {
  SERIES_READING_FILTERS,
  SERIES_SORT_DEFAULT,
  SERIES_SORT_OPTIONS,
  SERIES_STATUS_FILTERS,
} from "../model/series-derive";
import { SeriesAdvancedFilters } from "./series-advanced-filters";

type SeriesToolbarProps = {
  advancedFilters: SeriesAdvancedFiltersValue;
  onAdvancedApply: (next: SeriesAdvancedFiltersValue) => void;
  onReadingChange: (value: SeriesReadingFilter) => void;
  onRememberAuthor: (id: string, name: string) => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onSortChange: (value: SeriesSort) => void;
  onStatusChange: (value: SeriesStatusFilter) => void;
  onViewChange: (value: SeriesListLayout) => void;
  readingFilter: SeriesReadingFilter;
  resolveAuthorName: (id: string) => string | undefined;
  search: string;
  sort: SeriesSort;
  statusFilter: SeriesStatusFilter;
  view: SeriesListLayout;
};

export function SeriesToolbar({
  advancedFilters,
  onAdvancedApply,
  onReadingChange,
  onRememberAuthor,
  onSearchChange,
  onSearchClear,
  onSortChange,
  onStatusChange,
  onViewChange,
  readingFilter,
  resolveAuthorName,
  search,
  sort,
  statusFilter,
  view,
}: SeriesToolbarProps) {
  const t = useTranslations("series.toolbar");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("series.statusFilter");
  const tReading = useTranslations("series.readingFilter");
  const tSort = useTranslations("series.sort");
  const tSortMobile = useTranslations("series.sort.mobile");
  const tView = useTranslations("series.view");

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex items-center lg:flex-1">
        <UiIcon
          aria-hidden
          className="pointer-events-none absolute left-3 text-muted-foreground"
          name="search"
          size={18}
        />
        <input
          aria-label={t("searchLabel")}
          autoComplete="off"
          className={cn(
            "h-10 w-full rounded-md border border-input bg-field pr-10 pl-10 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
          enterKeyHint="search"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("searchPlaceholder")}
          type="text"
          value={search}
        />
        {search.length > 0 ? (
          <button
            aria-label={t("searchClear")}
            className="absolute right-2 grid size-6 cursor-pointer place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={onSearchClear}
            type="button"
          >
            <UiIcon name="x" size={16} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
        <div className="grid grid-cols-2 gap-1.5 sm:contents">
          <ToolbarSelect
            label={t("statusLabel")}
            onChange={onStatusChange}
            options={SERIES_STATUS_FILTERS.map((value) => ({ label: tStatus(value), value }))}
            value={statusFilter}
            widthClassName="sm:w-[180px]"
          />
          <ToolbarSelect
            label={t("readingLabel")}
            onChange={onReadingChange}
            options={SERIES_READING_FILTERS.map((value) => ({ label: tReading(value), value }))}
            value={readingFilter}
            widthClassName="sm:w-[180px]"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:contents">
          <MobileSortSheet
            className="sm:hidden"
            closeLabel={tSortMobile("close")}
            description={tSortMobile("description")}
            groups={[
              {
                key: "sort",
                options: SERIES_SORT_OPTIONS.map((value) => ({ label: tSort(value), value })),
              },
            ]}
            id="series-sort"
            label={t("sortLabel")}
            onChange={onSortChange}
            title={tSortMobile("title")}
            triggerLabel={tSortMobile(`trigger.${sort}`)}
            value={sort}
          />
          <div className="hidden sm:block sm:w-52">
            <ToolbarSelect
              clearable={sort !== SERIES_SORT_DEFAULT}
              clearLabel={tCommon("clear")}
              label={t("sortLabel")}
              onChange={onSortChange}
              onClear={() => onSortChange(SERIES_SORT_DEFAULT)}
              options={SERIES_SORT_OPTIONS.map((value) => ({ label: tSort(value), value }))}
              value={sort}
              widthClassName="sm:w-52"
            />
          </div>
          <SeriesAdvancedFilters
            filters={advancedFilters}
            onApply={onAdvancedApply}
            onRememberAuthor={onRememberAuthor}
            resolveAuthorName={resolveAuthorName}
          />
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
      </div>
    </div>
  );
}

function ToolbarSelect<TValue extends string>({
  clearable = false,
  clearLabel,
  label,
  onChange,
  onClear,
  options,
  value,
  widthClassName = "sm:w-52",
}: {
  clearable?: boolean;
  clearLabel?: string;
  label: string;
  onChange: (value: TValue) => void;
  onClear?: () => void;
  options: { label: string; value: TValue }[];
  value: TValue;
  widthClassName?: string;
}) {
  return (
    <div className={cn("w-full", widthClassName)}>
      <Select onValueChange={(next) => onChange(next as TValue)} value={value}>
        <SelectTrigger
          aria-label={label}
          className="w-full data-[size=default]:h-10"
          clearLabel={clearLabel}
          isClearable={clearable}
          onClear={onClear}
        >
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
