"use client";

import type { SeriesView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { UiIcon } from "@/components/icons";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import type { SeriesSelection } from "../model/create-book-form";

import { useSeriesSearch } from "../api/use-series-search";

type SeriesAutocompleteProps = {
  describedBy?: string;
  id: string;
  invalid: boolean;
  onChange: (selection: null | SeriesSelection) => void;
  onCreateRequest: (name: string) => void;
  placeholder: string;
  value: null | SeriesSelection;
};

const SEARCH_DEBOUNCE_MS = 250;

export function SeriesAutocomplete({
  describedBy,
  id,
  invalid,
  onChange,
  onCreateRequest,
  placeholder,
  value,
}: SeriesAutocompleteProps) {
  const t = useTranslations("books");
  const listId = useId();
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const { data: series = [], isFetching } = useSeriesSearch(debouncedQuery);

  const trimmedQuery = query.trim();
  const hasExactMatch = series.some(
    (item) => item.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const showCreateOption = !hasExactMatch;

  function pickExisting(item: SeriesView) {
    onChange({
      id: item.id,
      kind: "existing",
      name: item.name,
      totalBooks: item.totalBooks ?? undefined,
    });
    setQuery(item.name);
    setOpen(false);
  }

  function requestCreate() {
    setOpen(false);
    onCreateRequest(trimmedQuery);
  }

  return (
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
          <input
            aria-autocomplete="list"
            aria-controls={open ? listId : undefined}
            aria-describedby={describedBy}
            aria-expanded={open}
            aria-invalid={invalid}
            autoComplete="off"
            className={cn(
              "h-10 w-full rounded-md border border-input bg-field pr-3 pl-10 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
              invalid &&
                "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
            )}
            id={id}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              if (value !== null) onChange(null);
            }}
            onClick={() => setOpen(true)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            role="combobox"
            type="text"
            value={query}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] min-w-[var(--radix-popover-anchor-width)] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        sideOffset={6}
      >
        <Command id={listId} shouldFilter={false}>
          <CommandList>
            {isFetching && series.length === 0 ? (
              <CommandEmpty>{t("series.searching")}</CommandEmpty>
            ) : null}
            {!isFetching && series.length === 0 && !showCreateOption ? (
              <CommandEmpty>{t("series.empty")}</CommandEmpty>
            ) : null}
            {series.length > 0 ? (
              <CommandGroup heading={t("series.existingHeading")}>
                {series.map((item) => (
                  <CommandItem
                    className="cursor-pointer"
                    key={item.id}
                    onSelect={() => pickExisting(item)}
                    value={item.id}
                  >
                    <UiIcon className="text-muted-foreground" name="library" size={16} />
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t(`series.statusLabels.${item.status}`)}
                    </span>
                  </CommandItem>
                ))}
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
        </Command>
      </PopoverContent>
    </Popover>
  );
}
