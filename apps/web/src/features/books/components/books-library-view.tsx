"use client";

import type { MediaView } from "@app/shared";
import type { ReactNode } from "react";

import { LayoutGrid, List, SquareCheckBig } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { EmptyStateEntry } from "@/lib/empty-states";
import type { BooksControllerListSort } from "@/shared/api/generated/model";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { BookCard } from "@/components/ui/book-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";

import type { LibraryActions, PendingBookAction } from "../model/book-card-actions";
import type { LibraryBook, LibraryBookLinkComponent } from "../model/library-book";
import type { LibraryViewMode } from "../model/library-query";
import type { LibrarySortOption } from "./library-sort-select";
import type { LibrarySummaryCard } from "./library-summary-cards";

import { useLibrarySelectionStore } from "../model/selection-store";
import { BookActionDialogs } from "./book-action-dialogs";
import { BookCardActions } from "./book-card-actions";
import { BookRow } from "./book-row";
import { LibraryBulkBar } from "./library-bulk-bar";
import { LibraryCoverViewer } from "./library-cover-viewer";
import { LibrarySortSelect } from "./library-sort-select";
import { LibrarySummaryCards } from "./library-summary-cards";

type ActiveCover = {
  bookId: string;
  media: MediaView;
  title: string;
};

type BooksLibraryViewProps = {
  actions: LibraryActions;
  activeFilters?: ReactNode;
  addBookLabel?: string;
  advancedFilters?: ReactNode;
  allShownLabel: string;
  books: LibraryBook[];
  counterLabel: string;
  coverViewLabel: string;
  emptyState: EmptyStateEntry;
  errorState: EmptyStateEntry;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  hasNextPage: boolean;
  headerDecoration?: ReactNode;
  isError: boolean;
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  isPending: boolean;
  libraryTotal: number;
  linkComponent?: LibraryBookLinkComponent;
  loadingLabel: string;
  loadMoreErrorLabel: string;
  loadMoreLabel: string;
  noFilteredResultsState: EmptyStateEntry;
  noSearchResultsState: EmptyStateEntry;
  onAddBook?: () => void;
  onClearAll: () => void;
  onClearFilters: () => void;
  onClearSearch: () => void;
  onEmptySecondary?: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onSortChange: (value: BooksControllerListSort) => void;
  onViewChange: (value: LibraryViewMode) => void;
  quickFilters?: ReactNode;
  searchControl?: ReactNode;
  sidebar?: ReactNode;
  sort: BooksControllerListSort;
  sortLabel: string;
  sortOptions: LibrarySortOption[];
  subtitle: string;
  summaryCards: LibrarySummaryCard[];
  summaryLoading: boolean;
  summaryMobileAction?: ReactNode;
  summaryMobileCards?: LibrarySummaryCard[];
  summaryMobileLayout?: "compact" | "grid";
  title: string;
  view: LibraryViewMode;
  viewLabels: ViewLabels;
};

type CardRenderProps = {
  renderActions: (book: LibraryBook, compact?: boolean) => ReactNode;
  selectBookLabel: (title: string) => string;
};

type ViewLabels = {
  grid: string;
  label: string;
  list: string;
};

const SKELETON_COUNT = 8;
const STAGGER_STEP_MS = 45;
const STAGGER_MAX_MS = 360;
const GRID_CLASS = "grid grid-cols-2 gap-5 max-sm:gap-3 xl:grid-cols-3";

