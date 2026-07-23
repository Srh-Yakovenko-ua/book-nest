"use client";

import { useRouter } from "@/i18n/navigation";

import { usePublisherSummary } from "../api/use-publisher-summary";
import { usePublishersList } from "../api/use-publishers-list";
import { usePublisherQuery } from "../model/use-publisher-query";
import { AllPublishersView } from "./all-publishers-view";
import { PublisherPagination } from "./publisher-pagination";
import { PublisherSummaryCards } from "./publisher-summary-cards";
import { PublisherToolbar } from "./publisher-toolbar";
import { PublishersContent } from "./publishers-content";
import { PublishersMissingBanner } from "./publishers-missing-banner";

export function AllPublishers() {
  const router = useRouter();
  const query = usePublisherQuery();
  const list = usePublishersList(query.listParams);
  const summary = usePublisherSummary();

  const publishers = list.data?.items ?? [];
  const hasActiveQuery = query.hasActiveFilters || query.hasActiveSearch;
  const showChrome = !list.isError && (list.isPending || publishers.length > 0 || hasActiveQuery);

  const onAddBook = () => router.push("/books/new");

  return (
    <AllPublishersView
      banner={<PublishersMissingBanner count={summary.data?.booksWithoutPublisherCount ?? 0} />}
      content={
        <PublishersContent
          hasActiveQuery={hasActiveQuery}
          isError={list.isError}
          isPending={list.isPending}
          isPlaceholderData={list.isPlaceholderData}
          onAddBook={onAddBook}
          onClearAll={query.clearAll}
          onRetry={() => void list.refetch()}
          publishers={publishers}
          view={query.state.view}
        />
      }
      onAddBook={onAddBook}
      pagination={
        list.data === undefined || publishers.length === 0 ? null : (
          <PublisherPagination
            onPageChange={query.setPage}
            page={query.page}
            pagesCount={list.data.pagesCount}
          />
        )
      }
      showChrome={showChrome}
      summary={
        <PublisherSummaryCards
          isError={summary.isError}
          isLoading={summary.isPending}
          onRetry={() => void summary.refetch()}
          summary={summary.data}
        />
      }
      toolbar={
        <PublisherToolbar
          booleanFilters={{
            hasBooksToBuy: query.state.hasBooksToBuy,
            hasRatedBooks: query.state.hasRatedBooks,
            hasSeries: query.state.hasSeries,
          }}
          geography={query.state.geography}
          hasActiveFilters={query.hasActiveFilters}
          onClearFilters={query.clearFilters}
          onGeographyChange={query.setGeography}
          onOrderChange={query.setOrder}
          onSearchChange={query.setSearch}
          onSearchClear={query.clearSearch}
          onSortChange={query.setSort}
          onSourceChange={query.setSource}
          onToggleBoolFilter={query.toggleBoolFilter}
          onViewChange={query.setView}
          order={query.state.order}
          search={query.state.search}
          sort={query.state.sort}
          source={query.state.source}
          view={query.state.view}
        />
      }
    />
  );
}
