"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { RefetchErrorBanner } from "@/components/refetch-error-banner";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { useLibraryPresence } from "@/features/books/api/use-library-presence";
import { BOOK_CREATE_PATH } from "@/features/books/model/book-create-href";
import { useRetryFocus } from "@/hooks/use-retry-focus";
import { useRouter } from "@/i18n/navigation";
import { collectionChrome } from "@/lib/collection-chrome";
import { withPresenceRetry } from "@/lib/collection-presence";
import { RETRY_FOCUS_RING } from "@/lib/retry-focus-ring";
import { cn } from "@/lib/utils";

import { useQuotes } from "../api/use-quotes";
import { useQuotesFacets } from "../api/use-quotes-facets";
import { useQuotesSummary } from "../api/use-quotes-summary";
import { quoteFilterCounts } from "../model/quote-options";
import { quotesListIdentity } from "../model/quotes-query";
import { useQuotesFilterChips } from "../model/use-quotes-filter-chips";
import { useQuotesQuery } from "../model/use-quotes-query";
import { QuoteDialog } from "./quote-dialog";
import { QuotesContent } from "./quotes-content";
import { QuotesOverviewPanel } from "./quotes-overview-panel";
import { QuotesSidebar } from "./quotes-sidebar";
import { QuotesSummaryCards, useQuotesSummaryCards } from "./quotes-summary-cards";
import { QuotesToolbar, QuotesToolbarSkeleton } from "./quotes-toolbar";

const QUOTES_ROUTES = {
  addFirstBook: BOOK_CREATE_PATH,
  books: "/books",
} as const;

export function QuotesView() {
  const t = useTranslations("quotes");
  const tActions = useTranslations("quotes.actions");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const resultsRegionRef = useRef<HTMLElement>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(resultsRegionRef);

  const {
    activeFilterCount,
    applyAdvanced,
    clearFilters,
    facetsParams,
    hasActiveFilters,
    listParams,
    setFilter,
    setSearch,
    setSort,
    setView,
    state,
  } = useQuotesQuery();

  const quotes = useQuotes(listParams);
  const summary = useQuotesSummary();
  const facets = useQuotesFacets(facetsParams);
  const presence = useLibraryPresence();
  const libraryPresence = withPresenceRetry({ presence, wrapRetry: withRetryFocus });

  const quoteItems = (quotes.data?.pages ?? []).flatMap((page) => page.items);

  const chrome = collectionChrome({
    baseTotal: summary.data?.totalCount,
    hasQuery: hasActiveFilters,
  });
  const showMetrics = !quotes.isLoadingError && chrome.showMetrics;

  const filterCounts = facets.data === undefined ? undefined : quoteFilterCounts(facets.data);
  const counter =
    filterCounts === undefined || !chrome.showMetrics
      ? undefined
      : facets.isPlaceholderData
        ? tCommon("updating")
        : t("counter", { shown: filterCounts[state.filter], total: filterCounts.all });

  const filterChips = useQuotesFilterChips({
    facets: facets.data,
    onApplyAdvanced: applyAdvanced,
    onSearch: setSearch,
    state,
  });

  const summaryCards = useQuotesSummaryCards(summary.data);
  const overviewPanel = (
    <QuotesOverviewPanel
      isLoading={summary.isPending}
      onAddQuote={() => setAddOpen(true)}
      onClearFilters={clearFilters}
      onShowFavorites={() => setFilter("favorites")}
      onShowRecent={() => setSort("newest")}
      onShowWithComment={() => setFilter("with_comment")}
      summaryCards={summary.isLoadingError ? null : summaryCards}
    />
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
                {t("title")}
              </h1>
              <TitleLeaf />
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {t("subtitle")}
            </p>
          </div>
          {chrome.showTools ? (
            <Button className="self-start sm:self-auto" onClick={() => setAddOpen(true)}>
              <UiIcon name="plus" size={16} />
              {tActions("add")}
            </Button>
          ) : null}
        </div>
      </header>

      {showMetrics ? (
        <QuotesSummaryCards
          cards={summaryCards}
          isError={summary.isLoadingError}
          isLoading={summary.isPending}
          mobileAction={overviewPanel}
          onRetry={() => void summary.refetch()}
        />
      ) : null}

      {chrome.showTools ? (
        <ToolbarSlot
          isError={quotes.isLoadingError}
          isPending={quotes.isPending}
          toolbar={
            <QuotesToolbar
              activeFilterCount={activeFilterCount}
              chips={filterChips}
              counter={counter}
              counts={filterCounts}
              countsPending={facets.isPending}
              facets={facets.data}
              filter={state.filter}
              onApplyAdvanced={applyAdvanced}
              onClearAll={clearFilters}
              onFilterChange={setFilter}
              onSearch={setSearch}
              onSortChange={setSort}
              onViewChange={setView}
              search={state.q}
              sort={state.sort}
              state={state}
              view={state.view}
            />
          }
        />
      ) : null}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <section
          aria-label={t("listLabel")}
          className={cn("flex min-w-0 flex-1 flex-col gap-6", RETRY_FOCUS_RING.onTarget)}
          ref={resultsRegionRef}
          tabIndex={-1}
        >
          <RefetchErrorBanner
            state={
              quotes.isRefetchError
                ? { isRetrying: quotes.isRefetching, onRetry: () => void quotes.refetch() }
                : null
            }
          />
          <QuotesContent
            hasActiveFilters={hasActiveFilters}
            hasNextPage={quotes.hasNextPage}
            isError={quotes.isLoadingError}
            isFetchingNextPage={quotes.isFetchingNextPage}
            isLoadMoreError={quotes.isFetchNextPageError}
            isPending={quotes.isPending}
            isRefreshing={quotes.isPlaceholderData}
            libraryPresence={libraryPresence}
            listIdentity={quotesListIdentity(listParams)}
            onAddFirstBook={() => router.push(QUOTES_ROUTES.addFirstBook)}
            onAddQuote={() => setAddOpen(true)}
            onClearFilters={clearFilters}
            onLoadMore={() => void quotes.fetchNextPage()}
            onOpenBooks={() => router.push(QUOTES_ROUTES.books)}
            onRetry={withRetryFocus(() => void quotes.refetch())}
            quotes={quoteItems}
            retryButtonRef={retryButtonRef}
            view={state.view}
          />
        </section>

        {showMetrics ? <QuotesSidebar /> : null}
      </div>

      <QuoteDialog mode="createWithBookPicker" onOpenChange={setAddOpen} open={addOpen} />
    </div>
  );
}

function ToolbarSlot({
  isError,
  isPending,
  toolbar,
}: {
  isError: boolean;
  isPending: boolean;
  toolbar: ReactNode;
}) {
  if (isError) return null;
  if (isPending) return <QuotesToolbarSkeleton />;
  return toolbar;
}