export function BooksLibraryView(props: BooksLibraryViewProps) {
  const {
    actions,
    addBookLabel,
    books,
    hasActiveFilters,
    hasActiveSearch,
    isError,
    isPending,
    onAddBook,
    sidebar,
    subtitle,
    summaryCards,
    summaryLoading,
    summaryMobileAction,
    summaryMobileCards,
    summaryMobileLayout,
    title,
  } = props;

  const t = useTranslations("books.library");
  const [pending, setPending] = useState<null | PendingBookAction>(null);
  const clearSelection = useLibrarySelectionStore((state) => state.clear);
  const selectionMode = useLibrarySelectionStore((state) => state.selectionMode);
  const exitSelection = useLibrarySelectionStore((state) => state.exitSelection);

  const visibleBookIdsKey = books.map((book) => book.id).join("\n");

  useEffect(() => {
    const ids = visibleBookIdsKey === "" ? [] : visibleBookIdsKey.split("\n");
    useLibrarySelectionStore.getState().setAvailable(ids);
  }, [visibleBookIdsKey]);

  useEffect(() => () => useLibrarySelectionStore.getState().exitSelection(), []);

  useEffect(() => {
    if (!selectionMode) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") exitSelection();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectionMode, exitSelection]);

  const renderActions = (book: LibraryBook, compact?: boolean) => (
    <BookCardActions actions={actions} book={book} compact={compact} onOpenDialog={setPending} />
  );
  const selectBookLabel = (title: string) => t("bulk.selectBook", { title });

  const showToolbar =
    !isError && (isPending || books.length > 0 || hasActiveSearch || hasActiveFilters);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
                {title}
              </h1>
              <TitleLeaf />
            </div>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {onAddBook && addBookLabel ? (
            <Button className="self-start sm:self-auto" onClick={onAddBook}>
              <UiIcon name="plus" size={16} />
              {addBookLabel}
            </Button>
          ) : null}
        </div>

        <LibrarySummaryCards
          cards={summaryCards}
          isLoading={summaryLoading}
          mobileAction={summaryMobileAction}
          mobileCards={summaryMobileCards}
          mobileLayout={summaryMobileLayout}
        />
      </header>

      {showToolbar ? <LibraryToolbar {...props} /> : null}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <h2 className="sr-only">{t("resultsTitle")}</h2>
          <LibraryContent
            {...props}
            renderActions={renderActions}
            selectBookLabel={selectBookLabel}
          />
        </div>
        {showToolbar && sidebar ? sidebar : null}
      </div>

      <LibrarySelectionBar actions={actions} books={books} onOpenDialog={setPending} />

      <BookActionDialogs
        actions={actions}
        onClearSelection={clearSelection}
        onClose={() => setPending(null)}
        pending={pending}
      />
    </div>
  );
}

function BookCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <Skeleton className="aspect-[3/4] w-full rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="mt-1 h-5 w-24 rounded-full max-sm:hidden" />
        <div className="mt-1 flex items-center gap-1.5 max-sm:hidden">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function BooksGrid({
  books,
  coverViewLabel,
  linkComponent,
  onActivateCover,
  renderActions,
  selectBookLabel,
}: CardRenderProps & {
  books: LibraryBook[];
  coverViewLabel: string;
  linkComponent?: LibraryBookLinkComponent;
  onActivateCover: (cover: ActiveCover) => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={GRID_CLASS}>
      {books.map((book, index) => (
        <LibraryGridCard
          book={book}
          coverViewLabel={coverViewLabel}
          index={index}
          key={book.id}
          linkComponent={linkComponent}
          onActivateCover={onActivateCover}
          prefersReducedMotion={prefersReducedMotion}
          renderActions={renderActions}
          selectBookLabel={selectBookLabel}
        />
      ))}
    </div>
  );
}

function BooksGridSkeleton() {
  return (
    <div aria-busy className={GRID_CLASS}>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="grid motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in"
          key={index}
          style={{ animationDelay: staggerDelay(index) }}
        >
          <BookCardSkeleton />
        </div>
      ))}
    </div>
  );
}

function LibraryContent({
  allShownLabel,
  books,
  coverViewLabel,
  emptyState,
  errorState,
  hasActiveFilters,
  hasActiveSearch,
  hasNextPage,
  isError,
  isFetchingNextPage,
  isLoadMoreError,
  isPending,
  libraryTotal,
  linkComponent,
  loadMoreErrorLabel,
  loadMoreLabel,
  noFilteredResultsState,
  noSearchResultsState,
  onAddBook,
  onClearAll,
  onClearFilters,
  onClearSearch,
  onEmptySecondary,
  onLoadMore,
  onRetry,
  renderActions,
  selectBookLabel,
  summaryLoading,
  view,
}: BooksLibraryViewProps & CardRenderProps) {
  const [activeCover, setActiveCover] = useState<ActiveCover | null>(null);

  if (isError) {
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState onPrimary={onRetry} onSecondary={onAddBook} state={errorState} />
      </div>
    );
  }

  if (isPending) {
    return <BooksGridSkeleton />;
  }

  if (books.length === 0) {
    if (!summaryLoading && libraryTotal === 0) {
      return <EmptyState onPrimary={onAddBook} onSecondary={onEmptySecondary} state={emptyState} />;
    }
    if (hasActiveSearch && !hasActiveFilters) {
      return <EmptyState onPrimary={onClearSearch} state={noSearchResultsState} />;
    }
    if (hasActiveFilters) {
      return (
        <EmptyState
          onPrimary={onClearFilters}
          onSecondary={onClearAll}
          state={noFilteredResultsState}
        />
      );
    }
    return <EmptyState onPrimary={onAddBook} onSecondary={onEmptySecondary} state={emptyState} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {view === "list" ? (
        <div className="flex flex-col gap-2.5">
          {books.map((book) => (
            <LibraryListRow
              book={book}
              key={book.id}
              linkComponent={linkComponent}
              renderActions={renderActions}
              selectBookLabel={selectBookLabel}
            />
          ))}
        </div>
      ) : (
        <BooksGrid
          books={books}
          coverViewLabel={coverViewLabel}
          linkComponent={linkComponent}
          onActivateCover={setActiveCover}
          renderActions={renderActions}
          selectBookLabel={selectBookLabel}
        />
      )}

      <div className="flex flex-col items-center gap-2 pt-2">
        <PaginationFooter
          allShownLabel={allShownLabel}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isLoadMoreError={isLoadMoreError}
          loadMoreErrorLabel={loadMoreErrorLabel}
          loadMoreLabel={loadMoreLabel}
          onLoadMore={onLoadMore}
        />
      </div>

      {activeCover && (
        <LibraryCoverViewer
          bookId={activeCover.bookId}
          key={activeCover.bookId}
          media={activeCover.media}
          onClose={() => setActiveCover(null)}
          title={activeCover.title}
        />
      )}
    </div>
  );
}

