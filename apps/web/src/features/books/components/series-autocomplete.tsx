"use client";

import type { SeriesView } from "@app/shared";

import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import type { AuthorSelection, SeriesSelection } from "../model/create-book-form";

import { useSeriesSearch } from "../api/use-series-search";

type SeriesAutocompleteProps = {
  authorSelections: AuthorSelection[];
  describedBy?: string;
  id: string;
  invalid: boolean;
  label: string;
  onChange: (selection: null | SeriesSelection) => void;
  onCreateRequest: (name: string) => void;
  placeholder: string;
  value: null | SeriesSelection;
};

const SEARCH_DEBOUNCE_MS = 250;

export function SeriesAutocomplete({
  authorSelections,
  describedBy,
  id,
  invalid,
  label,
  onChange,
  onCreateRequest,
  placeholder,
  value,
}: SeriesAutocompleteProps) {
  const t = useTranslations("books");
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [trackedValue, setTrackedValue] = useState(value);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  if (value !== trackedValue) {
    setTrackedValue(value);
    if (trackedValue !== null && value === null && query === trackedValue.name) {
      setQuery("");
    }
  }

  const catalogAuthorIds = authorSelections.flatMap((author) =>
    author.kind === "catalog" ? [author.id] : [],
  );
  const selectedAuthorNames = authorSelections
    .filter((author) => author.kind === "catalog")
    .map((author) => author.name)
    .join(", ");
  const hasAuthorFilter = catalogAuthorIds.length > 0;

  const {
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    items: series,
  } = useSeriesSearch({ authorIds: catalogAuthorIds, search: debouncedQuery });

  const authorSeries = series.filter((item) => item.authors.length > 0);
  const authorlessSeries = series.filter((item) => item.authors.length === 0);

  const trimmedQuery = query.trim();
  const hasExactMatch = series.some(
    (item) => item.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const showCreateOption = !hasExactMatch;

  function pickExisting(item: SeriesView) {
    onChange({
      authorIds: item.authors.map((author) => author.id),
      id: item.id,
      kind: "existing",
      name: item.name,
      totalBooks: item.totalBooks ?? undefined,
    });
    setQuery(item.name);
    setOpen(false);
  }

  function seriesOption(item: SeriesView, options: { showAuthors: boolean }) {
    const authorNames = item.authors.map((author) => author.name).join(", ");
    return (
      <CommandItem
        className="cursor-pointer"
        key={item.id}
        onSelect={() => pickExisting(item)}
        value={item.id}
      >
        <UiIcon className="shrink-0 text-muted-foreground" name="library" size={16} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{item.name}</span>
          {options.showAuthors && authorNames.length > 0 ? (
            <span className="truncate text-xs text-muted-foreground">{authorNames}</span>
          ) : null}
        </span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {t(`series.statusLabels.${item.status}`)}
        </span>
      </CommandItem>
    );
  }

  function requestCreate() {
    setOpen(false);
    onCreateRequest(trimmedQuery);
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setOpen(false);
  }

  const showClear = value !== null || query.length > 0;

  return (
    <CommandPrimitive label={label} shouldFilter={false}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverAnchor asChild>
          <div className="relative flex items-center">
            <UiIcon
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-3",
                invalid ? "text-destructive" : "text-muted-foreground",
              )}
              name="library"
              size={18}
            />
            <CommandPrimitive.Input
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoComplete="off"
              className={cn(
                "h-10 w-full rounded-md border border-input bg-field pl-10 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
                showClear ? "pr-10" : "pr-3",
                invalid &&
                  "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
              )}
              id={id}
              onClick={() => setOpen(true)}
              onFocus={() => setOpen(true)}
              onValueChange={(next) => {
                setQuery(next);
                setOpen(true);
                if (value !== null) onChange(null);
              }}
              placeholder={placeholder}
              value={query}
            />
            {showClear ? (
              <button
                aria-label={t("fields.clear")}
                className="absolute right-2 grid size-6 cursor-pointer place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={handleClear}
                type="button"
              >
                <UiIcon name="x" size={16} />
              </button>
            ) : null}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] min-w-[var(--radix-popover-anchor-width)] p-1"
          onOpenAutoFocus={(event) => event.preventDefault()}
          sideOffset={6}
        >
          <CommandList>
            {isFetching && series.length === 0 ? (
              <CommandEmpty>{t("series.searching")}</CommandEmpty>
            ) : null}
            {!isFetching && series.length === 0 && !showCreateOption ? (
              <CommandEmpty>{t("series.empty")}</CommandEmpty>
            ) : null}
            {hasAuthorFilter ? (
              <>
                {authorSeries.length > 0 ? (
                  <CommandGroup heading={t("series.authorHeading", { name: selectedAuthorNames })}>
                    {authorSeries.map((item) => seriesOption(item, { showAuthors: false }))}
                  </CommandGroup>
                ) : null}
                {authorlessSeries.length > 0 ? (
                  <CommandGroup heading={t("series.noAuthorHeading")}>
                    {authorlessSeries.map((item) => seriesOption(item, { showAuthors: false }))}
                  </CommandGroup>
                ) : null}
              </>
            ) : series.length > 0 ? (
              <CommandGroup heading={t("series.yourSeries")}>
                {series.map((item) => seriesOption(item, { showAuthors: true }))}
              </CommandGroup>
            ) : null}
            {hasNextPage ? (
              <CommandGroup>
                <CommandItem
                  className="cursor-pointer justify-center text-sm text-muted-foreground"
                  disabled={isFetchingNextPage}
                  onSelect={() => void fetchNextPage()}
                  value="__load_more__"
                >
                  <UiIcon
                    className={isFetchingNextPage ? "animate-spin" : undefined}
                    name={isFetchingNextPage ? "refresh" : "chevron-down"}
                    size={16}
                  />
                  {isFetchingNextPage ? t("series.searching") : t("series.loadMore")}
                </CommandItem>
              </CommandGroup>
            ) : null}
            {showCreateOption ? (
              <CommandGroup heading={t("series.createHeading")}>
                <CommandItem className="cursor-pointer" onSelect={requestCreate} value="__create__">
                  <UiIcon className="text-primary" name="plus" size={16} />
                  <span className="min-w-0 truncate">
                    {trimmedQuery.length > 0
                      ? t("series.createAction", { name: trimmedQuery })
                      : t("series.createNew")}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </PopoverContent>
      </Popover>
    </CommandPrimitive>
  );
}
