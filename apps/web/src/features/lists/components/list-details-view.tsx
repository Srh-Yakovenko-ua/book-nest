"use client";

import type { CustomListCard, CustomListDetail, ListBookSort, ListBookView } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { LibraryBookLabels } from "@/features/books/model/library-book";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useGenres } from "@/features/books/api/use-genres";
import { useAddToReadingQueue } from "@/features/books/api/use-reading-queue";
import { Link, useRouter } from "@/i18n/navigation";

import { listKeys } from "../api/list-keys";
import { useDeleteList } from "../api/use-delete-list";
import {
  useAddBooksToList,
  useMoveListBook,
  useRemoveBookFromList,
} from "../api/use-list-membership";
import { AddBooksToListDialog } from "./add-books-to-list-dialog";
import { DeleteListDialog } from "./delete-list-dialog";
import { EditListDialog } from "./edit-list-dialog";
import { ListBookCard } from "./list-book-card";
import { ListDetailsHeader } from "./list-details-header";
import { ListDetailsToolbar } from "./list-details-toolbar";

type ListDetailsViewProps = {
  hasNextPage: boolean;
  id: string;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  onClearSearch: () => void;
  onLoadMore: () => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: ListBookSort) => void;
  pages: CustomListDetail[];
  search: string;
  sort: ListBookSort;
};

export function ListDetailsView({
  hasNextPage,
  id,
  isFetching,
  isFetchingNextPage,
  onClearSearch,
  onLoadMore,
  onSearchChange,
  onSortChange,
  pages,
  search,
  sort,
}: ListDetailsViewProps) {
  const t = useTranslations("lists.details");
  const tManage = useTranslations("lists.manage.toast");
  const tLibrary = useTranslations("books.library");
  const tFormat = useTranslations("books.format.options");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const genres = useGenres();
  const router = useRouter();
  const queryClient = useQueryClient();

  const addBooks = useAddBooksToList(id);
  const removeBook = useRemoveBookFromList(id);
  const moveBook = useMoveListBook(id);
  const addToQueue = useAddToReadingQueue();
  const deleteList = useDeleteList(id);

  const [addBooksOpen, setAddBooksOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const firstPage = pages[0];
  if (firstPage === undefined) return null;

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  const labels: LibraryBookLabels = {
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

  const books: ListBookView[] = pages.flatMap((page) => page.books.items);
  const bookCount = firstPage.bookCount;
  const isListEmpty = bookCount === 0;
  const canReorder = sort === "position" && search.trim() === "" && !isFetching;
  const editListCard: CustomListCard = {
    bookCount,
    createdAt: firstPage.createdAt,
    description: firstPage.description,
    id: firstPage.id,
    name: firstPage.name,
    previewCovers: [],
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
    moveBook.mutate(
      { bookId: book.id, direction },
      { onError: () => toast.error(t("toast.error")) },
    );
  }

  function handleAddToQueue(book: ListBookView) {
    addToQueue.mutate(
      { bookId: book.id, placement: "end" },
      {
        onError: () => toast.error(t("toast.error")),
        onSuccess: () => {
          toast.success(t("toast.addedToQueue"));
          void queryClient.invalidateQueries({ queryKey: listKeys.detail(id) });
        },
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

  return (
    <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2 lg:gap-8">
      <ListDetailsHeader
        bookCount={bookCount}
        createdAt={firstPage.createdAt}
        description={firstPage.description}
        name={firstPage.name}
        onAddBooks={() => setAddBooksOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onEdit={() => setEditOpen(true)}
        updatedAt={firstPage.updatedAt}
      />

      {isListEmpty ? (
        <EmptyList onAddBooks={() => setAddBooksOpen(true)} />
      ) : (
        <section className="flex flex-col gap-6 lg:gap-8">
          <ListDetailsToolbar
            onSearchChange={onSearchChange}
            onSearchClear={onClearSearch}
            onSortChange={onSortChange}
            search={search}
            sort={sort}
          />

          {books.length === 0 ? (
            <NoResults onClearSearch={onClearSearch} />
          ) : (
            <>
              <h2 className="sr-only">{t("booksHeading")}</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fill,minmax(19rem,1fr))]">
                {books.map((book) => (
                  <ListBookCard
                    book={book}
                    bookCount={bookCount}
                    canReorder={canReorder}
                    key={book.id}
                    labels={labels}
                    onAddToQueue={() => handleAddToQueue(book)}
                    onMove={(direction) => handleMove(book, direction)}
                    onRemove={() => handleRemove(book)}
                  />
                ))}
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
          )}
        </section>
      )}

      <AddBooksToListDialog
        listBookIds={books.map((book) => book.id)}
        listId={id}
        onOpenChange={setAddBooksOpen}
        open={addBooksOpen}
      />

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

function NoResults({ onClearSearch }: { onClearSearch: () => void }) {
  const t = useTranslations("lists.details.noResults");

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name="search" size={24} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-ink">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <Button onClick={onClearSearch} variant="secondary">
        <UiIcon name="x" size={16} />
        {t("clear")}
      </Button>
    </div>
  );
}