function LibraryGridCard({
  book,
  coverViewLabel,
  index,
  linkComponent,
  onActivateCover,
  prefersReducedMotion,
  renderActions,
  selectBookLabel,
}: CardRenderProps & {
  book: LibraryBook;
  coverViewLabel: string;
  index: number;
  linkComponent?: LibraryBookLinkComponent;
  onActivateCover: (cover: ActiveCover) => void;
  prefersReducedMotion: boolean | null;
}) {
  const selected = useLibrarySelectionStore((state) => state.selectedIds.has(book.id));
  const selectionMode = useLibrarySelectionStore((state) => state.selectionMode);
  const toggle = useLibrarySelectionStore((state) => state.toggle);
  const coverMedia = book.coverMedia;

  return (
    <div
      className="relative grid motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
      style={{ animationDelay: staggerDelay(index) }}
    >
      {selectionMode ? (
        <div className="absolute -top-2.5 -left-2.5 z-30">
          <SelectionCheckbox
            checked={selected}
            label={selectBookLabel(book.title)}
            onToggle={() => toggle(book.id)}
          />
        </div>
      ) : null}
      <motion.div
        className="grid h-full"
        transition={{ duration: 0.2, ease: "easeOut" }}
        whileHover={prefersReducedMotion ? undefined : { y: -4 }}
      >
        <BookCard
          ageBadge={book.ageBadge}
          authors={book.authors}
          cover={book.cover}
          coverActivateLabel={coverViewLabel}
          formats={book.formats}
          genres={book.genres}
          href={book.href}
          kebab={renderActions(book, true)}
          linkComponent={linkComponent}
          mobileCompact
          onCoverActivate={
            coverMedia
              ? () => onActivateCover({ bookId: book.id, media: coverMedia, title: book.title })
              : undefined
          }
          ownership={book.ownership}
          ownershipTooltip={book.loan?.text}
          progress={book.progress}
          publisher={book.publisher}
          rating={book.rating}
          ratingLabel={book.ratingLabel}
          selected={selected}
          series={book.series}
          status={book.status}
          tags={book.tags}
          title={book.title}
        />
      </motion.div>
    </div>
  );
}

function LibraryListRow({
  book,
  linkComponent,
  renderActions,
  selectBookLabel,
}: CardRenderProps & {
  book: LibraryBook;
  linkComponent?: LibraryBookLinkComponent;
}) {
  const selected = useLibrarySelectionStore((state) => state.selectedIds.has(book.id));
  const selectionMode = useLibrarySelectionStore((state) => state.selectionMode);
  const toggle = useLibrarySelectionStore((state) => state.toggle);

  return (
    <BookRow
      book={book}
      kebab={renderActions(book)}
      linkComponent={linkComponent}
      mobileCompact
      selected={selected}
      selectionControl={
        selectionMode ? (
          <SelectionCheckbox
            checked={selected}
            label={selectBookLabel(book.title)}
            onToggle={() => toggle(book.id)}
          />
        ) : undefined
      }
    />
  );
}

