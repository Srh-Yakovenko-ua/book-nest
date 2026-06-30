"use client";

import { Command as CommandPrimitive } from "cmdk";
import { useState } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export type FilterEntityItem = {
  id: string;
  isCustom: boolean;
  name: string;
};

type FilterEntityComboboxProps = {
  clearLabel: string;
  customBadge: string;
  emptyLabel: string;
  icon: UiIconName;
  id: string;
  label: string;
  onClear: () => void;
  onSelect: (item: FilterEntityItem) => void;
  placeholder: string;
  searchingLabel: string;
  selectedName?: string;
  useSearch: (query: string) => { data?: FilterEntityItem[]; isFetching: boolean };
};

export function LibraryFilterCombobox({
  clearLabel,
  customBadge,
  emptyLabel,
  icon,
  id,
  label,
  onClear,
  onSelect,
  placeholder,
  searchingLabel,
  selectedName,
  useSearch,
}: FilterEntityComboboxProps) {
  const [query, setQuery] = useState(selectedName ?? "");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const { data: items = [], isFetching } = useSearch(debouncedQuery);

  function pick(item: FilterEntityItem) {
    onSelect(item);
    setQuery(item.name);
    setOpen(false);
  }

  function handleClear() {
    setQuery("");
    setOpen(false);
    onClear();
  }

  const showClear = selectedName !== undefined || query.length > 0;

  return (
    <CommandPrimitive label={label} shouldFilter={false}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverAnchor asChild>
          <div className="relative flex items-center">
            <UiIcon
              aria-hidden
              className="pointer-events-none absolute left-3 text-muted-foreground"
              name={icon}
              size={18}
            />
            <CommandPrimitive.Input
              autoComplete="off"
              className="h-10 w-full rounded-md border border-input bg-field pr-10 pl-10 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              id={id}
              onFocus={() => {
                if (query.trim().length >= MIN_QUERY_LENGTH) setOpen(true);
              }}
              onValueChange={(next) => {
                setQuery(next);
                setOpen(next.trim().length >= MIN_QUERY_LENGTH);
              }}
              placeholder={placeholder}
              value={query}
            />
            {showClear ? (
              <button
                aria-label={clearLabel}
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
            {isFetching && items.length === 0 ? (
              <CommandEmpty>{searchingLabel}</CommandEmpty>
            ) : null}
            {!isFetching && items.length === 0 ? <CommandEmpty>{emptyLabel}</CommandEmpty> : null}
            {items.length > 0 ? (
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    className="cursor-pointer"
                    key={item.id}
                    onSelect={() => pick(item)}
                    value={item.id}
                  >
                    <UiIcon className="text-muted-foreground" name={icon} size={16} />
                    <span className="min-w-0 truncate">{item.name}</span>
                    {item.isCustom ? (
                      <span className="ml-auto text-xs text-muted-foreground">{customBadge}</span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </PopoverContent>
      </Popover>
    </CommandPrimitive>
  );
}
