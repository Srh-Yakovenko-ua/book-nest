"use client";

import type { GenreFacetsView } from "@app/shared";

import { GENRE_SORT_DEFAULT } from "@app/shared";
import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { ChipGroup } from "@/components/ui/chip-group";
import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import type { UseGenresQueryResult } from "../model/use-genres-query";

import { GENRES_QUERY, isGenresSearchCommittable } from "../model/genres-query";
import { GenresAdvancedFilters } from "./genres-advanced-filters";

type GenresToolbarProps = {
  facets: GenreFacetsView | undefined;
  query: UseGenresQueryResult;
};

export function GenresToolbar({ facets, query }: GenresToolbarProps) {
  const t = useTranslations("genres");
  const tCommon = useTranslations("common");
  const { state } = query;

  function selectSort(value: string) {
    const sort = GENRES_QUERY.sortOptions.find((option) => option === value);
    if (sort !== undefined) query.setSort(sort);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 lg:flex-1">
          <DebouncedSearchInput
            clearLabel={t("toolbar.searchClear")}
            isCommittable={isGenresSearchCommittable}
            label={t("toolbar.searchLabel")}
            onClear={query.clearSearch}
            onSearch={query.setSearch}
            placeholder={t("toolbar.searchPlaceholder")}
            value={state.q}
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <MobileSortSheet
            className="max-w-[9.5rem] flex-1 sm:hidden"
            closeLabel={t("sortMobile.close")}
            description={t("sortMobile.description")}
            groups={[
              {
                key: "sort",
                options: GENRES_QUERY.sortOptions.map((value) => ({
                  label: t(`sort.${value}`),
                  value,
                })),
              },
            ]}
            id="genres-sort"
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
                isClearable={state.sort !== GENRE_SORT_DEFAULT}
                onClear={() => query.setSort(GENRE_SORT_DEFAULT)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENRES_QUERY.sortOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`sort.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <GenresAdvancedFilters
            activeCount={query.activeAdvancedCount}
            groups={facets?.groups}
            onApply={query.applyAdvanced}
            value={query.advancedFilters}
          />
        </div>
      </div>

      <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={t("toolbar.quickFilterLabel")}
          mode="single"
          onValueChange={(next) => {
            const filter = GENRES_QUERY.quickFilters.find((option) => option === next);
            if (filter !== undefined) query.setFilter(filter);
          }}
          options={GENRES_QUERY.quickFilters.map((option) => ({
            count: facets?.quickCounts[option],
            label: t(`quickFilter.${option}`),
            value: option,
          }))}
          size="sm"
          value={state.filter}
        />
      </div>
    </div>
  );
}

export function GenresToolbarSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-10 min-w-0 rounded-md lg:flex-1" />
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Skeleton className="h-10 w-[9.5rem] shrink-0 rounded-md sm:hidden" />
          <Skeleton className="hidden h-10 rounded-md sm:block sm:w-64" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-md sm:w-28" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {GENRES_QUERY.quickFilters.map((option) => (
          <Skeleton className="h-8 w-24 rounded-full" key={option} />
        ))}
      </div>
    </div>
  );
}
