"use client";

import type { QuotesFacetsView } from "@app/shared";

import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { buildMobileSortGroups, MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { BookQuotesTabSort } from "../model/book-quotes-tab-query";
import type { UseBookQuotesTabQueryResult } from "../model/use-book-quotes-tab-query";

import { BOOK_QUOTES_TAB, toBookQuotesTabSort } from "../model/book-quotes-tab-query";
import { quoteFilterCounts, resolveQuoteFilterOptions } from "../model/quote-options";

const BOOK_QUOTES_SORT_GROUP: Record<BookQuotesTabSort, "added" | "page"> = {
  newest: "added",
  oldest: "added",
  page: "page",
};

type BookQuotesToolbarProps = {
  facets: QuotesFacetsView | undefined;
  facetsPending: boolean;
  onAddQuote: () => void;
  query: Pick<
    UseBookQuotesTabQueryResult,
    "clearSearch" | "setFilter" | "setSearch" | "setSort" | "state"
  >;
};

export function BookQuotesToolbar({
  facets,
  facetsPending,
  onAddQuote,
  query,
}: BookQuotesToolbarProps) {
  const t = useTranslations("quotes");

  return (
    <div className="flex flex-col gap-3">
      <DebouncedSearchInput
        clearLabel={t("toolbar.searchClear")}
        isCommittable={alwaysCommittable}
        label={t("bookTab.searchLabel")}
        onClear={query.clearSearch}
        onSearch={query.setSearch}
        placeholder={t("bookTab.searchPlaceholder")}
        value={query.state.quoteQ}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <BookQuotesSort query={query} />

        <Button className="h-10 shrink-0 sm:ml-auto" onClick={onAddQuote}>
          <UiIcon name="plus" size={16} />
          {t("actions.add")}
        </Button>
      </div>

      <BookQuotesQuickFilters facets={facets} facetsPending={facetsPending} query={query} />
    </div>
  );
}

function alwaysCommittable(): boolean {
  return true;
}

function BookQuotesQuickFilters({
  facets,
  facetsPending,
  query,
}: Pick<BookQuotesToolbarProps, "facets" | "facetsPending" | "query">) {
  const t = useTranslations("quotes");
  const filter = query.state.quoteFilter;
  const filterOptions = resolveQuoteFilterOptions(filter);
  const counts = facets === undefined ? undefined : quoteFilterCounts(facets);

  return (
    <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
      <ChipGroup
        className="flex-nowrap"
        countsPending={facetsPending}
        label={t("toolbar.filterLabel")}
        mode="single"
        onValueChange={(next) => {
          const match = filterOptions.find((option) => option === next);
          if (match !== undefined) query.setFilter(match);
        }}
        options={filterOptions.map((option) => ({
          count: counts?.[option],
          label: t(`filter.${option}`),
          value: option,
        }))}
        size="sm"
        value={filter}
      />
    </div>
  );
}

function BookQuotesSort({ query }: Pick<BookQuotesToolbarProps, "query">) {
  const t = useTranslations("quotes");
  const tCommon = useTranslations("common");
  const sort = query.state.quoteSort;

  return (
    <>
      <MobileSortSheet
        className="w-full flex-none sm:hidden"
        closeLabel={t("sort.mobile.close")}
        description={t("sort.mobile.description")}
        groups={buildMobileSortGroups({
          groupKeyByValue: BOOK_QUOTES_SORT_GROUP,
          groupLabel: (key) => t(`sort.mobile.groups.${key}`),
          optionLabel: (option) => t(`sort.mobile.options.${option}`),
          values: BOOK_QUOTES_TAB.sortOptions,
        })}
        id="book-quotes-sort"
        label={t("toolbar.sortLabel")}
        onChange={query.setSort}
        title={t("sort.mobile.title")}
        triggerLabel={t(`sort.mobile.trigger.${sort}`)}
        value={sort}
      />

      <div className="hidden min-w-0 sm:block sm:w-80">
        <Select onValueChange={(next) => query.setSort(toBookQuotesTabSort(next))} value={sort}>
          <SelectTrigger
            aria-label={t("toolbar.sortLabel")}
            className="w-full data-[size=default]:h-10"
            clearLabel={tCommon("clear")}
            isClearable={sort !== BOOK_QUOTES_TAB.sortDefault}
            onClear={() => query.setSort(BOOK_QUOTES_TAB.sortDefault)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOOK_QUOTES_TAB.sortOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`sort.options.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
