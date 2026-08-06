"use client";

import { useTranslations } from "next-intl";

import type {
  LoansControllerListFilter,
  LoansControllerListSort,
} from "@/shared/api/generated/model";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { LOANS_FILTER_VALUES, LOANS_SORT_DEFAULT, LOANS_SORT_VALUES } from "../model/loans-query";

type LoansToolbarProps = {
  filter: LoansControllerListFilter;
  onFilterChange: (value: LoansControllerListFilter) => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onSortChange: (value: LoansControllerListSort) => void;
  search: string;
  sort: LoansControllerListSort;
};

export function LoansToolbar({
  filter,
  onFilterChange,
  onSearchChange,
  onSearchClear,
  onSortChange,
  search,
  sort,
}: LoansToolbarProps) {
  const t = useTranslations("loans.toolbar");
  const tCommon = useTranslations("common");
  const tFilters = useTranslations("loans.filters");
  const tSort = useTranslations("loans.sort");
  const tSortMobile = useTranslations("loans.sort.mobile");

  return (
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
        <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
          <ToolbarSelect
            label={t("filterLabel")}
            onChange={onFilterChange}
            options={LOANS_FILTER_VALUES.map((value) => ({ label: tFilters(value), value }))}
            value={filter}
          />
        </div>

        <MobileSortSheet
          className="sm:hidden"
          closeLabel={tSortMobile("close")}
          groups={[
            {
              key: "sort",
              options: LOANS_SORT_VALUES.map((value) => ({ label: tSort(value), value })),
            },
          ]}
          id="loans-sort"
          label={t("sortLabel")}
          onChange={onSortChange}
          title={tSortMobile("title")}
          triggerLabel={tSortMobile(`trigger.${sort}`)}
          value={sort}
        />

        <div className="hidden sm:block sm:w-56">
          <ToolbarSelect
            clearable={sort !== LOANS_SORT_DEFAULT}
            clearLabel={tCommon("clear")}
            label={t("sortLabel")}
            onChange={onSortChange}
            onClear={() => onSortChange(LOANS_SORT_DEFAULT)}
            options={LOANS_SORT_VALUES.map((value) => ({ label: tSort(value), value }))}
            value={sort}
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
    <div className="w-full sm:w-56">
      <Select onValueChange={(next) => onChange(next as TValue)} value={value}>
        <SelectTrigger
          aria-label={label}
          className="h-10 w-full data-[size=default]:h-10"
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
