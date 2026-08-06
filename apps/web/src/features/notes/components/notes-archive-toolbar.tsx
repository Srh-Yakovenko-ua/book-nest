"use client";

import type { NoteEntityFilter, NoteFilter, NoteSort, Nullable } from "@app/shared";

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

import type {
  NotesArchiveQueryState,
  NotesCategorySelection,
  NotesPresence,
} from "../model/notes-archive-query";

import { NOTE_CATEGORY_OPTIONS } from "../model/note-categories";
import {
  customCategorySelectValue,
  NOTES_CATEGORY_ANY,
  NOTES_ENTITY_FILTER_OPTIONS,
  NOTES_PRESENCE_OPTIONS,
  NOTES_QUICK_FILTER_OPTIONS,
  NOTES_SORT_DEFAULT,
  NOTES_SORT_OPTIONS,
  notesCategorySelectValue,
  parseCategorySelectValue,
  presenceToFlag,
  presenceValue,
} from "../model/notes-archive-query";

type NotesArchiveToolbarProps = {
  availableCustomCategories: string[];
  onCategoryChange: (selection: NotesCategorySelection) => void;
  onEntityTypeChange: (value: NoteEntityFilter) => void;
  onFilterChange: (value: NoteFilter) => void;
  onHasChapterChange: (value: Nullable<boolean>) => void;
  onHasPageChange: (value: Nullable<boolean>) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: NoteSort) => void;
  state: NotesArchiveQueryState;
};

export function NotesArchiveToolbar({
  availableCustomCategories,
  onCategoryChange,
  onEntityTypeChange,
  onFilterChange,
  onHasChapterChange,
  onHasPageChange,
  onSearchChange,
  onSortChange,
  state,
}: NotesArchiveToolbarProps) {
  const t = useTranslations("notes.archive.toolbar");
  const tCommon = useTranslations("common");
  const tCategories = useTranslations("notes.categories");
  const tEntity = useTranslations("notes.archive.entityFilter");
  const tFilter = useTranslations("notes.archive.quickFilter");
  const tPresence = useTranslations("notes.archive.presence");
  const tSort = useTranslations("notes.archive.sort");
  const tSortMobile = useTranslations("notes.archive.sortMobile");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 lg:flex-row lg:items-center lg:gap-3">
        <div className="min-w-0 flex-1">
          <DebouncedSearchInput
            clearLabel={t("searchClear")}
            label={t("searchLabel")}
            onClear={() => onSearchChange("")}
            onSearch={onSearchChange}
            placeholder={t("searchPlaceholder")}
            value={state.search}
          />
        </div>

        <MobileSortSheet
          className="max-w-[9.5rem] sm:hidden"
          closeLabel={tSortMobile("close")}
          groups={[
            {
              key: "sort",
              options: NOTES_SORT_OPTIONS.map((value) => ({ label: tSort(value), value })),
            },
          ]}
          id="notes-sort"
          label={t("sortLabel")}
          onChange={onSortChange}
          title={tSortMobile("title")}
          triggerLabel={tSortMobile(`trigger.${state.sort}`)}
          value={state.sort}
        />

        <div className="hidden sm:block sm:w-64 lg:w-64">
          <Select
            onValueChange={(next) => {
              const match = NOTES_SORT_OPTIONS.find((option) => option === next);
              if (match !== undefined) onSortChange(match);
            }}
            value={state.sort}
          >
            <SelectTrigger
              aria-label={t("sortLabel")}
              className="w-full data-[size=default]:h-10"
              clearLabel={tCommon("clear")}
              isClearable={state.sort !== NOTES_SORT_DEFAULT}
              onClear={() => onSortChange(NOTES_SORT_DEFAULT)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTES_SORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {tSort(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={t("quickFilterLabel")}
          mode="single"
          onValueChange={(next) => {
            const match = NOTES_QUICK_FILTER_OPTIONS.find((option) => option === next);
            if (match !== undefined) onFilterChange(match);
          }}
          options={NOTES_QUICK_FILTER_OPTIONS.map((option) => ({
            label: tFilter(option),
            value: option,
          }))}
          size="sm"
          value={state.filter}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
        <ToolbarSelect
          label={t("entityLabel")}
          onValueChange={(next) => {
            const match = NOTES_ENTITY_FILTER_OPTIONS.find((option) => option === next);
            if (match !== undefined) onEntityTypeChange(match);
          }}
          value={state.entityType}
        >
          {NOTES_ENTITY_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {tEntity(option)}
            </SelectItem>
          ))}
        </ToolbarSelect>

        <ToolbarSelect
          label={t("categoryLabel")}
          onValueChange={(next) => onCategoryChange(parseCategorySelectValue(next))}
          value={notesCategorySelectValue(state)}
        >
          <SelectItem value={NOTES_CATEGORY_ANY}>{t("categoryAny")}</SelectItem>
          {NOTE_CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {tCategories(option)}
            </SelectItem>
          ))}
          {availableCustomCategories.map((custom) => (
            <SelectItem key={custom} value={customCategorySelectValue(custom)}>
              {tCategories("custom", { value: custom })}
            </SelectItem>
          ))}
        </ToolbarSelect>

        <ToolbarSelect
          label={t("pageLabel")}
          onValueChange={(next) => onHasPageChange(presenceToFlag(toPresence(next)))}
          value={presenceValue(state.hasPage)}
        >
          {NOTES_PRESENCE_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {tPresence(`page.${option}`)}
            </SelectItem>
          ))}
        </ToolbarSelect>

        <ToolbarSelect
          label={t("chapterLabel")}
          onValueChange={(next) => onHasChapterChange(presenceToFlag(toPresence(next)))}
          value={presenceValue(state.hasChapter)}
        >
          {NOTES_PRESENCE_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {tPresence(`chapter.${option}`)}
            </SelectItem>
          ))}
        </ToolbarSelect>
      </div>
    </div>
  );
}

export function NotesArchiveToolbarSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-10 w-full rounded-md lg:flex-1" />
        <Skeleton className="h-10 w-full rounded-md lg:w-64" />
      </div>
      <div className="flex flex-wrap gap-2">
        {NOTES_QUICK_FILTER_OPTIONS.map((option) => (
          <Skeleton className="h-8 w-24 rounded-full" key={option} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2.5">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-10 w-full rounded-md sm:w-52" key={index} />
        ))}
      </div>
    </div>
  );
}

function ToolbarSelect({
  children,
  label,
  onValueChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  onValueChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="w-full min-w-0 sm:w-52">
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger aria-label={label} className="w-full data-[size=default]:h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function toPresence(value: string): NotesPresence {
  return NOTES_PRESENCE_OPTIONS.find((option) => option === value) ?? "any";
}