function LibrarySelectionBar({
  actions,
  books,
  onOpenDialog,
}: {
  actions: LibraryActions;
  books: LibraryBook[];
  onOpenDialog: (action: PendingBookAction) => void;
}) {
  const t = useTranslations("books.library");
  const selectedIds = useLibrarySelectionStore((state) => state.selectedIds);
  const clearSelection = useLibrarySelectionStore((state) => state.clear);

  const selectedBookIds = books.filter((book) => selectedIds.has(book.id)).map((book) => book.id);

  function runBulk(action: () => Promise<void>) {
    void action()
      .then(() => clearSelection())
      .catch(() => {});
  }

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {selectedBookIds.length > 0 ? t("bulk.selected", { count: selectedBookIds.length }) : ""}
      </p>

      {selectedBookIds.length > 0 ? (
        <LibraryBulkBar
          count={selectedBookIds.length}
          onAddFavorite={() =>
            runBulk(() => actions.onSetFavorite({ bookIds: selectedBookIds, isFavorite: true }))
          }
          onAddTags={() =>
            onOpenDialog({ bookIds: selectedBookIds, clearSelectionOnSuccess: true, type: "tags" })
          }
          onAddToList={() =>
            onOpenDialog({ bookIds: selectedBookIds, clearSelectionOnSuccess: true, type: "list" })
          }
          onAddToQueue={() => runBulk(() => actions.onAddToQueue(selectedBookIds))}
          onChangeOwnership={() =>
            onOpenDialog({
              bookIds: selectedBookIds,
              clearSelectionOnSuccess: true,
              type: "ownership",
            })
          }
          onChangeReadingStatus={() =>
            onOpenDialog({
              bookIds: selectedBookIds,
              clearSelectionOnSuccess: true,
              type: "readingStatus",
            })
          }
          onClear={clearSelection}
          onDelete={() =>
            onOpenDialog({
              bookIds: selectedBookIds,
              clearSelectionOnSuccess: true,
              type: "delete",
            })
          }
          onRemoveFavorite={() =>
            runBulk(() => actions.onSetFavorite({ bookIds: selectedBookIds, isFavorite: false }))
          }
        />
      ) : null}
    </>
  );
}

function LibraryToolbar({
  activeFilters,
  advancedFilters,
  counterLabel,
  isPending,
  loadingLabel,
  onSortChange,
  onViewChange,
  quickFilters,
  searchControl,
  sort,
  sortLabel,
  sortOptions,
  view,
  viewLabels,
}: BooksLibraryViewProps) {
  const t = useTranslations("books.library");
  const selectionMode = useLibrarySelectionStore((state) => state.selectionMode);
  const enterSelection = useLibrarySelectionStore((state) => state.enterSelection);
  const exitSelection = useLibrarySelectionStore((state) => state.exitSelection);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {searchControl ? <div className="lg:flex-1">{searchControl}</div> : null}
        <div className="flex flex-wrap items-center gap-2.5 max-sm:flex-nowrap max-sm:gap-1.5">
          <LibrarySortSelect
            label={sortLabel}
            onChange={onSortChange}
            options={sortOptions}
            value={sort}
          />
          {advancedFilters}
          <Button
            className="h-10 max-sm:w-10 max-sm:px-0"
            onClick={selectionMode ? exitSelection : enterSelection}
            variant={selectionMode ? "secondary" : "outline"}
          >
            <SquareCheckBig />
            <span className="max-sm:sr-only">
              {selectionMode ? t("bulk.exitSelection") : t("bulk.enterSelection")}
            </span>
          </Button>
          <Segmented
            className="ml-auto h-10 shrink-0 items-stretch [&_[data-slot=segmented-item]]:py-0 max-sm:[&_[data-slot=segmented-item]]:px-2.5"
            label={viewLabels.label}
            onValueChange={(next) => onViewChange(next === "list" ? "list" : "grid")}
            options={[
              {
                icon: <LayoutGrid />,
                label: <span className="max-sm:sr-only">{viewLabels.grid}</span>,
                value: "grid",
              },
              {
                icon: <List />,
                label: <span className="max-sm:sr-only">{viewLabels.list}</span>,
                value: "list",
              },
            ]}
            value={view}
          />
        </div>
      </div>

      {quickFilters}
      {activeFilters}

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {isPending ? loadingLabel : counterLabel}
      </p>
    </div>
  );
}

function PaginationFooter({
  allShownLabel,
  hasNextPage,
  isFetchingNextPage,
  isLoadMoreError,
  loadMoreErrorLabel,
  loadMoreLabel,
  onLoadMore,
}: {
  allShownLabel: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  loadMoreErrorLabel: string;
  loadMoreLabel: string;
  onLoadMore: () => void;
}) {
  if (!hasNextPage) {
    return <p className="text-xs text-muted-foreground">{allShownLabel}</p>;
  }

  return (
    <>
      {isLoadMoreError ? (
        <p className="text-sm text-error" role="alert">
          {loadMoreErrorLabel}
        </p>
      ) : null}
      <Button
        disabled={isFetchingNextPage}
        loading={isFetchingNextPage}
        onClick={onLoadMore}
        variant="secondary"
      >
        {loadMoreLabel}
      </Button>
    </>
  );
}

function SelectionCheckbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <span className="grid size-9 cursor-pointer place-items-center rounded-2xl border border-[color:var(--book-overlay-pill-border)] bg-[var(--book-overlay-pill-surface)] shadow-[var(--book-overlay-pill-shadow)] backdrop-blur-md transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:scale-105 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100">
      <Checkbox aria-label={label} checked={checked} onCheckedChange={onToggle} />
    </span>
  );
}

function staggerDelay(index: number): string {
  return `${Math.min(index * STAGGER_STEP_MS, STAGGER_MAX_MS)}ms`;
}
