"use client";

import { Command as CommandPrimitive } from "cmdk";
import { type KeyboardEvent, useRef, useState } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

const SEARCH_DEBOUNCE_MS = 250;
const SUGGESTION_LIMIT = 8;

export type EntityItem = {
  id: string;
  isCustom: boolean;
  name: string;
};

type EntitySearchResult = {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  items: EntityItem[];
};

type LibraryEntityMultiselectProps = {
  allHeading: string;
  empty: string;
  icon: UiIconName;
  id: string;
  onAdd: (item: { id: string; name: string }) => void;
  onRemove: (id: string) => void;
  placeholder: string;
  recentHeading: string;
  removeLabel: (name: string) => string;
  resolveName: (id: string) => string | undefined;
  searching: string;
  useRecent: () => { data?: EntityItem[] };
  useSearch: (query: string) => EntitySearchResult;
  value: string[];
};

export function LibraryEntityMultiselect({
  allHeading,
  empty,
  icon,
  id,
  onAdd,
  onRemove,
  placeholder,
  recentHeading,
  removeLabel,
  resolveName,
  searching,
  useRecent,
  useSearch,
  value,
}: LibraryEntityMultiselectProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const debouncedDraft = useDebouncedValue(draft, SEARCH_DEBOUNCE_MS);
  const recent = useRecent();
  const {
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    items: searchItems,
  } = useSearch(debouncedDraft);
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    itemCount: searchItems.length,
    onLoadMore: fetchNextPage,
  });

  const query = draft.trim().toLowerCase();
  const selectedIds = new Set(value);

  function isSelectable(item: EntityItem) {
    return !selectedIds.has(item.id);
  }

  function matchesQuery(name: string) {
    return query.length === 0 || name.toLowerCase().includes(query);
  }

  const recentOptions = (recent.data ?? [])
    .filter((item) => isSelectable(item) && matchesQuery(item.name))
    .slice(0, SUGGESTION_LIMIT);
  const recentIds = new Set(recentOptions.map((item) => item.id));
  const allOptions = searchItems.filter((item) => isSelectable(item) && !recentIds.has(item.id));

  const hasOptions = recentOptions.length > 0 || allOptions.length > 0;
  const isLoading = isFetching && !hasOptions;
  const isEmpty = !isLoading && !hasOptions;

  function add(item: EntityItem) {
    if (selectedIds.has(item.id)) return;
    onAdd({ id: item.id, name: item.name });
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Backspace" || draft !== "" || value.length === 0) return;
    const lastId = value[value.length - 1];
    if (lastId === undefined) return;
    event.preventDefault();
    onRemove(lastId);
  }

  function entityItem(item: EntityItem) {
    return (
      <CommandItem
        className="cursor-pointer items-start"
        key={item.id}
        onSelect={() => add(item)}
        value={item.id}
      >
        <UiIcon className="shrink-0 text-muted-foreground" name={icon} size={16} />
        <span className="min-w-0 break-words whitespace-normal">{item.name}</span>
      </CommandItem>
    );
  }

  const inputPlaceholder = value.length > 0 ? "" : placeholder;

  return (
    <CommandPrimitive shouldFilter={false}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverAnchor asChild>
          <div
            className="flex min-h-12 cursor-text flex-wrap items-center gap-2 rounded-md border border-input bg-field px-2.5 py-2 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
            ref={anchorRef}
          >
            {value.map((entityId) => {
              const name = resolveName(entityId) ?? entityId;
              return (
                <span
                  className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-accent-border bg-accent py-0 pr-1.5 pl-3 text-[0.8125rem] font-medium whitespace-nowrap text-accent-foreground"
                  key={entityId}
                >
                  <span className="overflow-hidden text-ellipsis">{name}</span>
                  <button
                    aria-label={removeLabel(name)}
                    className="relative grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-full text-accent-foreground opacity-65 transition-[opacity,background-color] after:absolute after:-inset-[3px] hover:bg-accent-foreground/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    onClick={() => onRemove(entityId)}
                    type="button"
                  >
                    <UiIcon className="size-3" name="x" size={12} />
                  </button>
                </span>
              );
            })}
            <CommandPrimitive.Input
              aria-expanded={open}
              autoComplete="off"
              className="h-7 min-w-[90px] flex-1 border-0 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-muted-foreground"
              id={id}
              onClick={() => setOpen(true)}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              onValueChange={(next) => {
                setDraft(next);
                setOpen(true);
              }}
              placeholder={inputPlaceholder}
              value={draft}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) max-w-(--radix-popover-trigger-width) p-1"
          onInteractOutside={(event) => {
            const target = event.detail.originalEvent.target;
            if (target instanceof Node && anchorRef.current?.contains(target)) {
              event.preventDefault();
            }
          }}
          onOpenAutoFocus={(event) => event.preventDefault()}
          sideOffset={6}
        >
          <CommandList onScroll={onScroll} ref={scrollRef}>
            {isLoading ? <CommandEmpty>{searching}</CommandEmpty> : null}
            {isEmpty ? <CommandEmpty>{empty}</CommandEmpty> : null}
            {recentOptions.length > 0 ? (
              <CommandGroup heading={recentHeading}>{recentOptions.map(entityItem)}</CommandGroup>
            ) : null}
            {allOptions.length > 0 ? (
              <CommandGroup heading={allHeading}>{allOptions.map(entityItem)}</CommandGroup>
            ) : null}
            {isFetchingNextPage ? (
              <div className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                {searching}
              </div>
            ) : null}
          </CommandList>
        </PopoverContent>
      </Popover>
    </CommandPrimitive>
  );
}
