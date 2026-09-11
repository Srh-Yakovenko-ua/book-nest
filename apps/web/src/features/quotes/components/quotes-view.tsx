"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

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

export function QuotesView() {
  const t = useTranslations("quotes");
  const tActions = useTranslations("quotes.actions");
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

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

  const quoteItems = (quotes.data?.pages ?? []).flatMap((page) => page.items);

  const showSidebar = !quotes.isError;

  const filterCounts = facets.data === undefined ? undefined : quoteFilterCounts(facets.data);
  const counter =
    filterCounts === undefined
      ? undefined
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
      summaryCards={summaryCards}
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
          <Button className="self-start sm:self-auto" onClick={() => setAddOpen(true)}>
            <UiIcon name="plus" size={16} />
            {tActions("add")}
          </Button>
        </div>
      </header>

      {showSidebar ? (
        <QuotesSummaryCards
          cards={summaryCards}
          isError={summary.isError}
          isLoading={summary.isPending}
          mobileAction={overviewPanel}
        />
      ) : null}

      <ToolbarSlot
        isError={quotes.isError}
        isPending={quotes.isPending}
        toolbar={
          <QuotesToolbar
            activeFilterCount={activeFilterCount}
            chips={filterChips}
            counter={counter}
            counts={filterCounts}
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

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <QuotesContent
            hasActiveFilters={hasActiveFilters}
            hasNextPage={quotes.hasNextPage}
            isError={quotes.isError}
            isFetchingNextPage={quotes.isFetchingNextPage}
            isLoadMoreError={quotes.isFetchNextPageError}
            isPending={quotes.isPending}
            listIdentity={quotesListIdentity(listParams)}
            onAddQuote={() => setAddOpen(true)}
            onClearFilters={clearFilters}
            onLoadMore={() => void quotes.fetchNextPage()}
            onOpenBooks={() => router.push("/books")}
            onRetry={() => void quotes.refetch()}
            quotes={quoteItems}
            view={state.view}
          />
        </div>

        {showSidebar ? <QuotesSidebar /> : null}
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
