"use client";

import type { CustomListCard, CustomListDetail, ListBookView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { LibraryBookLabels } from "@/features/books/model/library-book";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useGenres } from "@/features/books/api/use-genres";
import { useAddToReadingQueue } from "@/features/books/api/use-reading-queue";
import { ListGoalCard } from "@/features/reading-goals";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { ListBookItemProps } from "../model/list-book-item";
import type { ListDetailEmptyReason } from "../model/list-detail-query";
import type { ListDetailTab } from "../model/list-detail-tabs";

import { useDeleteList } from "../api/use-delete-list";
import { useDuplicateList } from "../api/use-duplicate-list";
import {
  useSetListBookReadingStatus,
  useToggleListBookFavorite,
} from "../api/use-list-book-actions";
import { useListCacheInvalidation } from "../api/use-list-cache";
import { useListFacets } from "../api/use-list-facets";
import {
  useAddBooksToList,
  useMoveListBook,
  useMoveListBookToPosition,
  useRemoveBookFromList,
} from "../api/use-list-membership";
import { useListOverview } from "../api/use-list-overview";
import { useListRelated } from "../api/use-list-related";
import { LIST_BOOK_SORT_DEFAULT } from "../model/list-book-sort";
import { canReorderListDetail, listBookReorder } from "../model/list-reorder";
import { useListSelectionStore } from "../model/list-selection-store";
import { useListBookDrag } from "../model/use-list-book-drag";
import { useListDetailChips } from "../model/use-list-detail-chips";
import { useListDetailQuery } from "../model/use-list-detail-query";
import { AddBooksToListDialog } from "./add-books-to-list-dialog";
import { DeleteListDialog } from "./delete-list-dialog";
import { EditListDialog } from "./edit-list-dialog";
import { ListAboutCard, ListAboutCollapsible } from "./list-about-card";
import { ListBookCard } from "./list-book-card";
import { ListBookRow } from "./list-book-row";
import { ListBulkActions } from "./list-bulk-actions";
import { ListCurrentlyReadingCard } from "./list-currently-reading-card";
import { ListDetailsHeader } from "./list-details-header";
import { ListDetailsToolbar } from "./list-details-toolbar";
import { ListQuickTabs } from "./list-quick-tabs";
import { ListRelatedCard, ListRelatedCollapsible } from "./list-related-card";
import { ListSidebar } from "./list-sidebar";
import { ListStatsCards } from "./list-stats-cards";

type ListDetailsViewProps = {
  hasNextPage: boolean;
  id: string;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  pages: CustomListDetail[];
};

type NoResultsProps = {
  conditions: string[];
  onClearFilters: () => void;
  onClearSearch: () => void;
  reason: ListDetailEmptyReason;
  tab: ListDetailTab;
};

