"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { type ActiveFilterChip, ActiveFilters } from "@/components/catalog/active-filters";
import { UiIcon } from "@/components/icons";
import { RefetchErrorBanner } from "@/components/refetch-error-banner";
import { Button } from "@/components/ui/button";
import { BOOK_CREATE_PATH } from "@/features/books/model/book-create-href";
import { useRetryFocus } from "@/hooks/use-retry-focus";
import { useRouter } from "@/i18n/navigation";
import { collectionChrome } from "@/lib/collection-chrome";

import { usePublisherQuickCounts } from "../api/use-publisher-quick-counts";
import { usePublisherSummary } from "../api/use-publisher-summary";
import { usePublishersList } from "../api/use-publishers-list";
import { buildMissingPublisherBooksHref } from "../model/missing-publisher-books-href";
import {
  type PublishersArchiveState,
  resolvePublishersArchiveState,
  resolvePublishersEmptyEntry,
} from "../model/publisher-archive-state";
import {
  PUBLISHERS_BOOLEAN_FILTERS,
  PUBLISHERS_QUERY_DEFAULTS,
  toPublishersQuickCountsParams,
} from "../model/publisher-query";
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
  const tCommon = useTranslations("common");
  const router = useRouter();
  const query = usePublisherQuery();
  const list = usePublishersList(query.listQuery);
  const quickCounts = usePublisherQuickCounts(toPublishersQuickCountsParams(query.listQuery));
  const summary = usePublisherSummary();
  const summaryCards = usePublisherSummaryCards(summary.data);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(resultsHeadingRef);

  const state = resolvePublishersArchiveState({
    hasActiveFilters: query.hasActiveFilters,
    hasActiveSearch: query.hasActiveSearch,
    list: list.data ?? null,
    listFailed: list.isLoadingError,
    listIsPlaceholder: list.isPlaceholderData,
    summaryPending: summary.isPending,
    summaryPublishersCount: summary.data?.publishersCount ?? null,
  });

  const resultsAnnouncement =
    state.kind === "results" && state.isRefreshing
      ? tCommon("updating")
      : announceResults(state, t);
  const emptyEntry = resolvePublishersEmptyEntry({
    summary: summary.data ?? null,
    summaryFailed: summary.isLoadingError,
  });
  const hasQuery = query.hasActiveFilters || query.hasActiveSearch;
  const chrome = collectionChrome({ baseTotal: summary.data?.publishersCount, hasQuery });
  const showControls = chrome.showTools && (state.kind !== "empty" || hasQuery);
  const showHeaderAction = state.kind !== "empty" || emptyEntry !== "addFirstBook";
  const showInsights = state.kind !== "empty" && hasPublisherInsights(summary.data);
  const onAddBook = () => router.push(BOOK_CREATE_PATH);

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
      action={
        showHeaderAction ? (
          <Button className="self-start sm:self-auto" onClick={onAddBook}>
            <UiIcon name="plus" size={16} />
            {t("page.addBook")}
          </Button>
        ) : null
      }
      content={
        <>
          <RefetchErrorBanner
            state={
              list.isRefetchError
                ? { isRetrying: list.isRefetching, onRetry: () => void list.refetch() }
                : null
            }
          />
          <PublishersContent
            emptyEntry={emptyEntry}
            hasSidebar={showInsights}
            loadMore={{
              hasNextPage: list.hasNextPage && !list.isPlaceholderData,
              isError: list.isFetchNextPageError,
              isFetching: list.isFetchingNextPage,
              onLoadMore: () => void list.fetchNextPage(),
            }}
            onAddBook={onAddBook}
            onClearAll={query.clearAll}
            onClearSearch={query.clearSearch}
            onOpenBooksWithoutPublisher={() => router.push(buildMissingPublisherBooksHref())}
            onResetFilters={query.resetFilters}
            onRetry={withRetryFocus(() => void list.refetch())}
            onRetrySummary={withRetryFocus(() => void summary.refetch())}
            retryButtonRef={retryButtonRef}
            state={state}
            view={query.state.view}
          />
        </>
      }
      controls={
        showControls ? (
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
            <PublisherQuickFilters
              counts={quickCounts.data}
              countsPending={quickCounts.isPending}
              onChange={query.setQuickFilter}
              value={query.state.filter}
            />
            <ActiveFilters chips={chips} onClearAll={query.clearAll} />
            <p aria-live="polite" className="text-sm text-muted-foreground empty:sr-only">
              {resultsAnnouncement}
            </p>
          </div>
        ) : null
      }
      insights={
        showInsights && summary.data !== undefined ? (
          <PublisherInsights summary={summary.data} />
        ) : null
      }
      resultsHeadingRef={resultsHeadingRef}
      summary={
        chrome.showMetrics ? (
          <PublisherSummaryCards
            cards={summaryCards}
            isError={summary.isLoadingError}
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
        ) : null
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
