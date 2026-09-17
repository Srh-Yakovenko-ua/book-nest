"use client";

import type { BookView, Nullable } from "@app/shared";
import type { FocusEvent, Ref } from "react";

import { memo, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { cn } from "@/lib/utils";
import { BooksControllerListSort } from "@/shared/api/generated/model";

import type { BookSelectOption } from "../model/book-select-option";
import type { LibraryListParams } from "../model/library-query";

import { LIBRARY_BOOKS_RETENTION, useLibraryBooks } from "../api/use-books";
import { libraryListParams } from "../model/library-query";
import { BookThumb } from "./book-picker";
import { BookSingleSelectValue } from "./book-single-select-value";

const BOOK_SINGLE_SELECT_PICKER = {
  pageSize: 20,
  searchDebounceMs: 250,
  skeletonCount: 4,
} as const;

export type BookSingleSelectPickerLabels = {
  change: string;
  collapse: string;
  empty: string;
  loadError: string;
  loading: string;
  results: string;
  resultsCount: (count: number) => string;
  search: string;
};

type BookSingleSelectPickerProps = {
  baseParams?: Partial<LibraryListParams>;
  describedBy?: string;
  id: string;
  invalid?: boolean;
  labelledBy: string;
  labels: BookSingleSelectPickerLabels;
  onChange: (book: BookView) => void;
  ref?: Ref<HTMLInputElement>;
  required?: boolean;
  value: Nullable<BookSelectOption>;
};

type PendingFocus = "change" | "search";

type PickerView = "list" | "value";

export function BookSingleSelectPicker({
  baseParams,
  describedBy,
  id,
  invalid = false,
  labelledBy,
  labels,
  onChange,
  ref,
  required = false,
  value,
}: BookSingleSelectPickerProps) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<PickerView>(value === null ? "list" : "value");
  const debouncedSearch = useDebouncedValue(search, BOOK_SINGLE_SELECT_PICKER.searchDebounceMs);

  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const listElementRef = useRef<Nullable<HTMLDivElement>>(null);
  const searchInputRef = useRef<Nullable<HTMLInputElement>>(null);
  const pendingFocusRef = useRef<Nullable<PendingFocus>>(null);
  const isPointerSelectionRef = useRef(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isPending,
    isPlaceholderData,
  } = useLibraryBooks(searchParams(baseParams, debouncedSearch), {
    retention: LIBRARY_BOOKS_RETENTION.whole,
  });

  const items = (data?.pages ?? []).flatMap((page) => page.items);
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    itemCount: items.length,
    onLoadMore: fetchNextPage,
  });

  const attachList = useCallback(
    (element: HTMLDivElement | null) => {
      listElementRef.current = element;
      scrollRef(element);
    },
    [scrollRef],
  );

  useEffect(() => {
    if (listElementRef.current === null) return;
    listElementRef.current.scrollTop = 0;
  }, [debouncedSearch]);

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (pending === null) return;
    pendingFocusRef.current = null;
    if (pending === "search") {
      searchInputRef.current?.focus();
      return;
    }
    changeButtonRef.current?.focus();
  });

  function attachSearchInput(element: Nullable<HTMLInputElement>) {
    searchInputRef.current = element;
    if (typeof ref === "function") {
      ref(element);
      return;
    }
    if (ref === null || ref === undefined) return;
    ref.current = element;
  }

  function showSelected(focus: Nullable<PendingFocus>) {
    pendingFocusRef.current = focus;
    setView("value");
  }

  function select(book: BookView) {
    onChange(book);
    if (!isPointerSelectionRef.current) return;
    isPointerSelectionRef.current = false;
    showSelected("change");
  }

  function leavePicker(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    if (value === null) return;
    showSelected(null);
  }

  if (value !== null && view === "value") {
    return (
      <div aria-labelledby={labelledBy} role="group">
        <BookSingleSelectValue
          action={
            <Button
              aria-describedby={`${id}-selected`}
              className="shrink-0"
              onClick={() => {
                pendingFocusRef.current = "search";
                setView("list");
              }}
              ref={changeButtonRef}
              size="sm"
              type="button"
              variant="ghost"
            >
              {labels.change}
            </Button>
          }
          book={value}
          detailsId={`${id}-selected`}
        />
      </div>
    );
  }

  return (
    <div
      aria-labelledby={labelledBy}
      className="flex flex-col gap-2"
      onBlur={leavePicker}
      role="group"
    >
      <div className="flex items-center gap-2">
        <Input
          aria-describedby={describedBy}
          aria-invalid={invalid}
          aria-label={labels.search}
          autoComplete="off"
          className="h-10"
          id={id}
          isClearable
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          placeholder={labels.search}
          ref={attachSearchInput}
          value={search}
        />
        {value === null ? null : (
          <Button
            className="shrink-0"
            onClick={() => showSelected("change")}
            size="sm"
            type="button"
            variant="ghost"
          >
            {labels.collapse}
          </Button>
        )}
      </div>

      <p className="sr-only" role="status">
        {liveStatus({
          isPending,
          isPlaceholderData,
          itemCount: items.length,
          labels,
          loadedPages: data?.pages.length ?? 0,
        })}
      </p>

      <div
        aria-busy={isPlaceholderData}
        className={cn(
          "max-h-64 overflow-y-auto rounded-lg border p-1 transition-colors",
          isPlaceholderData
            ? "border-dashed border-accent-border [&_[data-slot=book-thumb]]:opacity-40"
            : "border-border",
        )}
        onKeyDownCapture={() => {
          isPointerSelectionRef.current = false;
        }}
        onPointerDownCapture={() => {
          isPointerSelectionRef.current = true;
        }}
        onScroll={onScroll}
        ref={attachList}
      >
        {isPlaceholderData ? (
          <p className="py-2 text-center text-xs text-muted-foreground">{labels.loading}</p>
        ) : null}
        <BookSingleSelectResults
          idPrefix={id}
          isError={isError}
          isPending={isPending}
          items={items}
          labels={labels}
          onSelect={select}
          required={required}
          selectedId={value?.id ?? null}
        />
        {isFetchingNextPage ? (
          <p className="py-2 text-center text-xs text-muted-foreground">{labels.loading}</p>
        ) : null}
      </div>
    </div>
  );
}