export function ListDetailsView({
  hasNextPage,
  id,
  isFetching,
  isFetchingNextPage,
  onLoadMore,
  pages,
}: ListDetailsViewProps) {
  const t = useTranslations("lists.details");
  const tManage = useTranslations("lists.manage.toast");
  const tLibrary = useTranslations("books.library");
  const tFormat = useTranslations("books.format.options");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tAgeCategory = useTranslations("books.classification.ageCategoryLabels");
  const genres = useGenres();
  const router = useRouter();

  const listQuery = useListDetailQuery();
  const facets = useListFacets(id);
  const overviewQuery = useListOverview(id);
  const relatedQuery = useListRelated(id);
  const overview = overviewQuery.data ?? null;
  const relatedLists = relatedQuery.data?.lists ?? [];
  const authorNameById = new Map((facets.data?.authors ?? []).map((item) => [item.id, item.name]));
  const facetGenreNameByKey = new Map(
    (facets.data?.genres ?? []).map((item) => [item.key, item.name]),
  );
  const chips = useListDetailChips({
    authorName: (authorId) => authorNameById.get(authorId) ?? authorId,
    genreName: (key) => facetGenreNameByKey.get(key) ?? key,
    setState: listQuery.setState,
    state: listQuery.state,
  });

  const addBooks = useAddBooksToList(id);
  const removeBook = useRemoveBookFromList(id);
  const moveBook = useMoveListBook(id);
  const moveBookToPosition = useMoveListBookToPosition(id);
  const setReadingStatus = useSetListBookReadingStatus(id);
  const toggleFavorite = useToggleListBookFavorite(id);
  const addToQueue = useAddToReadingQueue();
  const deleteList = useDeleteList(id);
  const duplicateList = useDuplicateList(id);

  const [addBooksOpen, setAddBooksOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveAnnouncement, setMoveAnnouncement] = useState("");

  const cache = useListCacheInvalidation(id);
  const enterSelection = useListSelectionStore((state) => state.enterSelection);
  const exitSelection = useListSelectionStore((state) => state.exitSelection);
  const selectedIds = useListSelectionStore((state) => state.selectedIds);
  const selectionMode = useListSelectionStore((state) => state.selectionMode);
  const toggleSelected = useListSelectionStore((state) => state.toggle);

  const books: ListBookView[] = pages.flatMap((page) => page.books.items);
  const loadedIdsKey = books.map((book) => book.id).join("\n");
  const queryKey = JSON.stringify(listQuery.params);

  useEffect(() => {
    const ids = loadedIdsKey === "" ? [] : loadedIdsKey.split("\n");
    useListSelectionStore.getState().setAvailable(ids);
  }, [loadedIdsKey]);

  useEffect(() => {
    useListSelectionStore.getState().clear();
  }, [queryKey]);

  useEffect(() => () => useListSelectionStore.getState().exitSelection(), []);

  const firstPage = pages[0];
  const bookCount = firstPage?.bookCount ?? 0;

  function announceMove(book: ListBookView, position: number) {
    setMoveAnnouncement(
      t("reorder.announced", { n: position, title: book.title, total: bookCount }),
    );
  }

  const buildDrag = useListBookDrag({
    onDropAt: ({ bookId, position }) => {
      const book = books.find((entry) => entry.id === bookId);
      if (book === undefined) return;
      moveBookToPosition.mutate(
        { bookId, position },
        {
          onError: () => toast.error(t("toast.error")),
          onSuccess: () => announceMove(book, position),
        },
      );
    },
  });

  if (firstPage === undefined) return null;

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  const labels: LibraryBookLabels = {
    ageBadge18Plus: tAgeCategory("18_plus"),
    borrowedFrom: (name) => tLibrary("card.borrowedFrom", { name }),
    formatLabel: (value) => tFormat(value),
    genreName: (key) => genreNameByKey.get(key) ?? key,
    lentTo: (name) => tLibrary("card.lentTo", { name }),
    ownershipLabel: (value) => tOwnership(value),
    pagesText: (value) => tLibrary("meta.pages", { value }),
    progressAriaLabel: (current, total) => tLibrary("progress.ariaLabel", { current, total }),
    progressUnit: tLibrary("progress.unit"),
    ratingLabel: (value) => tLibrary("rating.ariaLabel", { value }),
    seriesPosition: (position, total) => tLibrary("card.seriesPosition", { position, total }),
    statusLabel: (value) => tStatus(value),
  };

  const isListEmpty = bookCount === 0;
  const isListView = listQuery.state.view === "list";
  const showPosition = listQuery.state.sort === LIST_BOOK_SORT_DEFAULT;
  const canReorder = canReorderListDetail({ isFetching, state: listQuery.state });
  const pendingBookIds = new Set(
    [
      removeBook.isPending ? removeBook.variables : undefined,
      moveBookToPosition.isPending ? moveBookToPosition.variables.bookId : undefined,
      setReadingStatus.isPending ? setReadingStatus.variables.bookId : undefined,
      addToQueue.isPending ? addToQueue.variables.bookId : undefined,
    ].flatMap((bookId) => (bookId === undefined ? [] : [bookId])),
  );
  const editListCard: CustomListCard = {
    bookCount,
    createdAt: firstPage.createdAt,
    description: firstPage.description,
    id: firstPage.id,
    name: firstPage.name,
    previewCovers: firstPage.previewCovers,
    updatedAt: firstPage.updatedAt,
  };

  function handleRemove(book: ListBookView) {
    removeBook.mutate(book.id, {
      onError: () => toast.error(t("toast.error")),
      onSuccess: () => {
        toast(t("remove.toast"), {
          action: {
            label: t("remove.undo"),
            onClick: () =>
              addBooks.mutate(
                { bookIds: [book.id] },
                { onError: () => toast.error(t("toast.error")) },
              ),
          },
        });
      },
    });
  }

  function handleMove(book: ListBookView, direction: "down" | "up") {
    const nextPosition = direction === "up" ? book.position - 1 : book.position + 1;
    moveBook.mutate(
      { bookId: book.id, direction },
      {
        onError: () => toast.error(t("toast.error")),
        onSuccess: () => announceMove(book, nextPosition),
      },
    );
  }

  function handleAddToQueue(book: ListBookView) {
    addToQueue.mutate(
      { bookId: book.id, placement: "end" },
      {
        onError: () => toast.error(t("toast.error")),
        onSuccess: () => {
          toast.success(t("toast.addedToQueue"));
          cache.queueChanged();
        },
      },
    );
  }

  function handleStartReading(book: ListBookView) {
    setReadingStatus.mutate(
      { bookId: book.id, readingStatus: "reading" },
      {
        onError: () => toast.error(t("toast.error")),
        onSuccess: () => toast.success(t("toast.startedReading")),
      },
    );
  }

  function handleDelete() {
    deleteList.mutate(undefined, {
      onError: () => toast.error(tManage("error")),
      onSuccess: () => {
        toast.success(tManage("deleted"));
        router.push("/lists");
      },
    });
  }

  function handleDuplicate() {
    duplicateList.mutate(undefined, {
      onError: () => toast.error(tManage("error")),
      onSuccess: (created) => {
        toast.success(tManage("duplicated"));
        router.push(`/lists/${created.id}`);
      },
    });
  }

  function itemProps(book: ListBookView): ListBookItemProps {
    const reorder = listBookReorder({ bookCount, canReorder, position: book.position });
    return {
      book,
      drag: reorder.kind === "movable" ? buildDrag(book) : undefined,
      isPending: pendingBookIds.has(book.id),
      labels,
      onAddToQueue: () => handleAddToQueue(book),
      onMove: (direction) => handleMove(book, direction),
      onRemove: () => handleRemove(book),
      onStartReading: () => handleStartReading(book),
      onToggleFavorite: () =>
        toggleFavorite.mutate(
          { bookId: book.id, isFavorite: !book.isFavorite },
          { onError: () => toast.error(t("toast.error")) },
        ),
      reorder,
      selection: selectionMode
        ? { isSelected: selectedIds.has(book.id), onToggle: () => toggleSelected(book.id) }
        : undefined,
      showPosition,
    };
  }

  function renderBooks() {
    if (isListEmpty) return <EmptyList onAddBooks={() => setAddBooksOpen(true)} />;

    if (books.length === 0) {
      return (
        <NoResults
          conditions={chips.map((chip) => chip.label)}
          onClearFilters={listQuery.clearFilters}
          onClearSearch={listQuery.clearSearch}
          reason={listQuery.emptyReason}
          tab={listQuery.state.tab}
        />
      );
    }

    return (
      <>
        <h2 className="sr-only">{t("booksHeading")}</h2>

        <p aria-live="polite" className="sr-only" role="status">
          {moveAnnouncement}
        </p>

        <div
          className={cn(
            "grid gap-5",
            isListView
              ? "grid-cols-1"
              : "grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]",
          )}
        >
          {books.map((book) =>
            isListView ? (
              <ListBookRow key={book.id} {...itemProps(book)} />
            ) : (
              <ListBookCard key={book.id} {...itemProps(book)} />
            ),
          )}
        </div>

        {hasNextPage ? (
          <div className="flex justify-center">
            <Button
              disabled={isFetchingNextPage}
              loading={isFetchingNextPage}
              onClick={onLoadMore}
              variant="secondary"
            >
              {t("loadMore")}
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2 lg:gap-8">
      <ListDetailsHeader
        bookCount={bookCount}
        description={firstPage.description}
        isDuplicating={duplicateList.isPending}
        name={firstPage.name}
        onAddBooks={() => setAddBooksOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onDuplicate={handleDuplicate}
        onEdit={() => setEditOpen(true)}
        previewCovers={firstPage.previewCovers}
        updatedAt={firstPage.updatedAt}
      />

      {isListEmpty ? null : (
        <>
          <div className="lg:hidden">
            <ListCurrentlyReadingCard overview={overview} />
          </div>

          <ListStatsCards isPending={overviewQuery.isPending} overview={overview} />

          <ListDetailsToolbar
            chips={chips}
            counterLabel={t("toolbar.counter", {
              shown: books.length,
              total: firstPage.books.totalCount,
            })}
            id={id}
            isSelecting={selectionMode}
            onClearAll={listQuery.clearAll}
            onSearchChange={listQuery.setSearch}
            onSortChange={listQuery.setSort}
            onToggleSelecting={selectionMode ? exitSelection : enterSelection}
            onViewChange={listQuery.setView}
            quickFilters={
              <ListQuickTabs
                counts={firstPage.statusCounts}
                onSelect={listQuery.selectTab}
                value={listQuery.tab}
              />
            }
            setState={listQuery.setState}
            state={listQuery.state}
          />
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-8">
        <section className="flex min-w-0 flex-col gap-6 lg:gap-8">
          {renderBooks()}

          {selectionMode && books.length > 0 ? <ListBulkActions books={books} listId={id} /> : null}
        </section>

        <ListSidebar>
          <ListGoalCard bookCount={bookCount} listId={id} listName={firstPage.name} />
          <ListCurrentlyReadingCard overview={overview} />
          <ListAboutCard overview={overview} />
          <ListRelatedCard lists={relatedLists} />
        </ListSidebar>
      </div>

      <div className="flex flex-col gap-6 lg:hidden">
        <ListGoalCard bookCount={bookCount} listId={id} listName={firstPage.name} />
        <ListAboutCollapsible overview={overview} />
        <ListRelatedCollapsible lists={relatedLists} />
      </div>

      <AddBooksToListDialog listId={id} onOpenChange={setAddBooksOpen} open={addBooksOpen} />

      {editOpen ? (
        <EditListDialog
          list={editListCard}
          onOpenChange={(open) => {
            if (!open) setEditOpen(false);
          }}
          open
        />
      ) : null}

      <DeleteListDialog
        isDeleting={deleteList.isPending}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open && !deleteList.isPending) setDeleteOpen(false);
        }}
        open={deleteOpen}
      />
    </div>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled empty state: ${String(value)}`);
}

function EmptyList({ onAddBooks }: { onAddBooks: () => void }) {
  const t = useTranslations("lists.details");
  const tEmpty = useTranslations("lists.details.empty");

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name="list" size={24} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-ink">{t("empty.title")}</p>
        <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Button onClick={onAddBooks}>
          <UiIcon name="plus" size={16} />
          {tEmpty("addBooks")}
        </Button>
        <Button asChild variant="secondary">
          <Link href="/lists">
            <UiIcon name="arrow-left" size={16} />
            {tEmpty("back")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function EmptyResultsShell({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  icon: "funnel" | "list" | "search";
  title: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name={icon} size={24} />
      </span>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description}
      </div>
      {action}
    </div>
  );
}

function NoResults({ conditions, onClearFilters, onClearSearch, reason, tab }: NoResultsProps) {
  const t = useTranslations("lists.details.noResults");
  const tFiltered = useTranslations("lists.details.empty.filtered");
  const tTab = useTranslations("lists.details.empty.tab");

  switch (reason) {
    case "filters":
      return (
        <EmptyResultsShell
          action={
            <Button onClick={onClearFilters} variant="secondary">
              <UiIcon name="x" size={16} />
              {tFiltered("reset")}
            </Button>
          }
          description={
            <>
              <p className="text-sm text-muted-foreground">{tFiltered("description")}</p>
              {conditions.length === 0 ? null : (
                <p className="text-sm text-muted-foreground">
                  {tFiltered("conditions", { conditions: conditions.join(" · ") })}
                </p>
              )}
            </>
          }
          icon="funnel"
          title={tFiltered("title")}
        />
      );
    case "none":
      return (
        <EmptyResultsShell
          description={<p className="text-sm text-muted-foreground">{t("description")}</p>}
          icon="search"
          title={t("title")}
        />
      );
    case "search":
      return (
        <EmptyResultsShell
          action={
            <Button onClick={onClearSearch} variant="secondary">
              <UiIcon name="x" size={16} />
              {t("clear")}
            </Button>
          }
          description={<p className="text-sm text-muted-foreground">{t("description")}</p>}
          icon="search"
          title={t("title")}
        />
      );
    case "tab":
      return <EmptyResultsShell icon="list" title={tTab(tab)} />;
    default:
      return assertNever(reason);
  }
}
