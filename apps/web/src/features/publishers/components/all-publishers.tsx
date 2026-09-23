"use client";

import { useTranslations } from "next-intl";

import { type ActiveFilterChip, LibraryActiveFilters } from "@/features/books";
import { useRouter } from "@/i18n/navigation";

import { usePublisherSummary } from "../api/use-publisher-summary";
import { usePublishersList } from "../api/use-publishers-list";
import {
  type PublishersArchiveState,
  resolvePublishersArchiveState,
} from "../model/publisher-archive-state";
import { PUBLISHERS_BOOLEAN_FILTERS, PUBLISHERS_QUERY_DEFAULTS } from "../model/publisher-query";
import { usePublisherQuery } from "../model/use-publisher-query";
import { AllPublishersView } from "./all-publishers-view";
import { hasPublisherInsights, PublisherInsights } from "./publisher-insights";
import { PublisherOverviewPanel } from "./publisher-overview-panel";
import { PublisherQuickFilters } from "./publisher-quick-filters";
import { PublisherSummaryCards, usePublisherSummaryCards } from "./publisher-summary-cards";
import { PublisherToolbar } from "./publisher-toolbar";
import { PublishersContent } from "./publishers-content";

export function AllPublishers() {
  const t = useTranslations("publishers");
  const router = useRouter();
  const query = usePublisherQuery();
  const list = usePublishersList(query.listQuery);
  const summary = usePublisherSummary();
  const summaryCards = usePublisherSummaryCards(summary.data);

  const state = resolvePublishersArchiveState({
    hasActiveFilters: query.hasActiveFilters,
    hasActiveSearch: query.hasActiveSearch,
    list: list.data ?? null,
    listFailed: list.isError,
    summaryPending: summary.isPending,
    summaryPublishersCount: summary.data?.publishersCount ?? null,
  });

  const resultsAnnouncement = announceResults(state, t);
  const showInsights = state.kind !== "empty" && hasPublisherInsights(summary.data);
  const onAddBook = () => router.push("/books/new");

  const chips: ActiveFilterChip[] = [];
  const search = query.state.q.trim();
  if (search !== "") {
    chips.push({
      key: "q",
      label: t("activeFilters.search", { query: search }),
      onRemove: query.clearSearch,
    });
  }
  if (query.advancedFilters.geography !== PUBLISHERS_QUERY_DEFAULTS.geography) {
    chips.push({
      key: "geography",
      label: t("activeFilters.geography", {
        label: t(`advancedFilters.geographyOptions.${query.advancedFilters.geography}`),
      }),
      onRemove: query.clearGeography,
    });
  }
  if (query.advancedFilters.source !== PUBLISHERS_QUERY_DEFAULTS.source) {
    chips.push({
      key: "source",
      label: t("activeFilters.source", {
        label: t(`advancedFilters.sourceOptions.${query.advancedFilters.source}`),
      }),
      onRemove: query.clearSource,
    });
  }
  for (const filter of PUBLISHERS_BOOLEAN_FILTERS) {
    if (!query.advancedFilters[filter]) continue;
    chips.push({
      key: filter,
      label: t(`advancedFilters.booleans.${filter}`),
      onRemove: () => query.clearBooleanFilter(filter),
    });
  }

  return (
    <AllPublishersView
      content={
        <PublishersContent
          hasSidebar={showInsights}
          loadMore={{
            hasNextPage: list.hasNextPage,
            isError: list.isFetchNextPageError,
            isFetching: list.isFetchingNextPage,
            onLoadMore: () => void list.fetchNextPage(),
          }}
          onAddBook={onAddBook}
          onClearAll={query.clearAll}
          onClearSearch={query.clearSearch}
          onResetFilters={query.resetFilters}
          onRetry={() => void list.refetch()}
          state={state}
          view={query.state.view}
        />
      }
      controls={
        state.kind === "empty" ? null : (
          <div className="flex flex-col gap-4">
            <PublisherToolbar
              advancedFilters={query.advancedFilters}
              onAdvancedApply={query.applyAdvancedFilters}
              onSearchChange={query.setSearch}
              onSearchClear={query.clearSearch}
              onSortChange={query.setSort}
              onViewChange={query.setView}
              search={query.state.q}
              sort={query.state.sort}
              view={query.state.view}
            />
            <PublisherQuickFilters onChange={query.setQuickFilter} value={query.state.filter} />
            <LibraryActiveFilters chips={chips} onClearAll={query.clearAll} />
            <p aria-live="polite" className="text-sm text-muted-foreground empty:sr-only">
              {resultsAnnouncement}
            </p>
          </div>
        )
      }
      insights={
        showInsights && summary.data !== undefined ? (
          <PublisherInsights summary={summary.data} />
        ) : null
      }
      onAddBook={onAddBook}
      summary={
        <PublisherSummaryCards
          cards={summaryCards}
          isError={summary.isError}
          isLoading={summary.isPending}
          mobileAction={
            <PublisherOverviewPanel
              isLoading={summary.isPending}
              showInsights={showInsights}
              summary={summary.data}
              summaryCards={summaryCards}
            />
          }
          onRetry={() => void summary.refetch()}
        />
      }
    />
  );
}

function announceResults(
  state: PublishersArchiveState,
  t: ReturnType<typeof useTranslations<"publishers">>,
): string {
  switch (state.kind) {
    case "empty":
    case "error":
    case "loading":
      return "";
    case "noFilteredResults":
      return t("results.noFilteredResultsAnnouncement");
    case "noSearchResults":
      return t("results.noSearchResultsAnnouncement");
    case "results":
      return t("results.counter", { shown: state.items.length, total: state.totalCount });
  }
}
