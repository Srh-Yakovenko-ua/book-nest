"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { Progress } from "@/components/ui/progress";
import { Link, useRouter } from "@/i18n/navigation";

import type { LibraryActions } from "../model/book-card-actions";
import type { LibraryBook } from "../model/library-book";

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
import { useGenres } from "../api/use-genres";
import { useLibraryOverview } from "../api/use-library-overview";
import { useTagsSearch } from "../api/use-tags-search";
import { toLibraryBook } from "../model/library-book";
import { LIBRARY_SORT_ORDER, type LibraryScope } from "../model/library-query";
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
import { type LibrarySummaryCard } from "./library-summary-cards";
import { LibrarySummarySidebar } from "./library-summary-sidebar";

export function BooksLibrary({ scope }: { scope: Exclude<LibraryScope, "favorites"> }) {
  const t = useTranslations("books.library");
  const tCover = useTranslations("books.cover");
  const tFormat = useTranslations("books.format.options");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tSortOptions = useTranslations("books.library.sort.options");
  const tAgeCategory = useTranslations("books.classification.ageCategoryLabels");
  const router = useRouter();

  const library = useLibraryQuery(scope);
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
  const overview = useLibraryOverview(scope);
  const genres = useGenres();
  const tags = useTagsSearch("");
  const [entityLabels, setEntityLabels] = useState<Record<string, string>>({});

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

  const summary = overview.data?.summary;
  const activeReading = overview.data?.activeReading;
  const total = summary?.total ?? 0;
  const reading = summary?.reading ?? 0;
  const finished = summary?.finished ?? 0;
  const favorites = summary?.favorites ?? 0;

  const bookUnit = (count: number) => t("summary.unitBook", { count });

  const totalMicrofact = ((): ReactNode => {
    const seriesCount = summary?.seriesCount;
    const authorsCount = summary?.authorsCount;
    if (authorsCount === undefined || authorsCount === 0) return undefined;
    const authorsPart = `${authorsCount.toLocaleString()} ${t("summary.unitAuthor", { count: authorsCount })}`;
    if (seriesCount === undefined || seriesCount === 0) {
      return <span className="block truncate">{authorsPart}</span>;
    }
    const seriesPart = `${seriesCount.toLocaleString()} ${t("summary.unitSeries", { count: seriesCount })}`;
    return <span className="block truncate">{`${seriesPart} · ${authorsPart}`}</span>;
  })();

  const readingMicrofact = ((): ReactNode => {
    if (activeReading === undefined) return undefined;
    if (reading === 0) return <span className="block truncate">{t("summary.readingNone")}</span>;
    if (activeReading.book !== null) {
      const { currentPage, pagesCount } = activeReading.book;
      const percent = pagesCount > 0 ? Math.round((currentPage / pagesCount) * 100) : 0;
      return (
        <div className="flex flex-col gap-1">
          <Progress aria-hidden className="h-1 w-4/5" value={percent} />
          <span className="block truncate">
            {t("summary.readingProgress", { current: currentPage, percent, total: pagesCount })}
          </span>
        </div>
      );
    }
    const many = `${reading.toLocaleString()} ${bookUnit(reading)} · ${t("summary.readingPagesAhead", { pagesAhead: activeReading.pagesAhead })}`;
    return <span className="block truncate">{many}</span>;
  })();

  const finishedMicrofact = ((): ReactNode => {
    const physicallyAvailable = summary?.physicallyAvailable;
    if (physicallyAvailable === undefined || physicallyAvailable === 0) return undefined;
    const percent = Math.round((finished / physicallyAvailable) * 100);
    return <span className="block truncate">{t("summary.finishedPercent", { percent })}</span>;
  })();

  const favoritesMicrofact = ((): ReactNode => {
    if (total === 0) return undefined;
    const percent = Math.round((favorites / total) * 100);
    return <span className="block truncate">{t("summary.favoritesPercent", { percent })}</span>;
  })();

  const summaryCards: LibrarySummaryCard[] = [
    {
      icon: "library",
      iconTone: "primary",
      label: t("summary.total"),
      microfact: totalMicrofact,
      unit: bookUnit(total),
      value: total,
    },
    {
      icon: "book",
      iconTone: "info",
      label: t("summary.reading"),
      microfact: readingMicrofact,
      unit: bookUnit(reading),
      value: reading,
    },
    {
      icon: "check-circle",
      iconTone: "success",
      label: t("summary.finished"),
      microfact: finishedMicrofact,
      unit: bookUnit(finished),
      value: finished,
    },
    {
      icon: "heart",
      iconTone: "favorite",
      label: t("summary.favorites"),
      microfact: favoritesMicrofact,
      unit: bookUnit(favorites),
      value: favorites,
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
    onToggleFavorite: ({ id, isFavorite }) =>
      toggleFavorite.mutate(
        { id, isFavorite },
        {
          onError: () => toast.error(t("toast.error")),
          onSuccess: () =>
            toast.success(isFavorite ? t("toast.favoriteAdded") : t("toast.favoriteRemoved")),
        },
      ),
  };

  const emptyState: EmptyStateEntry = {
    desc: t("empty.description"),
    illu: "empty-library",
    primary: { icon: "plus", label: t("empty.cta") },
    title: t("empty.title"),
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

  const sidebar = (
    <LibrarySummarySidebar
      isLoading={overview.isPending}
      linkComponent={Link}
      recentlyAdded={(overview.data?.recentlyAdded ?? []).map((book) => ({
        author: book.authors.map((author) => author.name).join(", "),
        href: `/books/${book.id}`,
        id: book.id,
        title: book.title,
      }))}
      topGenres={(overview.data?.topGenres ?? []).map((genre) => ({
        count: genre.count,
        key: genre.key,
        name: genreNameByKey.get(genre.key) ?? genre.name,
      }))}
      topTags={(overview.data?.topTags ?? []).map((tag) => ({ id: tag.id, name: tag.name }))}
    />
  );

  return (
    <BooksLibraryView
      actions={actions}
      activeFilters={<LibraryActiveFilters chips={filterChips} onClearAll={library.clearAll} />}
      addBookLabel={t("addBook")}
      advancedFilters={
        <LibraryAdvancedFilters
          activeCount={advancedFiltersCount}
          onRememberEntity={rememberEntity}
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
      isError={isError}
      isFetchingNextPage={isFetchingNextPage}
      isLoadMoreError={isFetchNextPageError}
      isPending={isPending}
      libraryTotal={summary?.total ?? 0}
      linkComponent={Link}
      loadingLabel={t("loading")}
      loadMoreErrorLabel={t("loadMoreError")}
      loadMoreLabel={t("loadMore")}
      noFilteredResultsState={noFilteredResultsState}
      noSearchResultsState={noSearchResultsState}
      onAddBook={() => router.push("/books/new")}
      onClearAll={library.clearAll}
      onClearFilters={library.clearFilters}
      onClearSearch={library.clearSearch}
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
      sidebar={sidebar}
      sort={library.sort}
      sortLabel={t("sort.label")}
      sortOptions={sortOptions}
      subtitle={t(`${scope}.subtitle`)}
      summaryCards={summaryCards}
      summaryLoading={overview.isPending}
      title={t(`${scope}.title`)}
      view={library.view}
      viewLabels={{ grid: t("view.grid"), label: t("view.label"), list: t("view.list") }}
    />
  );
}
