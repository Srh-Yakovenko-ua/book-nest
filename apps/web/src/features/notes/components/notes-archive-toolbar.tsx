"use client";

import type { Nullable } from "@app/shared";

import { NOTE_ARCHIVE_SORT_DEFAULT } from "@app/shared";
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
import { Skeleton } from "@/components/ui/skeleton";

import type { NotesArchiveFacets } from "../api/use-notes-facets";
import type { UseNotesArchiveQueryResult } from "../model/use-notes-archive-query";

import {
  isNotesSearchCommittable,
  NOTES_ARCHIVE,
  notesAdvancedValues,
} from "../model/notes-archive-query";
import { NotesActiveFilters } from "./notes-active-filters";
import { NotesAdvancedFilters } from "./notes-advanced-filters";
import { NotesQuickChips } from "./notes-quick-chips";

type NotesArchiveToolbarProps = {
  counter: Nullable<string>;
  facets: NotesArchiveFacets | undefined;
  query: UseNotesArchiveQueryResult;
};

export function NotesArchiveToolbar({ counter, facets, query }: NotesArchiveToolbarProps) {
  const t = useTranslations("notes.archive");
  const tCommon = useTranslations("common");
  const { config, state } = query;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 lg:flex-1">
          <DebouncedSearchInput
            clearLabel={t("toolbar.searchClear")}
            isCommittable={(value) => isNotesSearchCommittable(config.searchRule, value)}
            label={t(`${config.scope}.searchLabel`)}
            onClear={() => query.setSearch("")}
            onSearch={query.setSearch}
            placeholder={t(`${config.scope}.searchPlaceholder`)}
            value={state.q}
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <MobileSortSheet
            className="max-w-[9.5rem] sm:hidden"
            closeLabel={t("sortMobile.close")}
            description={t("sortMobile.description")}
            groups={[
              {
                key: "sort",
                options: config.sortOptions.map((value) => ({
                  label: t(`sort.${value}`),
                  value,
                })),
              },
            ]}
            id={`notes-${config.scope}-sort`}
            label={t("toolbar.sortLabel")}
            onChange={query.setSort}
            title={t("sortMobile.title")}
            triggerLabel={t(`sortMobile.trigger.${state.sort}`)}
            value={state.sort}
          />

          <div className="hidden sm:block sm:w-56 xl:w-64">
            <Select onValueChange={query.setSort} value={state.sort}>
              <SelectTrigger
                aria-label={t("toolbar.sortLabel")}
                className="w-full data-[size=default]:h-10"
                clearLabel={tCommon("clear")}
                isClearable={state.sort !== NOTE_ARCHIVE_SORT_DEFAULT}
                onClear={() => query.setSort(NOTE_ARCHIVE_SORT_DEFAULT)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.sortOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`sort.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <NotesAdvancedFilters
            activeCount={query.activeDimensionCount}
            config={config}
            facets={facets}
            onApply={query.applyAdvanced}
            values={notesAdvancedValues(state)}
          />

          <Segmented
            className="ml-auto h-10 shrink-0 items-stretch [&_[data-slot=segmented-item]]:py-0 max-sm:[&_[data-slot=segmented-item]]:px-2.5"
            label={t("view.label")}
            onValueChange={(next) => query.setView(next === "list" ? "list" : "grid")}
            options={[
              {
                icon: <LayoutGrid />,
                label: <span className="max-sm:sr-only">{t("view.grid")}</span>,
                value: "grid",
              },
              {
                icon: <List />,
                label: <span className="max-sm:sr-only">{t("view.list")}</span>,
                value: "list",
              },
            ]}
            value={state.view}
          />
        </div>
      </div>

      <NotesQuickChips
        counts={facets?.quickCounts}
        onChange={query.setFilter}
        value={state.filter}
      />

      <NotesActiveFilters
        entries={query.activeFilters}
        facets={facets}
        onClearAll={query.clearAll}
        onRemove={query.removeFilter}
      />

      {counter === null ? null : (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {counter}
        </p>
      )}
    </div>
  );
}

export function NotesArchiveToolbarSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-10 min-w-0 rounded-md lg:flex-1" />
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Skeleton className="h-10 w-[9.5rem] shrink-0 rounded-md sm:hidden" />
          <Skeleton className="hidden h-10 rounded-md sm:block sm:w-56 xl:w-64" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-md sm:w-28" />
          <Skeleton className="ml-auto h-10 w-20 shrink-0 rounded-full sm:w-40" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {NOTES_ARCHIVE.quickFilters.map((option) => (
          <Skeleton className="h-8 w-24 rounded-full" key={option} />
        ))}
      </div>
    </div>
  );
}
