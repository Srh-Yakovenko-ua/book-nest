"use client";

import type { DedicationFilter, DedicationSort } from "@app/shared";

import { LayoutGrid, List } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { ChipGroup } from "@/components/ui/chip-group";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useGenres } from "@/features/books/api/use-genres";

import type { DedicationView } from "../model/dedications-query";

import {
  DEDICATION_CHIP_FILTERS,
  DEDICATION_SORT_DEFAULT,
  DEDICATION_SORT_OPTIONS,
} from "../model/dedications-query";

const ANY_GENRE = "__any__";

type DedicationsToolbarProps = {
  availableGenres: readonly string[];
  chipCounts?: Partial<Record<DedicationFilter, number>>;
  counter?: string;
  filter: DedicationFilter;
  genre: string;
  onFilterChange: (value: DedicationFilter) => void;
  onGenreChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: DedicationSort) => void;
  onViewChange: (value: DedicationView) => void;
  search: string;
  sort: DedicationSort;
  view: DedicationView;
};

export function DedicationsToolbar({
  availableGenres,
  chipCounts,
  counter,
  filter,
  genre,
  onFilterChange,
  onGenreChange,
  onSearchChange,
  onSortChange,
  onViewChange,
  search,
  sort,
  view,
}: DedicationsToolbarProps) {
  const t = useTranslations("dedications.toolbar");
  const tCommon = useTranslations("common");
  const tFilter = useTranslations("dedications.filter");
  const tSort = useTranslations("dedications.sort");
  const tView = useTranslations("dedications.view");
  const locale = useLocale();
  const genres = useGenres();

  const genreNameByKey = new Map((genres.data ?? []).map((entry) => [entry.key, entry.name]));
  const genreOptions = availableGenres
    .map((key) => ({ key, name: genreNameByKey.get(key) ?? key }))
    .sort((left, right) => left.name.localeCompare(right.name, locale));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <DebouncedSearchInput
            clearLabel={t("searchClear")}
            isCommittable={alwaysCommittable}
            label={t("searchLabel")}
            onClear={() => onSearchChange("")}
            onSearch={onSearchChange}
            placeholder={t("searchPlaceholder")}
            value={search}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-full sm:w-80">
            <Select
              onValueChange={(next) => {
                const match = DEDICATION_SORT_OPTIONS.find((option) => option === next);
                if (match !== undefined) onSortChange(match);
              }}
              value={sort}
            >
              <SelectTrigger
                aria-label={t("sortLabel")}
                className="w-full data-[size=default]:h-10"
                clearLabel={tCommon("clear")}
                isClearable={sort !== DEDICATION_SORT_DEFAULT}
                onClear={() => onSortChange(DEDICATION_SORT_DEFAULT)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEDICATION_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tSort(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {genreOptions.length === 0 ? null : (
            <div className="w-full sm:w-80">
              <Select
                onValueChange={(next) => onGenreChange(next === ANY_GENRE ? "" : next)}
                value={genre === "" ? ANY_GENRE : genre}
              >
                <SelectTrigger
                  aria-label={t("genreLabel")}
                  className="w-full data-[size=default]:h-10"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_GENRE}>{t("genreAny")}</SelectItem>
                  {genreOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

      <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={t("filterLabel")}
          mode="single"
          onValueChange={(next) => {
            const match = DEDICATION_CHIP_FILTERS.find((option) => option === next);
            if (match !== undefined) onFilterChange(match);
          }}
          options={DEDICATION_CHIP_FILTERS.map((option) => ({
            count: chipCounts?.[option],
            label: tFilter(option),
            value: option,
          }))}
          size="sm"
          value={filter}
        />
      </div>

      {counter === undefined ? null : (
        <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
          {counter}
        </p>
      )}
    </div>
  );
}

export function DedicationsToolbarSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-10 w-full rounded-md lg:flex-1" />
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-10 w-full rounded-md sm:w-80" />
          <Skeleton className="h-10 w-full rounded-md sm:w-80" />
          <Skeleton className="h-10 w-20 rounded-md" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: DEDICATION_CHIP_FILTERS.length }, (_, index) => (
          <Skeleton className="h-8 w-24 rounded-full" key={index} />
        ))}
      </div>
    </div>
  );
}

function alwaysCommittable(): boolean {
  return true;
}
