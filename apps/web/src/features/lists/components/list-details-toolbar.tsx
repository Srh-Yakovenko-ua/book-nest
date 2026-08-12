"use client";

import type { ReactNode } from "react";

import { LayoutGrid, List, SquareCheckBig } from "lucide-react";
import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
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

import type { ListBookSortOption } from "../model/list-book-sort";
import type { ListDetailQueryState, ListDetailViewMode } from "../model/list-detail-query";
import type { UseListDetailQueryResult } from "../model/use-list-detail-query";

import { LIST_BOOK_SORT_DEFAULT, LIST_BOOK_SORT_OPTIONS } from "../model/list-book-sort";
import { ListAdvancedFilters } from "./list-advanced-filters";

type ListDetailsToolbarProps = {
  chips: ActiveFilterChip[];
  counterLabel: string;
  id: string;
  isReorderLocked: boolean;
  isSelecting: boolean;
  onClearAll: () => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: ListBookSortOption) => void;
  onToggleSelecting: () => void;
  onViewChange: (value: ListDetailViewMode) => void;
  quickFilters: ReactNode;
  setState: UseListDetailQueryResult["setState"];
  state: ListDetailQueryState;
};

export function ListDetailsToolbar({
  chips,
  counterLabel,
  id,
  isReorderLocked,
  isSelecting,
  onClearAll,
  onSearchChange,
  onSortChange,
  onToggleSelecting,
  onViewChange,
  quickFilters,
  setState,
  state,
}: ListDetailsToolbarProps) {
  const t = useTranslations("lists.details.toolbar");
  const tReorder = useTranslations("lists.details.reorder");
  const tSelection = useTranslations("lists.details.selection");
  const tSort = useTranslations("lists.details.toolbar.sort");
  const tView = useTranslations("lists.details.view");
  const tCommon = useTranslations("common");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <DebouncedSearchInput
            clearLabel={tCommon("clear")}
            isCommittable={alwaysCommittable}
            label={t("searchLabel")}
            onClear={() => onSearchChange("")}
            onSearch={onSearchChange}
            placeholder={t("searchPlaceholder")}
            value={state.q}
          />
        </div>

        <div className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2.5">
          <div className="min-w-0 flex-1 sm:w-80 sm:flex-none">
            <Select onValueChange={(next) => onSortChange(toSortOption(next))} value={state.sort}>
              <SelectTrigger
                aria-label={t("sort.label")}
                className="h-10 w-full data-[size=default]:h-10"
                clearLabel={tCommon("clear")}
                isClearable={state.sort !== LIST_BOOK_SORT_DEFAULT}
                onClear={() => onSortChange(LIST_BOOK_SORT_DEFAULT)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIST_BOOK_SORT_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tSort(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ListAdvancedFilters id={id} setState={setState} state={state} />

          <Button
            aria-pressed={isSelecting}
            className="h-10 shrink-0 max-sm:w-10 max-sm:px-0"
            onClick={onToggleSelecting}
            variant={isSelecting ? "secondary" : "outline"}
          >
            <SquareCheckBig />
            <span className="max-sm:sr-only">
              {isSelecting ? tSelection("exit") : tSelection("enter")}
            </span>
          </Button>

          <Segmented
            className="ml-auto h-10 shrink-0 items-stretch [&_[data-slot=segmented-item]]:py-0 max-sm:[&_[data-slot=segmented-item]]:px-2.5"
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

      {quickFilters}

      <LibraryActiveFilters chips={chips} onClearAll={onClearAll} />

      {isReorderLocked ? (
        <div
          className="flex items-start gap-2 rounded-md border border-info/30 bg-info-soft/60 px-3 py-2 text-xs text-info"
          role="status"
        >
          <UiIcon aria-hidden className="mt-px shrink-0" name="info" size={14} />
          <span>{tReorder("hint")}</span>
        </div>
      ) : null}

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {counterLabel}
      </p>
    </div>
  );
}

function alwaysCommittable(): boolean {
  return true;
}

function toSortOption(value: string): ListBookSortOption {
  return LIST_BOOK_SORT_OPTIONS.find((option) => option === value) ?? LIST_BOOK_SORT_DEFAULT;
}
