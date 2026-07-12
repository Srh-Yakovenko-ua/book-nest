"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { Badge } from "@/components/ui/badge";
import { Link, useRouter } from "@/i18n/navigation";
import { EMPTY_STATES } from "@/lib/empty-states";

import type { LibraryActions } from "../model/book-card-actions";
import type { LibraryBook } from "../model/library-book";
import type { LibraryScope } from "../model/library-query";
import type { LibrarySummaryCard } from "./library-summary-cards";

import {
  useBulkAddTags,
  useBulkAddToList,
  useBulkAddToReadingQueue,
  useBulkDeleteBooks,
  useBulkOwnershipStatus,
  useBulkReadingStatus,
  useBulkSetFavorite,
  useRemoveFromReadingQueue,
  useToggleFavorite,
} from "../api/use-book-actions";
import { useLibraryBooks } from "../api/use-books";
import { useFavoritesSummary } from "../api/use-favorites-summary";
import { useGenres } from "../api/use-genres";
import { useTagsSearch } from "../api/use-tags-search";
import { toLibraryBook } from "../model/library-book";
import { LIBRARY_SORT_ORDER } from "../model/library-query";
import {
  activeQuickFilter,
  quickFilterCounts,
  quickFilterPatch,
} from "../model/library-quick-filters";
import { useLibraryFilterChips } from "../model/use-library-filter-chips";
import { useLibraryQuery } from "../model/use-library-query";
import { BooksLibraryView } from "./books-library-view";
import { LibraryActiveFilters } from "./library-active-filters";
import { LibraryAdvancedFilters } from "./library-advanced-filters";
import { LibraryQuickFilters } from "./library-quick-filters";
import { LibrarySearchInput } from "./library-search-input";

const FAVORITES_SCOPE: LibraryScope = "favorites";

