"use client";

import type { BookView, Nullable } from "@app/shared";

import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { LibraryListParams } from "@/features/books/model/library-query";

import { UiIcon } from "@/components/icons";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useLibraryBooks } from "@/features/books/api/use-books";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import type { QuoteBookOption } from "../model/quote-book";

import { toQuoteBookOption } from "../model/quote-book";

const SEARCH_DEBOUNCE_MS = 250;
const BOOK_PICKER_PAGE_SIZE = 20;

type BookPickerProps = {
  describedBy?: string;
  id: string;
  invalid?: boolean;
  onChange: (book: Nullable<QuoteBookOption>) => void;
  placeholder: string;
  value: Nullable<QuoteBookOption>;
};

export function BookPicker({
  describedBy,
  id,
  invalid = false,
  onChange,
  placeholder,
  value,
}: BookPickerProps) {
  const t = useTranslations("quotes.bookPicker");
  const [query, setQuery] = useState(value?.title ?? "");
  const [open, setOpen] = useState(false);
  const [trackedBook, setTrackedBook] = useState(value);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  if ((value?.id ?? null) !== (trackedBook?.id ?? null)) {
    setTrackedBook(value);
    if (value !== null) {
      setQuery(value.title);
    } else if (trackedBook !== null && query === trackedBook.title) {
      setQuery("");
    }
  }

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } = useLibraryBooks(
    bookSearchParams(debouncedQuery),
  );
  const books = (data?.pages ?? []).flatMap((page) => page.items);

  function pick(book: BookView) {
    onChange(toQuoteBookOption(book));
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setOpen(false);
  }

  const showClear = value !== null || query.length > 0;

  return (
    <CommandPrimitive label={placeholder} shouldFilter={false}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverAnchor asChild>
          <div className="relative flex items-center">
            <UiIcon
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-3",
                invalid ? "text-destructive" : "text-muted-foreground",
              )}
              name="book"
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
                aria-label={t("clear")}
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
            {isFetching && books.length === 0 ? (
              <CommandEmpty>{t("searching")}</CommandEmpty>
            ) : null}
            {!isFetching && books.length === 0 ? <CommandEmpty>{t("empty")}</CommandEmpty> : null}
            {books.length > 0 ? (
              <CommandGroup heading={t("heading")}>
                {books.map((book) => (
                  <CommandItem
                    className="cursor-pointer"
                    key={book.id}
                    onSelect={() => pick(book)}
                    value={book.id}
                  >
                    <UiIcon className="shrink-0 text-muted-foreground" name="book" size={16} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{book.title}</span>
                      {book.authors.length > 0 ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {book.authors.map((author) => author.name).join(", ")}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
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
                  {isFetchingNextPage ? t("searching") : t("loadMore")}
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </PopoverContent>
      </Popover>
    </CommandPrimitive>
  );
}

function bookSearchParams(search: string): LibraryListParams {
  const q = search.trim();

  return {
    ageCategory: [],
    author: [],
    format: [],
    genre: [],
    language: [],
    owner: [],
    pageSize: BOOK_PICKER_PAGE_SIZE,
    publisher: [],
    status: [],
    tag: [],
    ...(q === "" ? {} : { q }),
  };
}
