"use client";

import type { ListBookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { BookListDialog } from "@/features/books/components/book-list-dialog";

import {
  useBulkAddListBooksToLists,
  useBulkAddListBooksToQueue,
  useBulkRemoveBooksFromList,
  useBulkSetListBooksFavorite,
} from "../api/use-list-bulk";
import { useAddBooksToList } from "../api/use-list-membership";
import { useListSelectionStore } from "../model/list-selection-store";
import { ListBulkBar } from "./list-bulk-bar";

type ListBulkActionsProps = {
  books: ListBookView[];
  listId: string;
};

export function ListBulkActions({ books, listId }: ListBulkActionsProps) {
  const t = useTranslations("lists.details.toast");
  const tRemove = useTranslations("lists.details.remove");
  const tSelection = useTranslations("lists.details.selection");
  const clearSelection = useListSelectionStore((state) => state.clear);
  const exitSelection = useListSelectionStore((state) => state.exitSelection);
  const selectAll = useListSelectionStore((state) => state.selectAll);
  const selectedIds = useListSelectionStore((state) => state.selectedIds);
  const [listDialogOpen, setListDialogOpen] = useState(false);

  const addBooks = useAddBooksToList(listId);
  const addToLists = useBulkAddListBooksToLists(listId);
  const addToQueue = useBulkAddListBooksToQueue(listId);
  const removeBooks = useBulkRemoveBooksFromList(listId);
  const setFavorite = useBulkSetListBooksFavorite(listId);

  const loadedIds = books.map((book) => book.id);
  const selectedBookIds = loadedIds.filter((id) => selectedIds.has(id));
  const isPending =
    addToLists.isPending || addToQueue.isPending || removeBooks.isPending || setFavorite.isPending;

  if (selectedBookIds.length === 0) return null;

  function reportError() {
    toast.error(t("error"));
  }

  function handleAddToQueue() {
    addToQueue.mutate(selectedBookIds, {
      onError: reportError,
      onSuccess: (result) => {
        toast.success(tSelection("addedToQueue", { count: result.affected }));
        exitSelection();
      },
    });
  }

  function handleFavorite(isFavorite: boolean) {
    setFavorite.mutate(
      { bookIds: selectedBookIds, isFavorite },
      {
        onError: reportError,
        onSuccess: (result) => {
          toast.success(
            isFavorite
              ? tSelection("favoriteDone", { count: result.affected })
              : tSelection("unfavoriteDone", { count: result.affected }),
          );
          exitSelection();
        },
      },
    );
  }

  function handleRemove() {
    const removedIds = [...selectedBookIds];
    removeBooks.mutate(removedIds, {
      onError: reportError,
      onSuccess: (result) => {
        toast(tSelection("removed", { count: result.removed }), {
          action: {
            label: tRemove("undo"),
            onClick: () => addBooks.mutate({ bookIds: removedIds }, { onError: reportError }),
          },
        });
        exitSelection();
      },
    });
  }

  return (
    <>
      <ListBulkBar
        isPending={isPending}
        loadedCount={loadedIds.length}
        onAddFavorite={() => handleFavorite(true)}
        onAddToList={() => setListDialogOpen(true)}
        onAddToQueue={handleAddToQueue}
        onClear={clearSelection}
        onRemoveFavorite={() => handleFavorite(false)}
        onRemoveFromList={handleRemove}
        onSelectAll={() => selectAll(loadedIds)}
        selectedCount={selectedBookIds.length}
      />

      <BookListDialog
        bookCount={selectedBookIds.length}
        onConfirm={async ({ listIds, newLists }) => {
          await addToLists.mutateAsync({ bookIds: selectedBookIds, listIds, newLists });
          toast.success(tSelection("addedToList", { count: selectedBookIds.length }));
          exitSelection();
        }}
        onOpenChange={setListDialogOpen}
        open={listDialogOpen}
      />
    </>
  );
}