export function FavoritesView() {
  const t = useTranslations("books.library");
  const tFav = useTranslations("favorites");
  const tCover = useTranslations("books.cover");
  const tFormat = useTranslations("books.format.options");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tSortOptions = useTranslations("books.library.sort.options");
  const tAgeCategory = useTranslations("books.classification.ageCategoryLabels");
  const router = useRouter();

  const library = useLibraryQuery(FAVORITES_SCOPE);
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
  const summary = useFavoritesSummary();
  const genres = useGenres();
  const tags = useTagsSearch("");
  const [entityLabels, setEntityLabels] = useState<Record<string, string>>({});
  const resultsRegionRef = useRef<HTMLDivElement>(null);

  const toggleFavorite = useToggleFavorite();
  const setFavorite = useBulkSetFavorite();
  const changeReadingStatus = useBulkReadingStatus();
  const changeOwnership = useBulkOwnershipStatus();
  const addToList = useBulkAddToList();
  const addTags = useBulkAddTags();
  const addToQueue = useBulkAddToReadingQueue();
  const removeFromQueue = useRemoveFromReadingQueue();
  const deleteBooks = useBulkDeleteBooks();

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));
  const tagNameById = new Map((tags.data ?? []).map((tag) => [tag.id, tag.name]));

  function rememberEntity(id: string, name: string) {
    setEntityLabels((prev) => (prev[id] === name ? prev : { ...prev, [id]: name }));
  }

  function resolveEntityName(id: string): string | undefined {
    return entityLabels[id] ?? tagNameById.get(id);
  }

  const filterChips = useLibraryFilterChips({
    genreName: (key) => genreNameByKey.get(key) ?? key,
    resolveEntityName,
    setState: library.setState,
    state: library.state,
  });
  const advancedFiltersCount = filterChips.filter((chip) => chip.key !== "q").length;

  const pages = data?.pages ?? [];
  const totalCount = pages[0]?.totalCount ?? 0;
  const books: LibraryBook[] = pages
    .flatMap((page) => page.items)
    .map((book) =>
      toLibraryBook(book, {
        ageBadge18Plus: tAgeCategory("18_plus"),
        borrowedFrom: (name) => t("card.borrowedFrom", { name }),
        formatLabel: (value) => tFormat(value),
        genreName: (key) => genreNameByKey.get(key) ?? key,
        lentTo: (name) => t("card.lentTo", { name }),
        ownershipLabel: (value) => tOwnership(value),
        pagesText: (value) => t("meta.pages", { value }),
        progressAriaLabel: (current, total) => t("progress.ariaLabel", { current, total }),
        progressUnit: t("progress.unit"),
        ratingLabel: (value) => t("rating.ariaLabel", { value }),
        seriesPosition: (position, total) => t("card.seriesPosition", { position, total }),
        statusLabel: (value) => tStatus(value),
      }),
    );

  const visibleBookIdsKey = books.map((book) => book.id).join("\n");
  const previousVisibleBookIdsKey = useRef(visibleBookIdsKey);

  useEffect(() => {
    const previousKey = previousVisibleBookIdsKey.current;
    previousVisibleBookIdsKey.current = visibleBookIdsKey;

    const previousIds = previousKey === "" ? [] : previousKey.split("\n");
    const currentIds = visibleBookIdsKey === "" ? [] : visibleBookIdsKey.split("\n");
    const removedVisibleBook = previousIds.some((id) => !currentIds.includes(id));
    const focusLeftToBody =
      document.activeElement === null || document.activeElement === document.body;
    if (!removedVisibleBook || !focusLeftToBody) return;

    resultsRegionRef.current?.focus({ preventScroll: true });
  }, [visibleBookIdsKey]);

  const favoritesTotal = summary.data?.total ?? 0;
  const summaryCards: LibrarySummaryCard[] = [
    { icon: "heart", label: tFav("summary.total"), value: favoritesTotal },
    { icon: "check-circle", label: tFav("summary.finished"), value: summary.data?.finished ?? 0 },
    { icon: "book", label: tFav("summary.reading"), value: summary.data?.reading ?? 0 },
    {
      icon: "star",
      label: tFav("summary.averageRating"),
      value: formatAverageRating(summary.data?.averageRating, tFav("summary.averageRatingEmpty")),
    },
  ];

  const sortOptions = LIBRARY_SORT_ORDER.map((value) => ({ label: tSortOptions(value), value }));

  async function runWithToast(action: () => Promise<unknown>, successMessage: string) {
    try {
      await action();
      toast.success(successMessage);
    } catch (error) {
      toast.error(t("toast.error"));
      throw error;
    }
  }

  const actions: LibraryActions = {
    onAddTags: (input) => runWithToast(() => addTags.mutateAsync(input), t("toast.tagsAdded")),
    onAddToList: (input) =>
      runWithToast(() => addToList.mutateAsync(input), t("toast.addedToList")),
    onAddToQueue: (bookIds) =>
      runWithToast(() => addToQueue.mutateAsync(bookIds), t("toast.queueAdded")),
    onChangeOwnership: (input) =>
      runWithToast(() => changeOwnership.mutateAsync(input), t("toast.ownershipChanged")),
    onChangeReadingStatus: (input) =>
      runWithToast(() => changeReadingStatus.mutateAsync(input), t("toast.readingStatusChanged")),
    onDelete: (bookIds) =>
      runWithToast(
        () => deleteBooks.mutateAsync(bookIds),
        t("toast.deleted", { count: bookIds.length }),
      ),
    onEdit: (bookId) => router.push(`/books/${bookId}/edit`),
    onRemoveFromQueue: (id) =>
      runWithToast(() => removeFromQueue.mutateAsync(id), t("toast.queueRemoved")),
    onSetFavorite: (input) =>
      runWithToast(
        () => setFavorite.mutateAsync(input),
        input.isFavorite ? t("toast.favoriteAdded") : t("toast.favoriteRemoved"),
      ),
    onToggleFavorite: ({ id, isFavorite }) => {
      toggleFavorite.mutate({ id, isFavorite }, { onError: () => toast.error(t("toast.error")) });
      if (isFavorite) return;
      toast(tFav("remove.toast"), {
        action: {
          label: tFav("remove.undo"),
          onClick: () =>
            toggleFavorite.mutate(
              { id, isFavorite: true },
              { onError: () => toast.error(t("toast.error")) },
            ),
        },
      });
    },
  };

  const errorState: EmptyStateEntry = {
    desc: t("error.description"),
    illu: "error-generic",
    primary: { icon: "refresh", label: t("error.retry") },
    title: t("error.title"),
  };

  const noSearchResultsState: EmptyStateEntry = {
    desc: t("noSearchResults.description"),
    illu: "empty-search",
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
    <div className="focus:outline-none" ref={resultsRegionRef} tabIndex={-1}>
      <BooksLibraryView
        actions={actions}
        activeFilters={<LibraryActiveFilters chips={filterChips} onClearAll={library.clearAll} />}
        advancedFilters={
          <LibraryAdvancedFilters
            activeCount={advancedFiltersCount}
            onRememberEntity={rememberEntity}
            resolveEntityName={resolveEntityName}
            scope={FAVORITES_SCOPE}
            setState={library.setState}
            state={library.state}
          />
        }
        allShownLabel={t("allShown")}
        books={books}
        counterLabel={t("counter", { shown: books.length, total: totalCount })}
        coverViewLabel={tCover("viewer.open")}
        emptyState={EMPTY_STATES.favorites}
        errorState={errorState}
        hasActiveFilters={library.hasActiveFilters}
        hasActiveSearch={library.hasActiveSearch}
        hasNextPage={hasNextPage}
        isError={isError}
        isFetchingNextPage={isFetchingNextPage}
        isLoadMoreError={isFetchNextPageError}
        isPending={isPending}
        libraryTotal={favoritesTotal}
        linkComponent={Link}
        loadingLabel={t("loading")}
        loadMoreErrorLabel={t("loadMoreError")}
        loadMoreLabel={t("loadMore")}
        noFilteredResultsState={noFilteredResultsState}
        noSearchResultsState={noSearchResultsState}
        onAddBook={() => router.push("/books")}
        onClearAll={library.clearAll}
        onClearFilters={library.clearFilters}
        onClearSearch={library.clearSearch}
        onLoadMore={() => void fetchNextPage()}
        onRetry={() => void refetch()}
        onSortChange={library.setSort}
        onViewChange={library.setView}
        quickFilters={
          <LibraryQuickFilters
            counts={summary.data === undefined ? undefined : quickFilterCounts(summary.data)}
            onSelect={(key) => void library.setState(quickFilterPatch(key))}
            scope={FAVORITES_SCOPE}
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
        sort={library.sort}
        sortLabel={t("sort.label")}
        sortOptions={sortOptions}
        subtitle={tFav("subtitle")}
        summaryCards={summaryCards}
        summaryLoading={summary.isPending}
        title={tFav("title")}
        titleBadge={
          summary.data === undefined ? undefined : (
            <Badge variant="secondary">{tFav("countBadge", { count: favoritesTotal })}</Badge>
          )
        }
        view={library.view}
        viewLabels={{ grid: t("view.grid"), label: t("view.label"), list: t("view.list") }}
      />
    </div>
  );
}

function formatAverageRating(value: null | number | undefined, emptyLabel: string): string {
  if (value === null || value === undefined) return emptyLabel;
  return value.toFixed(1);
}