function BookSingleSelectResults({
  idPrefix,
  isError,
  isPending,
  items,
  labels,
  onSelect,
  required,
  selectedId,
}: {
  idPrefix: string;
  isError: boolean;
  isPending: boolean;
  items: BookView[];
  labels: BookSingleSelectPickerLabels;
  onSelect: (book: BookView) => void;
  required: boolean;
  selectedId: Nullable<string>;
}) {
  if (isPending) {
    return (
      <div aria-busy aria-hidden className="flex flex-col gap-1">
        {Array.from({ length: BOOK_SINGLE_SELECT_PICKER.skeletonCount }, (_, index) => (
          <div className="flex items-center gap-3 p-2" key={index}>
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-12 w-9 shrink-0 rounded-sm" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground" role="alert">
        {labels.loadError}
      </p>
    );
  }

  if (items.length === 0) {
    return <p className="px-3 py-6 text-center text-sm text-muted-foreground">{labels.empty}</p>;
  }

  return (
    <RadioGroup
      aria-label={labels.results}
      className="gap-1"
      onValueChange={(nextId) => {
        const book = items.find((item) => item.id === nextId);
        if (book === undefined) return;
        onSelect(book);
      }}
      required={required}
      value={selectedId ?? ""}
    >
      {items.map((book) => (
        <BookSingleSelectRow
          book={book}
          idPrefix={idPrefix}
          isSelected={selectedId === book.id}
          key={book.id}
        />
      ))}
    </RadioGroup>
  );
}

const BookSingleSelectRow = memo(function BookSingleSelectRow({
  book,
  idPrefix,
  isSelected,
}: {
  book: BookView;
  idPrefix: string;
  isSelected: boolean;
}) {
  return (
    <Label
      className={cn(
        "cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 font-normal transition-colors hover:border-accent-border hover:bg-secondary/50 has-[:focus-visible]:bg-secondary/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-ring",
        isSelected && "border-primary bg-secondary/40 ring-1 ring-primary",
      )}
      htmlFor={`${idPrefix}-option-${book.id}`}
    >
      <RadioGroupItem id={`${idPrefix}-option-${book.id}`} value={book.id} />
      <BookThumb book={book} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-ink">{book.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {book.authors.map((author) => author.name).join(", ")}
        </span>
      </span>
    </Label>
  );
});

function liveStatus({
  isPending,
  isPlaceholderData,
  itemCount,
  labels,
  loadedPages,
}: {
  isPending: boolean;
  isPlaceholderData: boolean;
  itemCount: number;
  labels: BookSingleSelectPickerLabels;
  loadedPages: number;
}): string {
  if (isPending || isPlaceholderData) return labels.loading;
  if (loadedPages <= 1) return "";
  return labels.resultsCount(itemCount);
}

function searchParams(
  baseParams: Partial<LibraryListParams> | undefined,
  search: string,
): LibraryListParams {
  const q = search.trim();

  return libraryListParams({
    pageSize: BOOK_SINGLE_SELECT_PICKER.pageSize,
    sort: BooksControllerListSort.title_asc,
    ...baseParams,
    ...(q === "" ? {} : { q }),
  });
}
