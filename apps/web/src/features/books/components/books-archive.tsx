"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { Link } from "@/i18n/navigation";

import type { LibraryBook } from "../model/library-book";
import type { LibraryPublisherContext, LibraryScope } from "../model/library-query";

import { useLibraryBooks } from "../api/use-books";
import { useGenres } from "../api/use-genres";
import { useLibraryOverview } from "../api/use-library-overview";
import { useSelectedTags } from "../api/use-tags-search";
import { useLibraryActions } from "../hooks/use-library-actions";
import { useLibraryBookLabels } from "../hooks/use-library-book-labels";
import { toLibraryBook } from "../model/library-book";
import { LIBRARY_SORT_ORDER } from "../model/library-query";
import {
  activeQuickFilter,
  quickFilterCounts,
  quickFilterPatch,
} from "../model/library-quick-filters";
import { countAdvancedFilterChips, useLibraryFilterChips } from "../model/use-library-filter-chips";
import { useLibraryQuery } from "../model/use-library-query";
import { LibraryActiveFilters } from "./library-active-filters";
import { LibraryAdvancedFilters } from "./library-advanced-filters";
import { LibraryArchiveView } from "./library-archive-view";
import { LibraryQuickFilters } from "./library-quick-filters";
import { LibrarySearchInput } from "./library-search-input";

type BooksArchiveProps = {
  emptyState: EmptyStateEntry;
  errorState: EmptyStateEntry;
  header?: ReactNode;
  onAddBook: () => void;
  onEmptySecondary?: () => void;
  publisherContext?: LibraryPublisherContext;
  scope: Exclude<LibraryScope, "favorites">;
  sidebar?: ReactNode;
};

export function BooksArchive({
  emptyState,
  errorState,
  header,
  onAddBook,
  onEmptySecondary,
  publisherContext,
  scope,
  sidebar,
}: BooksArchiveProps) {
  const t = useTranslations("books.library");
  const tCover = useTranslations("books.cover");
  const tSortOptions = useTranslations("books.library.sort.options");

  const library = useLibraryQuery(scope, publisherContext);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isFetchNextPageError,
    isPending,
    refetch,
  } = useLibraryBooks(library.listParams);
  const overview = useLibraryOverview(scope, publisherContext);
  const genres = useGenres();
  const selectedTags = useSelectedTags(library.state.tag);
  const [entityLabels, setEntityLabels] = useState<Record<string, string>>({});

  const actions = useLibraryActions();
  const labels = useLibraryBookLabels();

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  function rememberEntity(id: string, name: string) {
    setEntityLabels((prev) => (prev[id] === name ? prev : { ...prev, [id]: name }));
  }

  function resolveEntityName(id: string): string | undefined {
    return entityLabels[id] ?? selectedTags.get(id)?.name;
  }

  const filterChips = useLibraryFilterChips({
    genreName: (key) => genreNameByKey.get(key) ?? key,
    resolveEntityName,
    resolveTag: (id) => selectedTags.get(id),
    setState: library.setState,
    state: library.state,
  });

  const pages = data?.pages ?? [];
  const totalCount = pages[0]?.totalCount ?? 0;
  const books: LibraryBook[] = pages
    .flatMap((page) => page.items)
    .map((book) => toLibraryBook(book, labels));
  const summary = overview.data?.summary;

  const noSearchResultsState: EmptyStateEntry = {
    desc: t("noSearchResults.description"),
    illu: "empty-search",
    illuSize: "sm",
    primary: { icon: "x", label: t("noSearchResults.clearSearch") },
    title: t("noSearchResults.title"),
  };

  const noFilteredResultsState: EmptyStateEntry = {
    desc: t("noFilteredResults.description"),
    illu: "empty-search",
    primary: { icon: "x", label: t("noFilteredResults.clearFilters") },
    secondary: { icon: "refresh", label: t("noFilteredResults.clearAll") },
    title: t("noFilteredResults.title"),
  };

  return (
    <LibraryArchiveView
      actions={actions}
      activeFilters={<LibraryActiveFilters chips={filterChips} onClearAll={library.clearAll} />}
      advancedFilters={
        <LibraryAdvancedFilters
          activeCount={countAdvancedFilterChips(filterChips)}
          onRememberEntity={rememberEntity}
          publisherContext={publisherContext}
          resolveEntityName={resolveEntityName}
          scope={scope}
          setState={library.setState}
          state={library.state}
        />
      }
      allShownLabel={t("allShown")}
      books={books}
      counterLabel={t("counter", { shown: books.length, total: totalCount })}
      coverViewLabel={tCover("viewer.open")}
      emptyState={emptyState}
      errorState={errorState}
      hasActiveFilters={library.hasActiveFilters}
      hasActiveSearch={library.hasActiveSearch}
      hasNextPage={hasNextPage}
      header={header}
      isError={isError}
      isFetchingNextPage={isFetchingNextPage}
      isLoadMoreError={isFetchNextPageError}
      isPending={isPending}
      libraryTotal={summary?.total ?? 0}
      libraryTotalLoading={overview.isPending}
      linkComponent={Link}
      loadingLabel={t("loading")}
      loadMoreErrorLabel={t("loadMoreError")}
      loadMoreLabel={t("loadMore")}
      noFilteredResultsState={noFilteredResultsState}
      noSearchResultsState={noSearchResultsState}
      onAddBook={onAddBook}
      onClearAll={library.clearAll}
      onClearFilters={library.clearFilters}
      onClearSearch={library.clearSearch}
      onEmptySecondary={onEmptySecondary}
      onLoadMore={() => void fetchNextPage()}
      onRetry={() => void refetch()}
      onSortChange={library.setSort}
      onViewChange={library.setView}
      quickFilters={
        <LibraryQuickFilters
          counts={summary === undefined ? undefined : quickFilterCounts(summary)}
          onSelect={(key) => void library.setState(quickFilterPatch(key))}
          scope={scope}
          value={activeQuickFilter(library.state)}
        />
      }
      searchControl={
        <LibrarySearchInput
          onClear={library.clearSearch}
          onSearch={library.setSearch}
          value={library.state.q}
        />
      }
      showPublisher={publisherContext === undefined}
      sidebar={sidebar}
      sort={library.sort}
      sortLabel={t("sort.label")}
      sortOptions={LIBRARY_SORT_ORDER.map((value) => ({ label: tSortOptions(value), value }))}
      view={library.view}
      viewLabels={{ grid: t("view.grid"), label: t("view.label"), list: t("view.list") }}
    />
  );
}
