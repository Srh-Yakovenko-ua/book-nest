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

import { useAuthorSearch } from "../api/use-author-search";
import { type AuthorSelection } from "../model/create-book-form";

type AuthorAutocompleteProps = {
  describedBy?: string;
  id: string;
  invalid: boolean;
  onChange: (selection: AuthorSelection | null) => void;
  placeholder: string;
  required?: boolean;
  value: AuthorSelection | null;
};

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export function AuthorAutocomplete({
  describedBy,
  id,
  invalid,
  onChange,
  placeholder,
  required = false,
  value,
}: AuthorAutocompleteProps) {
  const t = useTranslations("books");
  const listId = useId();
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const { data: authors = [], isFetching } = useAuthorSearch(debouncedQuery);

  const trimmedQuery = query.trim();
  const showCustomOption =
    trimmedQuery.length >= MIN_QUERY_LENGTH &&
    !authors.some((author) => author.name.toLowerCase() === trimmedQuery.toLowerCase());

  function pickCatalog(author: { id: string; name: string }) {
    onChange({ id: author.id, kind: "catalog", name: author.name });
    setQuery(author.name);
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
            name="user"
            size={18}
          />
          <input
            aria-autocomplete="list"
            aria-controls={open ? listId : undefined}
            aria-describedby={describedBy}
            aria-expanded={open}
            aria-invalid={invalid}
            aria-required={required}
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
            {isFetching && authors.length === 0 ? (
              <CommandEmpty>{t("author.searching")}</CommandEmpty>
            ) : null}
            {!isFetching && authors.length === 0 && !showCustomOption ? (
              <CommandEmpty>{t("author.empty")}</CommandEmpty>
            ) : null}
            {authors.length > 0 ? (
              <CommandGroup heading={t("author.catalogHeading")}>
                {authors.map((author) => (
                  <CommandItem
                    className="cursor-pointer"
                    key={author.id}
                    onSelect={() => pickCatalog(author)}
                    value={author.id}
                  >
                    <UiIcon className="text-muted-foreground" name="user" size={16} />
                    <span className="min-w-0 truncate">{author.name}</span>
                    {author.isCustom ? (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {t("author.customBadge")}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {showCustomOption ? (
              <CommandGroup heading={t("author.createHeading")}>
                <CommandItem
                  className="cursor-pointer"
                  onSelect={pickCustom}
                  value={`custom-${trimmedQuery}`}
                >
                  <UiIcon className="text-primary" name="plus" size={16} />
                  <span className="min-w-0 truncate">
                    {t("author.useCustom", { name: trimmedQuery })}
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
