"use client";

import { TAG_COLOR_DEFAULT } from "@app/shared";
import { Command as CommandPrimitive } from "cmdk";
import { useRef, useState } from "react";

import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { TagChip, TagChipRemoveButton } from "@/features/tags/components/tag-chip";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

import { useSelectedTags, useTagsSearch } from "../api/use-tags-search";

const SEARCH_DEBOUNCE_MS = 250;

export type TagSelection = {
  id: string;
  name: string;
};

type LibraryTagFilterProps = {
  emptyLabel: string;
  id: string;
  label: string;
  onAdd: (tag: TagSelection) => void;
  onRemove: (id: string) => void;
  placeholder: string;
  removeLabel: (name: string) => string;
  resolveName: (id: string) => string | undefined;
  searchingLabel: string;
  suggestionsHeading: string;
  value: string[];
};

export function LibraryTagFilter({
  emptyLabel,
  id,
  label,
  onAdd,
  onRemove,
  placeholder,
  removeLabel,
  resolveName,
  searchingLabel,
  suggestionsHeading,
  value,
}: LibraryTagFilterProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const {
    data: tags = [],
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useTagsSearch(debouncedQuery);

  const selectedTags = useSelectedTags(value);
  const selected = new Set(value);
  const suggestions = tags.filter((tag) => !selected.has(tag.id));
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    itemCount: suggestions.length,
    onLoadMore: fetchNextPage,
  });
  const isEmpty = !isFetching && suggestions.length === 0;

  function add(tag: TagSelection) {
    onAdd(tag);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-2">
      <CommandPrimitive label={label} shouldFilter={false}>
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverAnchor asChild>
            <div className="relative flex items-center" ref={anchorRef}>
              <CommandPrimitive.Input
                autoComplete="off"
                className="h-10 w-full rounded-md border border-input bg-field px-3 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                id={id}
                onClick={() => setOpen(true)}
                onFocus={() => setOpen(true)}
                onValueChange={(next) => {
                  setQuery(next);
                  setOpen(true);
                }}
                placeholder={placeholder}
                value={query}
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="w-[--radix-popover-trigger-width] min-w-[var(--radix-popover-anchor-width)] p-1"
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
              {isFetching && suggestions.length === 0 ? (
                <CommandEmpty>{searchingLabel}</CommandEmpty>
              ) : null}
              {isEmpty ? <CommandEmpty>{emptyLabel}</CommandEmpty> : null}
              {suggestions.length > 0 ? (
                <CommandGroup heading={suggestionsHeading}>
                  {suggestions.map((tag) => (
                    <CommandItem
                      className="cursor-pointer [&>svg:last-child]:hidden"
                      key={tag.id}
                      onSelect={() => add({ id: tag.id, name: tag.name })}
                      value={tag.id}
                    >
                      <TagChip className="py-0.5 text-xs" color={tag.color} name={tag.name} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {isFetchingNextPage ? (
                <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                  {searchingLabel}
                </div>
              ) : null}
            </CommandList>
          </PopoverContent>
        </Popover>
      </CommandPrimitive>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tagId) => {
            const tag = selectedTags.get(tagId);
            const name = tag?.name ?? resolveName(tagId) ?? tagId;
            return (
              <TagChip
                className="py-1 pr-1.5 text-[0.8125rem]"
                color={tag?.color ?? TAG_COLOR_DEFAULT}
                key={tagId}
                name={name}
                trailing={
                  <TagChipRemoveButton label={removeLabel(name)} onClick={() => onRemove(tagId)} />
                }
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
