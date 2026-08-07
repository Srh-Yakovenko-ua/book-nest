"use client";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LibraryActiveFilters } from "@/features/books/components/library-active-filters";

import type { ListSort, ListsQueryState, ListViewMode } from "../model/lists-query";
import type { UseListsQueryResult } from "../model/use-lists-query";

import { LIST_SORT_DEFAULT, LIST_SORT_OPTIONS } from "../model/lists-query";
import { useListsFilterChips } from "../model/use-lists-filter-chips";
import { ListsAdvancedFilters } from "./lists-advanced-filters";

type ListsToolbarProps = {
  counter?: string;
  onClearFilters: () => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: ListSort) => void;
  onViewChange: (value: ListViewMode) => void;
  setState: UseListsQueryResult["setState"];
  state: ListsQueryState;
};

export function ListsToolbar({
  counter,
  onClearFilters,
  onSearchChange,
  onSortChange,
  onViewChange,
  setState,
  state,
}: ListsToolbarProps) {
  const chips = useListsFilterChips({ setState, state });
  const t = useTranslations("lists.catalog");
  const tSort = useTranslations("lists.catalog.sort");
  const tSortMobile = useTranslations("lists.catalog.sort.mobile");
  const tView = useTranslations("lists.catalog.view");
  const tCommon = useTranslations("common");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <DebouncedSearchInput
            clearLabel={t("noResults.clear")}
            label={t("search.placeholder")}
            onClear={() => onSearchChange("")}
            onSearch={onSearchChange}
            placeholder={t("search.placeholder")}
            value={state.q}
          />
        </div>

        <div className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2.5">
          <MobileSortSheet
            className="sm:hidden"
            closeLabel={tSortMobile("close")}
            groups={[
              {
                key: "sort",
                options: LIST_SORT_OPTIONS.map((value) => ({ label: tSort(value), value })),
              },
            ]}
            id="lists-sort"
            label={t("sort.label")}
            onChange={onSortChange}
            title={tSortMobile("title")}
            triggerLabel={tSortMobile(`trigger.${state.sort}`)}
            value={state.sort}
          />

          <div className="hidden sm:block sm:w-80">
            <Select onValueChange={(next) => onSortChange(next as ListSort)} value={state.sort}>
              <SelectTrigger
                aria-label={t("sort.label")}
                className="h-10 w-full data-[size=default]:h-10"
                clearLabel={tCommon("clear")}
                isClearable={state.sort !== LIST_SORT_DEFAULT}
                onClear={() => onSortChange(LIST_SORT_DEFAULT)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIST_SORT_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tSort(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ListsAdvancedFilters setState={setState} state={state} />

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
            value={state.view}
          />
        </div>
      </div>

      <LibraryActiveFilters chips={chips} onClearAll={onClearFilters} />

      {counter === undefined ? null : (
        <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
          {counter}
        </p>
      )}
    </div>
  );
}
