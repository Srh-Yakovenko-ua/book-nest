"use client";

import type { PublisherDuplicateCandidate, PublisherView } from "@app/shared";

import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import { type ReactNode, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { cn } from "@/lib/utils";

import {
  distinctMatchedName,
  isReliableMatch,
  PUBLISHER_LOOKUP,
  usePublisherDuplicateCandidates,
} from "../api/use-publisher-duplicate-candidates";
import { usePublishersSearch } from "../api/use-publishers-search";
import { useRecentPublishers } from "../api/use-recent-publishers";
import { type PublisherSelection } from "../model/create-book-form";

type PublisherAutocompleteProps = {
  describedBy?: string;
  invalid: boolean;
  label: string;
  onChange: (selection: null | PublisherSelection) => void;
  onQueryChange: (query: string) => void;
  placeholder: string;
  query: string;
  value: null | PublisherSelection;
};

type PublisherOptionProps = {
  children?: ReactNode;
  onSelect: () => void;
  publisher: PublisherRow;
};

type PublisherRow = Pick<PublisherView, "id" | "isCustom" | "name">;

const PUBLISHER_INPUT_SLOT = "publisher-input";

export function focusPublisherInput() {
  const input = document.querySelector(`[data-slot="${PUBLISHER_INPUT_SLOT}"]`);
  if (input instanceof HTMLInputElement) input.focus();
}

export function PublisherAutocomplete({
  describedBy,
  invalid,
  label,
  onChange,
  onQueryChange,
  placeholder,
  query,
  value,
}: PublisherAutocompleteProps) {
  const t = useTranslations("books");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, PUBLISHER_LOOKUP.debounceMs);
  const {
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    items: publishers,
  } = usePublishersSearch(debouncedQuery);
  const { data: recentPublishers = [] } = useRecentPublishers();
  const { data: fetchedCandidates = [] } = usePublisherDuplicateCandidates({
    name: debouncedQuery,
  });
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    itemCount: publishers.length,
    onLoadMore: fetchNextPage,
  });

  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const candidates = debouncedQuery.trim() === trimmedQuery ? fetchedCandidates : [];
  const existingMatches = candidates.filter(isReliableMatch);
  const similarMatches = existingMatches.length > 0 ? [] : candidates;

  const matchedIds = new Set([...existingMatches, ...similarMatches].map((match) => match.id));
  const filteredRecent = (
    normalizedQuery.length === 0
      ? recentPublishers
      : recentPublishers.filter((publisher) =>
          publisher.name.toLowerCase().includes(normalizedQuery),
        )
  ).filter((publisher) => !matchedIds.has(publisher.id));
  const listedIds = new Set([...matchedIds, ...filteredRecent.map((publisher) => publisher.id)]);
  const catalogResults = publishers.filter((publisher) => !listedIds.has(publisher.id));

  const showCustomOption =
    trimmedQuery.length >= PUBLISHER_LOOKUP.minNameLength && existingMatches.length === 0;
  const customIsSecondary = similarMatches.length > 0;

  const hasResults = listedIds.size > 0 || catalogResults.length > 0;

  function pickCatalog(publisher: PublisherRow) {
    onChange({ id: publisher.id, kind: "catalog", name: publisher.name });
    onQueryChange(publisher.name);
    setOpen(false);
  }

  function pickCustom() {
    onChange({ kind: "custom", name: trimmedQuery });
    onQueryChange(trimmedQuery);
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    onQueryChange("");
    setOpen(false);
  }

  const showClear = value !== null || query.length > 0;

  return (
    <CommandPrimitive label={label} shouldFilter={false}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverAnchor asChild>
          <div className="relative flex items-center" ref={anchorRef}>
            <UiIcon
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-3",
                invalid ? "text-destructive" : "text-muted-foreground",
              )}
              name="building"
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
              data-slot={PUBLISHER_INPUT_SLOT}
              onClick={() => setOpen(true)}
              onFocus={() => setOpen(true)}
              onValueChange={(next) => {
                onQueryChange(next);
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
            {isFetching && !hasResults ? (
              <CommandEmpty>{t("publisher.searching")}</CommandEmpty>
            ) : null}
            {!isFetching && !hasResults && !showCustomOption ? (
              <CommandEmpty>{t("publisher.empty")}</CommandEmpty>
            ) : null}
            {existingMatches.length > 0 ? (
              <CommandGroup heading={t("publisher.existingHeading")}>
                {existingMatches.map((match) => (
                  <PublisherOption
                    key={match.id}
                    onSelect={() => pickCatalog(match)}
                    publisher={match}
                  >
                    <MatchedNameHint candidate={match} />
                  </PublisherOption>
                ))}
              </CommandGroup>
            ) : null}
            {similarMatches.length > 0 ? (
              <CommandGroup heading={t("publisher.similarHeading")}>
                {similarMatches.map((match) => (
                  <PublisherOption
                    key={match.id}
                    onSelect={() => pickCatalog(match)}
                    publisher={match}
                  >
                    <MatchedNameHint candidate={match} />
                  </PublisherOption>
                ))}
              </CommandGroup>
            ) : null}
            {filteredRecent.length > 0 ? (
              <CommandGroup heading={t("publisher.recentHeading")}>
                {filteredRecent.map((publisher) => (
                  <PublisherOption
                    key={publisher.id}
                    onSelect={() => pickCatalog(publisher)}
                    publisher={publisher}
                  />
                ))}
              </CommandGroup>
            ) : null}
            {catalogResults.length > 0 ? (
              <CommandGroup heading={t("publisher.allHeading")}>
                {catalogResults.map((publisher) => (
                  <PublisherOption
                    key={publisher.id}
                    onSelect={() => pickCatalog(publisher)}
                    publisher={publisher}
                  />
                ))}
              </CommandGroup>
            ) : null}
            {isFetchingNextPage ? (
              <div className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                {t("publisher.searching")}
              </div>
            ) : null}
            {showCustomOption ? (
              <CommandGroup heading={t("publisher.createHeading")}>
                <CommandItem
                  className="cursor-pointer"
                  onSelect={pickCustom}
                  value={`custom-${trimmedQuery}`}
                >
                  <UiIcon
                    className={customIsSecondary ? "text-muted-foreground" : "text-primary"}
                    name="plus"
                    size={16}
                  />
                  <span
                    className={cn("min-w-0 truncate", customIsSecondary && "text-muted-foreground")}
                  >
                    {customIsSecondary
                      ? t("publisher.useCustomAnyway", { name: trimmedQuery })
                      : t("publisher.useCustom", { name: trimmedQuery })}
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

function MatchedNameHint({ candidate }: { candidate: PublisherDuplicateCandidate }) {
  const t = useTranslations("books");
  const matchedName = distinctMatchedName(candidate);
  if (matchedName === null) return null;
  return (
    <span className="truncate text-xs text-muted-foreground">
      {t("publisher.alsoKnownAs", { name: matchedName })}
    </span>
  );
}

function PublisherOption({ children, onSelect, publisher }: PublisherOptionProps) {
  const t = useTranslations("books");
  return (
    <CommandItem className="cursor-pointer items-start" onSelect={onSelect} value={publisher.id}>
      <UiIcon className="mt-0.5 shrink-0 text-muted-foreground" name="building" size={16} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="break-words whitespace-normal">{publisher.name}</span>
        {children}
      </span>
      {publisher.isCustom ? (
        <span className="shrink-0 text-xs text-muted-foreground">{t("publisher.customBadge")}</span>
      ) : null}
    </CommandItem>
  );
}
