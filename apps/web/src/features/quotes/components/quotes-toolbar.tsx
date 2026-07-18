"use client";

import type { Nullable, QuoteFilter, QuoteSort } from "@app/shared";

import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import type { QuoteBookOption } from "../model/quote-book";

import { QUOTE_FILTER_OPTIONS, QUOTE_SORT_OPTIONS } from "../model/quote-options";
import { QUOTES_SORT_DEFAULT } from "../model/quotes-query";
import { BookPicker } from "./book-picker";

type QuotesToolbarProps = {
  book: Nullable<QuoteBookOption>;
  filter: QuoteFilter;
  onAddQuote: () => void;
  onBookChange: (bookId: Nullable<string>) => void;
  onFilterChange: (filter: QuoteFilter) => void;
  onSearch: (value: string) => void;
  onSortChange: (sort: QuoteSort) => void;
  search: string;
  sort: QuoteSort;
};

export function QuotesToolbar({
  book,
  filter,
  onAddQuote,
  onBookChange,
  onFilterChange,
  onSearch,
  onSortChange,
  search,
  sort,
}: QuotesToolbarProps) {
  const t = useTranslations("quotes.toolbar");
  const tActions = useTranslations("quotes.actions");
  const tCommon = useTranslations("common");
  const tFilter = useTranslations("quotes.filter");
  const tSort = useTranslations("quotes.sort");

  return (
    <div className="flex flex-col gap-3">
      <DebouncedSearchInput
        clearLabel={t("searchClear")}
        label={t("searchLabel")}
        onClear={() => onSearch("")}
        onSearch={onSearch}
        placeholder={t("searchPlaceholder")}
        value={search}
      />

      <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={t("filterLabel")}
          mode="single"
          onValueChange={(next) => {
            const match = QUOTE_FILTER_OPTIONS.find((option) => option === next);
            if (match !== undefined) onFilterChange(match);
          }}
          options={QUOTE_FILTER_OPTIONS.map((option) => ({
            label: tFilter(option),
            value: option,
          }))}
          size="sm"
          value={filter}
        />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="w-full sm:w-64">
          <BookPicker
            id="quotes-book-filter"
            onChange={(next) => onBookChange(next?.id ?? null)}
            placeholder={t("bookPlaceholder")}
            value={book}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-56">
            <Select
              onValueChange={(next) => {
                const match = QUOTE_SORT_OPTIONS.find((option) => option === next);
                if (match !== undefined) onSortChange(match);
              }}
              value={sort}
            >
              <SelectTrigger
                aria-label={t("sortLabel")}
                className="w-full data-[size=default]:h-10"
                clearLabel={tCommon("clear")}
                isClearable={sort !== QUOTES_SORT_DEFAULT}
                onClear={() => onSortChange(QUOTES_SORT_DEFAULT)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUOTE_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tSort(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="h-10" onClick={onAddQuote}>
            <UiIcon name="plus" size={16} />
            {tActions("add")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function QuotesToolbarSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <Skeleton className="h-10 w-full rounded-md" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: QUOTE_FILTER_OPTIONS.length }, (_, index) => (
          <Skeleton className="h-8 w-24 rounded-full" key={index} />
        ))}
      </div>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Skeleton className="h-10 w-full rounded-md sm:w-64" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-10 w-full rounded-md sm:w-56" />
          <Skeleton className="h-10 w-full rounded-md sm:w-36" />
        </div>
      </div>
    </div>
  );
}
