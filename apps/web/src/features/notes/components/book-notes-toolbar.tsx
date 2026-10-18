"use client";

import { useTranslations } from "next-intl";

import type { FacetOption } from "@/components/facet-multiselect";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { FacetMultiselect } from "@/components/facet-multiselect";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { NotesArchiveFacets } from "../api/use-notes-facets";
import type { UseBookNotesTabQueryResult } from "../model/use-book-notes-tab-query";

import { BOOK_NOTES_TAB, toBookNotesTabSort } from "../model/book-notes-tab-query";
import { isNotesSearchCommittable } from "../model/notes-archive-query";
import {
  customCategorySelectionValue,
  fromCategorySelectionValues,
  standardCategorySelectionValue,
  toCategorySelectionValues,
} from "../model/notes-category-selection";
import { NotesQuickChips } from "./notes-quick-chips";

type BookNotesToolbarProps = {
  facets: NotesArchiveFacets | undefined;
  facetsPending: boolean;
  onAddNote: () => void;
  query: Pick<
    UseBookNotesTabQueryResult,
    "clearSearch" | "setCategories" | "setFilter" | "setSearch" | "setSort" | "state"
  >;
};

export function BookNotesToolbar({
  facets,
  facetsPending,
  onAddNote,
  query,
}: BookNotesToolbarProps) {
  const t = useTranslations("notes");
  const { state } = query;

  return (
    <div className="@container flex flex-col gap-3">
      <DebouncedSearchInput
        clearLabel={t("archive.toolbar.searchClear")}
        isCommittable={(value) => isNotesSearchCommittable(BOOK_NOTES_TAB.searchRule, value)}
        label={t("bookTab.searchLabel")}
        onClear={query.clearSearch}
        onSearch={query.setSearch}
        placeholder={t("bookTab.searchPlaceholder")}
        value={state.noteQ}
      />

      <div className="flex flex-col gap-3 sm:@lg:flex-row sm:@lg:items-start">
        <div className="min-w-0 sm:@lg:flex-1">
          <BookNotesCategoryFilter facets={facets} query={query} />
        </div>

        <BookNotesSort query={query} />

        <Button className="h-10 shrink-0" onClick={onAddNote}>
          <UiIcon name="plus" size={16} />
          {t("archive.addNote")}
        </Button>
      </div>

      <NotesQuickChips
        counts={facets?.quickCounts}
        countsPending={facetsPending}
        onChange={query.setFilter}
        value={state.noteFilter}
      />
    </div>
  );
}

function BookNotesCategoryFilter({
  facets,
  query,
}: Pick<BookNotesToolbarProps, "facets" | "query">) {
  const t = useTranslations("notes.archive.advancedFilters");
  const tCategories = useTranslations("notes.categories");

  const options: FacetOption[] = [
    ...(facets?.categories ?? []).map(({ category, count }) => ({
      count,
      label: tCategories(category),
      value: standardCategorySelectionValue(category),
    })),
    ...(facets?.customCategories ?? []).map(({ count, value }) => ({
      count,
      label: tCategories("custom", { value }),
      value: customCategorySelectionValue(value),
    })),
  ];

  return (
    <FacetMultiselect
      emptyText={t("fields.category.empty")}
      label={t("sections.category")}
      onValueChange={(next) => query.setCategories(fromCategorySelectionValues(next))}
      options={options}
      placeholder={t("fields.category.placeholder")}
      searchPlaceholder={t("fields.category.search")}
      selectedText={(count) => t("selected", { count })}
      value={toCategorySelectionValues({
        category: query.state.noteCategory,
        customCategory: query.state.noteCustomCategory,
      })}
    />
  );
}

function BookNotesSort({ query }: Pick<BookNotesToolbarProps, "query">) {
  const t = useTranslations("notes.archive");
  const tCommon = useTranslations("common");
  const sort = query.state.noteSort;

  return (
    <>
      <MobileSortSheet
        className="w-full flex-none sm:hidden"
        closeLabel={t("sortMobile.close")}
        description={t("sortMobile.description")}
        groups={[
          {
            key: "sort",
            options: BOOK_NOTES_TAB.sortOptions.map((value) => ({
              label: t(`sort.${value}`),
              value,
            })),
          },
        ]}
        id="book-notes-sort"
        label={t("toolbar.sortLabel")}
        onChange={query.setSort}
        title={t("sortMobile.title")}
        triggerLabel={t(`sortMobile.trigger.${sort}`)}
        value={sort}
      />

      <div className="hidden min-w-0 sm:block sm:@lg:flex-1">
        <Select onValueChange={(next) => query.setSort(toBookNotesTabSort(next))} value={sort}>
          <SelectTrigger
            aria-label={t("toolbar.sortLabel")}
            className="w-full data-[size=default]:h-10"
            clearLabel={tCommon("clear")}
            isClearable={sort !== BOOK_NOTES_TAB.sortDefault}
            onClear={() => query.setSort(BOOK_NOTES_TAB.sortDefault)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOOK_NOTES_TAB.sortOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`sort.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
