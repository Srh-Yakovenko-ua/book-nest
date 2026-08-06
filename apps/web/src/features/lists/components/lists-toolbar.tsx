"use client";

import type { ListSort } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { LIST_SORT_DEFAULT, LIST_SORT_OPTIONS } from "../model/lists-derive";

type ListsToolbarProps = {
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onSortChange: (value: ListSort) => void;
  search: string;
  sort: ListSort;
};

export function ListsToolbar({
  onSearchChange,
  onSearchClear,
  onSortChange,
  search,
  sort,
}: ListsToolbarProps) {
  const t = useTranslations("lists.catalog");
  const tSort = useTranslations("lists.catalog.sort");
  const tCommon = useTranslations("common");

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
          aria-label={t("search.placeholder")}
          autoComplete="off"
          className={cn(
            "h-10 w-full rounded-md border border-input bg-field pr-10 pl-10 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
          enterKeyHint="search"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("search.placeholder")}
          type="text"
          value={search}
        />
        {search.length > 0 ? (
          <button
            aria-label={t("noResults.clear")}
            className="absolute right-2 grid size-6 cursor-pointer place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={onSearchClear}
            type="button"
          >
            <UiIcon name="x" size={16} />
          </button>
        ) : null}
      </div>

      <div className="w-full sm:w-56">
        <Select onValueChange={(next) => onSortChange(next as ListSort)} value={sort}>
          <SelectTrigger
            aria-label={t("sort.label")}
            className="h-10 w-full data-[size=default]:h-10"
            clearLabel={tCommon("clear")}
            isClearable={sort !== LIST_SORT_DEFAULT}
            onClear={() => onSortChange(LIST_SORT_DEFAULT)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIST_SORT_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {tSort(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
