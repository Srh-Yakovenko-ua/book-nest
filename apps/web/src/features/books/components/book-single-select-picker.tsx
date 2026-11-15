"use client";

import type { BookView, Nullable } from "@app/shared";
import type { Ref } from "react";

import { useState } from "react";

import type { SingleSelectPickerLabels } from "@/components/single-select-picker";

import { SingleSelectPicker } from "@/components/single-select-picker";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
} as const;

export type BookSingleSelectPickerLabels = SingleSelectPickerLabels;

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

export function BookSingleSelectPicker({
  baseParams,
  describedBy,
  id,
  invalid,
  labelledBy,
  labels,
  onChange,
  ref,
  required,
  value,
}: BookSingleSelectPickerProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, BOOK_SINGLE_SELECT_PICKER.searchDebounceMs);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isFetchNextPageError,
    isPending,
    isPlaceholderData,
  } = useLibraryBooks(searchParams(baseParams, debouncedSearch), {
    retention: LIBRARY_BOOKS_RETENTION.whole,
  });

  return (
    <SingleSelectPicker
      appliedSearch={debouncedSearch}
      describedBy={describedBy}
      id={id}
      invalid={invalid}
      labelledBy={labelledBy}
      labels={labels}
      onChange={onChange}
      onSearchChange={setSearch}
      ref={ref}
      renderOption={(book) => <BookSingleSelectOption book={book} />}
      renderValue={({ action, detailsId, value: book }) => (
        <BookSingleSelectValue action={action} book={book} detailsId={detailsId} />
      )}
      required={required}
      results={{
        fetchNextPage,
        hasNextPage,
        isError,
        isFetchingNextPage,
        isFetchNextPageError,
        isPending,
        isPlaceholderData,
        items: (data?.pages ?? []).flatMap((page) => page.items),
      }}
      search={search}
      staleResultsClassName="[&_[data-slot=book-thumb]]:opacity-40"
      value={value}
    />
  );
}

function BookSingleSelectOption({ book }: { book: BookView }) {
  return (
    <>
      <BookThumb book={book} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-ink">{book.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {book.authors.map((author) => author.name).join(", ")}
        </span>
      </span>
    </>
  );
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
