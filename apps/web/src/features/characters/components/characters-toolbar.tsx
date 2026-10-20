"use client";

import type { BookCharacterImportance, BookCharacterSummaryView, Nullable } from "@app/shared";
import type { RefObject } from "react";

import { BOOK_CHARACTER_UNSPECIFIED } from "@app/shared";
import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { FacetMultiselect } from "@/components/facet-multiselect";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LibraryActiveFilters } from "@/features/books";

import type {
  CharactersRosterFilter,
  CharactersRosterSort,
} from "../model/characters-roster-query";
import type { UseCharactersRosterQueryResult } from "../model/use-characters-roster-query";

import { BOOK_CHARACTER_IMPORTANCE } from "../model/character-options";
import {
  CHARACTERS_ROSTER_FILTERS,
  CHARACTERS_ROSTER_SORT_DEFAULT,
  CHARACTERS_ROSTER_SORTS,
} from "../model/characters-roster-query";
import { useCharactersRosterFilterChips } from "../model/use-characters-roster-filter-chips";

type CharactersToolbarProps = {
  addButtonRef: RefObject<Nullable<HTMLButtonElement>>;
  onAdd: () => void;
  roster: UseCharactersRosterQueryResult;
  summary: BookCharacterSummaryView | undefined;
  summaryPending: boolean;
};

export function CharactersToolbar({
  addButtonRef,
  onAdd,
  roster,
  summary,
  summaryPending,
}: CharactersToolbarProps) {
  const t = useTranslations("characters.toolbar");
  const filterChips = useCharactersRosterFilterChips({
    onFilterChange: roster.setFilter,
    onImportanceChange: roster.setImportance,
    onSearch: roster.setSearch,
    state: roster.state,
  });

  return (
    <div className="flex flex-col gap-3">
      <DebouncedSearchInput
        clearLabel={t("searchClear")}
        label={t("searchLabel")}
        onClear={() => roster.setSearch("")}
        onSearch={roster.setSearch}
        placeholder={t("searchPlaceholder")}
        value={roster.state.characterSearch}
      />

      <div className="flex flex-col gap-3 @3xl/roster:flex-row @3xl/roster:items-start">
        <div className="min-w-0 @3xl/roster:flex-1">
          <CharactersImportanceFilter roster={roster} summary={summary} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CharactersSort roster={roster} />

          <Button className="h-10 shrink-0 sm:ml-auto" onClick={onAdd} ref={addButtonRef}>
            <UiIcon name="plus" size={16} />
            {t("add")}
          </Button>
        </div>
      </div>

      <CharactersQuickFilters roster={roster} summary={summary} summaryPending={summaryPending} />

      <LibraryActiveFilters chips={filterChips} onClearAll={roster.clearSearchAndFilters} />
    </div>
  );
}

function CharactersImportanceFilter({
  roster,
  summary,
}: Pick<CharactersToolbarProps, "roster" | "summary">) {
  const t = useTranslations("characters.toolbar");
  const tImportance = useTranslations("characters.importance");

  return (
    <FacetMultiselect
      emptyText={t("importanceFilter.empty")}
      hideSelection
      label={t("importance")}
      onValueChange={(next) => roster.setImportance(toImportance(next))}
      options={BOOK_CHARACTER_IMPORTANCE.options.map((importance) => ({
        count: summary === undefined ? undefined : importanceCount({ importance, summary }),
        label: tImportance(importance),
        value: importance,
      }))}
      placeholder={t("importanceFilter.placeholder")}
      searchPlaceholder={t("importanceFilter.search")}
      selectedText={(count) => t("selectedCount", { count })}
      value={roster.state.characterImportance}
    />
  );
}

function CharactersQuickFilters({
  roster,
  summary,
  summaryPending,
}: Pick<CharactersToolbarProps, "roster" | "summary" | "summaryPending">) {
  const t = useTranslations("characters.toolbar");
  const counts =
    summary === undefined
      ? undefined
      : ({
          all: summary.totalVisibleCharacters,
          favorites: summary.favoritesCount,
          pov: summary.povCount,
        } satisfies Record<CharactersRosterFilter, number>);

  return (
    <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
      <ChipGroup
        className="flex-nowrap"
        countsPending={summaryPending}
        label={t("quickLabel")}
        mode="single"
        onValueChange={(next) => {
          const match = CHARACTERS_ROSTER_FILTERS.find((option) => option === next);
          if (match !== undefined) roster.setFilter(match);
        }}
        options={CHARACTERS_ROSTER_FILTERS.map((option) => ({
          count: counts?.[option],
          label: t(`quick.${option}`),
          value: option,
        }))}
        size="sm"
        value={roster.state.characterFilter}
      />
    </div>
  );
}

function CharactersSort({ roster }: Pick<CharactersToolbarProps, "roster">) {
  const t = useTranslations("characters.toolbar");
  const tSort = useTranslations("characters.sort");
  const sort = roster.state.characterSort;

  return (
    <>
      <MobileSortSheet
        className="w-full flex-none sm:hidden"
        closeLabel={t("sortMobile.close")}
        description={t("sortMobile.description")}
        groups={[
          {
            key: "sort",
            options: CHARACTERS_ROSTER_SORTS.map((value) => ({ label: tSort(value), value })),
          },
        ]}
        id="book-characters-sort"
        label={t("sortLabel")}
        onChange={roster.setSort}
        title={t("sortMobile.title")}
        triggerLabel={t(`sortMobile.trigger.${sort}`)}
        value={sort}
      />

      <div className="hidden min-w-0 sm:block sm:w-80">
        <Select onValueChange={(next) => roster.setSort(toSort(next))} value={sort}>
          <SelectTrigger aria-label={t("sortLabel")} className="w-full data-[size=default]:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHARACTERS_ROSTER_SORTS.map((option) => (
              <SelectItem key={option} value={option}>
                {tSort(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function importanceCount({
  importance,
  summary,
}: {
  importance: BookCharacterImportance;
  summary: BookCharacterSummaryView;
}): number {
  if (importance !== BOOK_CHARACTER_UNSPECIFIED.importance) {
    return summary.byImportance[importance];
  }

  const explicitTotal = Object.values(summary.byImportance).reduce(
    (total, count) => total + count,
    0,
  );
  return Math.max(0, summary.totalVisibleCharacters - explicitTotal);
}

function toImportance(values: readonly string[]): BookCharacterImportance[] {
  return BOOK_CHARACTER_IMPORTANCE.options.filter((option) => values.includes(option));
}

function toSort(value: string): CharactersRosterSort {
  return (
    CHARACTERS_ROSTER_SORTS.find((option) => option === value) ?? CHARACTERS_ROSTER_SORT_DEFAULT
  );
}
