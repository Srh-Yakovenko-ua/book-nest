"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { BookTabScrollMemory } from "@/hooks/use-book-tab-scroll-anchor";

import { toBookSelectOption } from "@/features/books/model/book-select-option";
import { useBookTabScrollAnchor } from "@/hooks/use-book-tab-scroll-anchor";
import { useRetryFocus } from "@/hooks/use-retry-focus";
import { RETRY_FOCUS_RING } from "@/lib/retry-focus-ring";
import { cn } from "@/lib/utils";

import { useBookQuotesList } from "../api/use-book-quotes-list";
import { useQuotesFacets } from "../api/use-quotes-facets";
import { bookQuotesListState } from "../model/book-quotes-list-state";
import { useBookQuotesTabQuery } from "../model/use-book-quotes-tab-query";
import { BookQuotesList } from "./book-quotes-list";
import { BookQuotesResultsStatus } from "./book-quotes-results-status";
import { BookQuotesToolbar } from "./book-quotes-toolbar";
import { QuoteDialog } from "./quote-dialog";

type BookQuotesTabProps = {
  book: BookView;
  scrollMemory: BookTabScrollMemory;
};

export function BookQuotesTab({ book, scrollMemory }: BookQuotesTabProps) {
  const t = useTranslations("quotes.bookTab");
  const query = useBookQuotesTabQuery(book.id);
  const quotes = useBookQuotesList(query.listParams);
  const facets = useQuotesFacets(query.facetsParams);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const resultsStartRef = useRef<HTMLDivElement>(null);
  const tabHeadingRef = useRef<HTMLHeadingElement>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(tabHeadingRef);

  const listState = bookQuotesListState({
    hasActiveFilters: query.hasActiveFilters,
    hasActiveSearch: query.hasActiveSearch,
    list: quotes,
  });
  const isEmptyBook = listState.kind === "empty" && listState.reason === "book";
  const hasCriteria = query.hasActiveSearch || query.hasActiveFilters;
  const showToolbar = !isEmptyBook && (quotes.data !== undefined || hasCriteria);

  useBookTabScrollAnchor({
    bookId: book.id,
    cardAttribute: "data-quote-id",
    containerRef: resultsStartRef,
    criteriaKey: JSON.stringify(query.listParams),
    isListRendered: listState.kind === "ready",
    memory: scrollMemory,
  });

  return (
    <div
      className={cn(
        "flex scroll-mt-[calc(var(--shell-header-height)+1rem)] flex-col gap-5",
        RETRY_FOCUS_RING.aroundHiddenHeading,
      )}
      ref={resultsStartRef}
    >
      <h2 className="sr-only" ref={tabHeadingRef} tabIndex={-1}>
        {t("tab")}
      </h2>
      <BookQuotesResultsStatus
        state={listState}
        totalCount={quotes.data?.pages[0]?.totalCount ?? 0}
      />
      {showToolbar ? (
        <BookQuotesToolbar
          facets={facets.data}
          facetsPending={facets.isPending}
          onAddQuote={() => setCreateOpen(true)}
          query={query}
        />
      ) : null}

      <BookQuotesList
        onAddQuote={() => setCreateOpen(true)}
        onClearFilters={query.clearFilters}
        onClearSearch={query.clearSearch}
        onLoadMore={() => void quotes.fetchNextPage()}
        onRetry={withRetryFocus(() => void quotes.refetch())}
        retryButtonRef={retryButtonRef}
        state={listState}
      />

      <QuoteDialog
        book={toBookSelectOption(book)}
        mode="create"
        onOpenChange={setCreateOpen}
        open={isCreateOpen}
      />
    </div>
  );
}
