"use client";

import type { Nullable } from "@app/shared";

import { useId, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { cn } from "@/lib/utils";

const ENTITY_SEARCH_SELECT = {
  searchDebounceMs: 250,
} as const;

export type EntitySearchResult = {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  items: EntitySearchOption[];
};

type EntitySearchOption = {
  detail: string;
  id: string;
  name: string;
};

type EntitySearchSelectLabels = {
  clear: string;
  empty: string;
  placeholder: string;
  search: string;
  searching: string;
};

type EntitySearchSelectProps = {
  label: string;
  labels: EntitySearchSelectLabels;
  onChange: (value: Nullable<string>) => void;
  selectedName: string | undefined;
  useSearch: (query: string) => EntitySearchResult;
  value: Nullable<string>;
};

export function EntitySearchSelect({
  label,
  labels,
  onChange,
  selectedName,
  useSearch,
  value,
}: EntitySearchSelectProps) {
  const triggerId = useId();
  const labelId = `${triggerId}-label`;
  const valueId = `${triggerId}-value`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Nullable<EntitySearchOption>>(null);
  const debouncedQuery = useDebouncedValue(query, ENTITY_SEARCH_SELECT.searchDebounceMs);
  const search = useSearch(debouncedQuery);
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage: search.hasNextPage,
    isFetchingNextPage: search.isFetchingNextPage,
    itemCount: search.items.length,
    onLoadMore: search.fetchNextPage,
  });

  function triggerText(): string {
    if (value === null) return labels.placeholder;
    if (picked?.id === value) return picked.name;
    return selectedName ?? labels.searching;
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  function select(option: EntitySearchOption) {
    setPicked(option);
    onChange(option.id);
    handleOpenChange(false);
  }

  function clear() {
    onChange(null);
    triggerRef.current?.focus();
  }

  return (
    <div className="flex items-center gap-2">
      <Popover onOpenChange={handleOpenChange} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-labelledby={`${labelId} ${valueId}`}
            className="h-10 min-w-0 flex-1 justify-between"
            ref={triggerRef}
            type="button"
            variant="secondary"
          >
            <span className="sr-only" id={labelId}>
              {label}
            </span>
            <span
              className={cn("truncate", value === null && "text-muted-foreground")}
              id={valueId}
            >
              {triggerText()}
            </span>
            <UiIcon
              className={cn("shrink-0 transition-transform", open && "rotate-180")}
              name="chevron-down"
              size={16}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command label={label} shouldFilter={false}>
            <CommandInput onValueChange={setQuery} placeholder={labels.search} value={query} />
            <CommandList label={label} onScroll={onScroll} ref={scrollRef}>
              <CommandEmpty>{search.isFetching ? labels.searching : labels.empty}</CommandEmpty>
              {search.items.map((option) => (
                <CommandItem
                  aria-checked={option.id === value}
                  className="cursor-pointer gap-2.5"
                  data-checked={option.id === value}
                  key={option.id}
                  onSelect={() => select(option)}
                  value={option.id}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{option.name}</span>
                    {option.detail === "" ? null : (
                      <span className="truncate text-xs text-muted-foreground">
                        {option.detail}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
              {search.isFetchingNextPage ? (
                <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                  {labels.searching}
                </div>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value === null ? null : (
        <Button
          aria-label={labels.clear}
          className="size-10 shrink-0"
          onClick={clear}
          size="icon"
          type="button"
          variant="ghost"
        >
          <UiIcon name="x" size={16} />
        </Button>
      )}
    </div>
  );
}
