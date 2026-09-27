"use client";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { buildMobileSortGroups, MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  PublishersAdvancedFilters,
  PublishersSort,
  PublishersViewMode,
} from "../model/publisher-query";

import { PUBLISHERS_SORTS } from "../model/publisher-query";
import { PublisherAdvancedFilters } from "./publisher-advanced-filters";

type SortGroupKey = "books" | "name" | "rating" | "read" | "recent" | "to_buy";

const SORT_GROUP_BY_VALUE: Record<PublishersSort, SortGroupKey> = {
  books_asc: "books",
  books_desc: "books",
  name_asc: "name",
  name_desc: "name",
  rating_asc: "rating",
  rating_desc: "rating",
  read_asc: "read",
  read_desc: "read",
  recent_asc: "recent",
  recent_desc: "recent",
  to_buy_asc: "to_buy",
  to_buy_desc: "to_buy",
};

type PublisherToolbarProps = {
  advancedFilters: PublishersAdvancedFilters;
  onAdvancedApply: (next: PublishersAdvancedFilters) => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onSortChange: (value: PublishersSort) => void;
  onViewChange: (value: PublishersViewMode) => void;
  search: string;
  sort: PublishersSort;
  view: PublishersViewMode;
};

export function PublisherToolbar({
  advancedFilters,
  onAdvancedApply,
  onSearchChange,
  onSearchClear,
  onSortChange,
  onViewChange,
  search,
  sort,
  view,
}: PublisherToolbarProps) {
  const t = useTranslations("publishers.toolbar");

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

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <MobileSortSheet
          className="max-sm:h-11 sm:hidden"
          closeLabel={t("sortMobile.close")}
          description={t("sortMobile.description")}
          groups={buildMobileSortGroups({
            groupKeyByValue: SORT_GROUP_BY_VALUE,
            groupLabel: (key) => t(`sortMobile.groups.${key}`),
            optionLabel: (value) => t(`sort.${value}`),
            values: PUBLISHERS_SORTS,
          })}
          id="publishers-sort"
          label={t("sortLabel")}
          onChange={onSortChange}
          title={t("sortMobile.title")}
          triggerLabel={t(`sort.${sort}`)}
          value={sort}
        />
        <div className="hidden sm:block sm:w-60">
          <Select
            onValueChange={(next) => {
              const match = PUBLISHERS_SORTS.find((value) => value === next);
              if (match !== undefined) onSortChange(match);
            }}
            value={sort}
          >
            <SelectTrigger
              aria-label={t("sortLabel")}
              className="h-10 w-full data-[size=default]:h-10"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PUBLISHERS_SORTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`sort.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PublisherAdvancedFilters filters={advancedFilters} onApply={onAdvancedApply} />
        <Segmented
          className="ml-auto h-10 shrink-0 items-stretch max-sm:h-11 sm:ml-0 [&_[data-slot=segmented-item]]:py-0 max-sm:[&_[data-slot=segmented-item]]:px-2.5"
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
  );
}
