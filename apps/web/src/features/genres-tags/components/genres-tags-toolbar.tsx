"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { GenreFilter, GenreGroupOption, GenreSort } from "../model/genres-derive";
import type { GenresTagsTab } from "../model/genres-tags-params";
import type { TagFilter, TagSort } from "../model/tags-derive";

import {
  GENRE_FILTERS,
  GENRE_GROUP_ALL,
  GENRE_SORT_DEFAULT,
  GENRE_SORT_OPTIONS,
} from "../model/genres-derive";
import { TAG_FILTERS, TAG_SORT_DEFAULT, TAG_SORT_OPTIONS } from "../model/tags-derive";

type GenresTagsToolbarProps = {
  genreFilter: GenreFilter;
  genreGroup: string;
  genreGroups: GenreGroupOption[];
  genreSort: GenreSort;
  onGenreFilterChange: (value: GenreFilter) => void;
  onGenreGroupChange: (value: string) => void;
  onGenreSortChange: (value: GenreSort) => void;
  onSearchChange: (value: string) => void;
  onTagFilterChange: (value: TagFilter) => void;
  onTagSortChange: (value: TagSort) => void;
  search: string;
  tab: GenresTagsTab;
  tagFilter: TagFilter;
  tagSort: TagSort;
};

export function GenresTagsToolbar({
  genreFilter,
  genreGroup,
  genreGroups,
  genreSort,
  onGenreFilterChange,
  onGenreGroupChange,
  onGenreSortChange,
  onSearchChange,
  onTagFilterChange,
  onTagSortChange,
  search,
  tab,
  tagFilter,
  tagSort,
}: GenresTagsToolbarProps) {
  const t = useTranslations("genresTags.toolbar");
  const tCommon = useTranslations("common");
  const tGenreSort = useTranslations("genresTags.genreSort");
  const tGenreFilter = useTranslations("genresTags.genreFilter");
  const tTagSort = useTranslations("genresTags.tagSort");
  const tTagFilter = useTranslations("genresTags.tagFilter");

  const isGenres = tab === "genres";

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex items-center lg:flex-1">
        <UiIcon
          aria-hidden
          className="pointer-events-none absolute left-3 text-muted-foreground"
          name="search"
          size={18}
        />
        <input
          aria-label={isGenres ? t("searchGenresLabel") : t("searchTagsLabel")}
          autoComplete="off"
          className="h-10 w-full rounded-md border border-input bg-field pr-10 pl-10 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          enterKeyHint="search"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={isGenres ? t("searchGenresPlaceholder") : t("searchTagsPlaceholder")}
          type="text"
          value={search}
        />
        {search.length > 0 ? (
          <button
            aria-label={t("searchClear")}
            className="absolute right-2 grid size-6 cursor-pointer place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={() => onSearchChange("")}
            type="button"
          >
            <UiIcon name="x" size={16} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {isGenres ? (
          <>
            <ToolbarSelect
              label={t("genreFilterLabel")}
              onChange={onGenreFilterChange}
              options={GENRE_FILTERS.map((value) => ({ label: tGenreFilter(value), value }))}
              value={genreFilter}
            />
            <ToolbarSelect
              label={t("genreGroupLabel")}
              onChange={onGenreGroupChange}
              options={[
                { label: t("genreGroupAll"), value: GENRE_GROUP_ALL },
                ...genreGroups.map((group) => ({ label: group.name, value: group.key })),
              ]}
              value={genreGroup}
            />
            <ToolbarSelect
              clearable={genreSort !== GENRE_SORT_DEFAULT}
              clearLabel={tCommon("clear")}
              label={t("sortLabel")}
              onChange={onGenreSortChange}
              onClear={() => onGenreSortChange(GENRE_SORT_DEFAULT)}
              options={GENRE_SORT_OPTIONS.map((value) => ({ label: tGenreSort(value), value }))}
              value={genreSort}
            />
          </>
        ) : (
          <>
            <ToolbarSelect
              label={t("tagFilterLabel")}
              onChange={onTagFilterChange}
              options={TAG_FILTERS.map((value) => ({ label: tTagFilter(value), value }))}
              value={tagFilter}
            />
            <ToolbarSelect
              clearable={tagSort !== TAG_SORT_DEFAULT}
              clearLabel={tCommon("clear")}
              label={t("sortLabel")}
              onChange={onTagSortChange}
              onClear={() => onTagSortChange(TAG_SORT_DEFAULT)}
              options={TAG_SORT_OPTIONS.map((value) => ({ label: tTagSort(value), value }))}
              value={tagSort}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ToolbarSelect<TValue extends string>({
  clearable = false,
  clearLabel,
  label,
  onChange,
  onClear,
  options,
  value,
}: {
  clearable?: boolean;
  clearLabel?: string;
  label: string;
  onChange: (value: TValue) => void;
  onClear?: () => void;
  options: { label: string; value: TValue }[];
  value: TValue;
}) {
  return (
    <div className="w-full sm:w-52">
      <Select onValueChange={(next) => onChange(next as TValue)} value={value}>
        <SelectTrigger
          aria-label={label}
          className="w-full data-[size=default]:h-10"
          clearLabel={clearLabel}
          isClearable={clearable}
          onClear={onClear}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
