"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { TagFilter, TagSort } from "../model/tags-derive";

import { TAG_FILTERS, TAG_SORT_DEFAULT, TAG_SORT_OPTIONS } from "../model/tags-derive";

type TagsToolbarProps = {
  onSearchChange: (value: string) => void;
  onTagFilterChange: (value: TagFilter) => void;
  onTagSortChange: (value: TagSort) => void;
  search: string;
  tagFilter: TagFilter;
  tagSort: TagSort;
};

export function TagsToolbar({
  onSearchChange,
  onTagFilterChange,
  onTagSortChange,
  search,
  tagFilter,
  tagSort,
}: TagsToolbarProps) {
  const t = useTranslations("tags.toolbar");
  const tCommon = useTranslations("common");
  const tTagSort = useTranslations("tags.tagSort");
  const tTagFilter = useTranslations("tags.tagFilter");
  const tSortMobile = useTranslations("tags.sortMobile");

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex items-center gap-1.5 lg:flex-1">
        <div className="relative flex min-w-0 flex-1 items-center">
          <UiIcon
            aria-hidden
            className="pointer-events-none absolute left-3 text-muted-foreground"
            name="search"
            size={18}
          />
          <input
            aria-label={t("searchTagsLabel")}
            autoComplete="off"
            className="h-10 w-full rounded-md border border-input bg-field pr-10 pl-10 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            enterKeyHint="search"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("searchTagsPlaceholder")}
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

        <MobileSortSheet
          className="max-w-[9.5rem] sm:hidden"
          closeLabel={tSortMobile("close")}
          description={tSortMobile("tagDescription")}
          groups={[
            {
              key: "tagSort",
              options: TAG_SORT_OPTIONS.map((value) => ({ label: tTagSort(value), value })),
            },
          ]}
          id="tags-sort"
          label={t("sortLabel")}
          onChange={onTagSortChange}
          title={tSortMobile("title")}
          triggerLabel={tSortMobile(`tagTrigger.${tagSort}`)}
          value={tagSort}
        />
      </div>

      <div className="flex items-center gap-1.5 sm:flex-wrap sm:gap-2.5">
        <ToolbarSelect
          label={t("tagFilterLabel")}
          onChange={onTagFilterChange}
          options={TAG_FILTERS.map((value) => ({ label: tTagFilter(value), value }))}
          value={tagFilter}
        />
        <ToolbarSelect
          className="max-sm:hidden"
          clearable={tagSort !== TAG_SORT_DEFAULT}
          clearLabel={tCommon("clear")}
          label={t("sortLabel")}
          onChange={onTagSortChange}
          onClear={() => onTagSortChange(TAG_SORT_DEFAULT)}
          options={TAG_SORT_OPTIONS.map((value) => ({ label: tTagSort(value), value }))}
          value={tagSort}
        />
      </div>
    </div>
  );
}

function ToolbarSelect<TValue extends string>({
  className,
  clearable = false,
  clearLabel,
  label,
  onChange,
  onClear,
  options,
  value,
}: {
  className?: string;
  clearable?: boolean;
  clearLabel?: string;
  label: string;
  onChange: (value: TValue) => void;
  onClear?: () => void;
  options: { label: string; value: TValue }[];
  value: TValue;
}) {
  return (
    <div className={cn("min-w-0 max-sm:flex-1 sm:w-52", className)}>
      <Select onValueChange={(next) => onChange(next as TValue)} value={value}>
        <SelectTrigger
          aria-label={label}
          className="w-full data-[size=default]:h-10 max-sm:text-xs max-sm:data-[size=default]:h-9"
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
