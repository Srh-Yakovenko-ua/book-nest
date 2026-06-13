"use client";

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

import { usePublishersSearch } from "../api/use-publishers-search";
import { type PublisherSelection } from "../model/create-book-form";

type PublisherAutocompleteProps = {
  describedBy?: string;
  id: string;
  invalid: boolean;
  onChange: (selection: null | PublisherSelection) => void;
  placeholder: string;
  value: null | PublisherSelection;
};

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export function PublisherAutocomplete({
  describedBy,
  id,
  invalid,
  onChange,
  placeholder,
  value,
}: PublisherAutocompleteProps) {
  const t = useTranslations("books");
  const listId = useId();
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const { data: publishers = [], isFetching } = usePublishersSearch(debouncedQuery);

  const trimmedQuery = query.trim();
  const showCustomOption =
    trimmedQuery.length >= MIN_QUERY_LENGTH &&
    !publishers.some((publisher) => publisher.name.toLowerCase() === trimmedQuery.toLowerCase());

  function pickCatalog(publisher: { id: string; name: string }) {
    onChange({ id: publisher.id, kind: "catalog", name: publisher.name });
    setQuery(publisher.name);
    setOpen(false);
  }

  function pickCustom() {
    onChange({ kind: "custom", name: trimmedQuery });
    setQuery(trimmedQuery);
    setOpen(false);
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
            name="building"
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
              const next = event.target.value;
              setQuery(next);
              setOpen(next.trim().length >= MIN_QUERY_LENGTH);
              if (value !== null) onChange(null);
            }}
            onFocus={() => {
              if (trimmedQuery.length >= MIN_QUERY_LENGTH) setOpen(true);
            }}
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
            {isFetching && publishers.length === 0 ? (
              <CommandEmpty>{t("publisher.searching")}</CommandEmpty>
            ) : null}
            {!isFetching && publishers.length === 0 && !showCustomOption ? (
              <CommandEmpty>{t("publisher.empty")}</CommandEmpty>
            ) : null}
            {publishers.length > 0 ? (
              <CommandGroup heading={t("publisher.catalogHeading")}>
                {publishers.map((publisher) => (
                  <CommandItem
                    className="cursor-pointer"
                    key={publisher.id}
                    onSelect={() => pickCatalog(publisher)}
                    value={publisher.id}
                  >
                    <UiIcon className="text-muted-foreground" name="building" size={16} />
                    <span className="min-w-0 truncate">{publisher.name}</span>
                    {publisher.isCustom ? (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {t("publisher.customBadge")}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {showCustomOption ? (
              <CommandGroup heading={t("publisher.createHeading")}>
                <CommandItem
                  className="cursor-pointer"
                  onSelect={pickCustom}
                  value={`custom-${trimmedQuery}`}
                >
                  <UiIcon className="text-primary" name="plus" size={16} />
                  <span className="min-w-0 truncate">
                    {t("publisher.useCustom", { name: trimmedQuery })}
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
