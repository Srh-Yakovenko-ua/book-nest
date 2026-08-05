"use client";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
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
            "h-10 w-full rounded-md border border-input bg-field pr-10 pl-10 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
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

      <div className="flex flex-wrap items-center gap-2.5">
        <ToolbarSelect
          label={t("statusLabel")}
          onChange={onStatusChange}
          options={SERIES_STATUS_FILTERS.map((value) => ({ label: tStatus(value), value }))}
          value={statusFilter}
        />
        <ToolbarSelect
          label={t("readingLabel")}
          onChange={onReadingChange}
          options={SERIES_READING_FILTERS.map((value) => ({ label: tReading(value), value }))}
          value={readingFilter}
        />
        <ToolbarSelect
          clearable={sort !== SERIES_SORT_DEFAULT}
          clearLabel={tCommon("clear")}
          label={t("sortLabel")}
          onChange={onSortChange}
          onClear={() => onSortChange(SERIES_SORT_DEFAULT)}
          options={SERIES_SORT_OPTIONS.map((value) => ({ label: tSort(value), value }))}
          value={sort}
        />
        <SeriesAdvancedFilters
          filters={advancedFilters}
          onApply={onAdvancedApply}
          onRememberAuthor={onRememberAuthor}
          resolveAuthorName={resolveAuthorName}
        />
        <Segmented
          className="h-10 items-stretch [&_[data-slot=segmented-item]]:py-0"
          label={tView("label")}
          onValueChange={(next) => onViewChange(next === "list" ? "list" : "grid")}
          options={[
            { icon: <LayoutGrid />, label: tView("grid"), value: "grid" },
            { icon: <List />, label: tView("list"), value: "list" },
          ]}
          value={view}
        />
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
}: {
  clearable?: boolean;
  clearLabel?: string;
  label: string;
  onChange: (value: TValue) => void;
  onClear?: () => void;
  options: { label: string; value: TValue }[];
  value: TValue;
}) {
  return (
    <div className="w-full sm:w-52">
      <Select onValueChange={(next) => onChange(next as TValue)} value={value}>
        <SelectTrigger
          aria-label={label}
          className="h-10 w-full"
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
