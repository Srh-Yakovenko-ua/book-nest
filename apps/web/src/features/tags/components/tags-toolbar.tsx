"use client";

import type { TagQuickCounts } from "@app/shared";

import { TAG_SORT_DEFAULT, TagQuickFilterSchema, TagSortSchema } from "@app/shared";
import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { ChipGroup } from "@/components/ui/chip-group";
import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import type { UseTagQueryResult } from "../model/use-tag-query";

import { TagsActiveChips } from "./tags-active-chips";
import { TagsAdvancedFilters } from "./tags-advanced-filters";

type TagsToolbarProps = {
  query: UseTagQueryResult;
  quickCounts: TagQuickCounts | undefined;
};

export function TagsToolbar({ query, quickCounts }: TagsToolbarProps) {
  const t = useTranslations("tags");
  const tCommon = useTranslations("common");
  const { state } = query;

  function selectSort(value: string) {
    const parsed = TagSortSchema.safeParse(value);
    if (parsed.success) query.setSort(parsed.data);
  }

  function selectQuickFilter(value: string) {
    const parsed = TagQuickFilterSchema.safeParse(value);
    if (parsed.success) query.setFilter(parsed.data);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 lg:flex-1">
          <DebouncedSearchInput
            clearLabel={t("toolbar.searchClear")}
            label={t("toolbar.searchTagsLabel")}
            onClear={query.clearSearch}
            onSearch={query.setSearch}
            placeholder={t("toolbar.searchTagsPlaceholder")}
            value={state.q}
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <MobileSortSheet
            className="max-w-[9.5rem] flex-1 sm:hidden"
            closeLabel={t("sortMobile.close")}
            description={t("sortMobile.tagDescription")}
            groups={[
              {
                key: "sort",
                options: TagSortSchema.options.map((value) => ({
                  label: t(`sort.${value}`),
                  value,
                })),
              },
            ]}
            id="tags-sort"
            label={t("toolbar.sortLabel")}
            onChange={query.setSort}
            title={t("sortMobile.title")}
            triggerLabel={t(`sortMobile.trigger.${state.sort}`)}
            value={state.sort}
          />

          <div className="hidden sm:block sm:w-64">
            <Select onValueChange={selectSort} value={state.sort}>
              <SelectTrigger
                aria-label={t("toolbar.sortLabel")}
                className="w-full data-[size=default]:h-10"
                clearLabel={tCommon("clear")}
                isClearable={state.sort !== TAG_SORT_DEFAULT}
                onClear={() => query.setSort(TAG_SORT_DEFAULT)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TagSortSchema.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`sort.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TagsAdvancedFilters
            onApply={query.setAdvancedFilters}
            value={{ color: state.color, type: state.type }}
          />

          <Segmented
            className="ml-auto h-10 shrink-0 items-stretch sm:ml-0 [&_[data-slot=segmented-item]]:py-0 max-sm:[&_[data-slot=segmented-item]]:px-2.5"
            label={t("toolbar.viewLabel")}
            onValueChange={(next) => query.setView(next === "list" ? "list" : "grid")}
            options={[
              {
                icon: <LayoutGrid />,
                label: <span className="max-sm:sr-only">{t("toolbar.viewGrid")}</span>,
                value: "grid",
              },
              {
                icon: <List />,
                label: <span className="max-sm:sr-only">{t("toolbar.viewList")}</span>,
                value: "list",
              },
            ]}
            value={state.view}
          />
        </div>
      </div>

      <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={t("toolbar.quickFilterLabel")}
          mode="single"
          onValueChange={selectQuickFilter}
          options={TagQuickFilterSchema.options.map((option) => ({
            label: (
              <QuickFilterLabel count={quickCounts?.[option]} label={t(`quickFilter.${option}`)} />
            ),
            value: option,
          }))}
          size="sm"
          value={state.filter}
        />
      </div>

      <TagsActiveChips query={query} />
    </div>
  );
}

export function TagsToolbarSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-10 min-w-0 rounded-md lg:flex-1" />
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Skeleton className="h-10 w-[9.5rem] shrink-0 rounded-md sm:hidden" />
          <Skeleton className="hidden h-10 rounded-md sm:block sm:w-64" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-md sm:w-28" />
          <Skeleton className="ml-auto h-10 w-20 shrink-0 rounded-full sm:ml-0 sm:w-44" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {TagQuickFilterSchema.options.map((option) => (
          <Skeleton className="h-8 w-24 rounded-full" key={option} />
        ))}
      </div>
    </div>
  );
}

function QuickFilterLabel({ count, label }: { count: number | undefined; label: string }) {
  return (
    <>
      {label}
      {count === undefined ? null : (
        <span className="text-muted-foreground tabular-nums in-data-[state=on]:text-primary-foreground">
          {count}
        </span>
      )}
    </>
  );
}
