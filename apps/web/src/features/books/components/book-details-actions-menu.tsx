"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";

import type { ListDraft } from "../model/book-organization-fields";

import {
  useBulkAddToList,
  useBulkAddToReadingQueue,
  useDeleteBook,
  useRemoveFromReadingQueue,
} from "../api/use-book-actions";
import { BookListDialog } from "./book-list-dialog";
import { ChangeReadingStatusDialog } from "./change-reading-status-dialog";
import { DeleteBookDialog } from "./delete-book-dialog";

type BookDetailsActionsMenuProps = {
  book: BookView;
};

export function BookDetailsActionsMenu({ book }: BookDetailsActionsMenuProps) {
  const t = useTranslations("books.details.actions");
  const tDetails = useTranslations("books.details");
  const tConfirm = useTranslations("books.deleteConfirm");
  const router = useRouter();

  const addToQueue = useBulkAddToReadingQueue();
  const removeFromQueue = useRemoveFromReadingQueue();
  const addToList = useBulkAddToList();
  const deleteBook = useDeleteBook();

  const [statusOpen, setStatusOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function onAddToQueue() {
    addToQueue.mutate([book.id], {
      onError: () => toast.error(t("toast.error")),
      onSuccess: () => toast.success(t("toast.queueAdded")),
    });
  }

  function onRemoveFromQueue() {
    removeFromQueue.mutate(book.id, {
      onError: () => toast.error(t("toast.error")),
      onSuccess: () => toast.success(t("toast.queueRemoved")),
    });
  }

  async function onConfirmList(input: { listIds: string[]; newLists: ListDraft[] }) {
    try {
      await addToList.mutateAsync({
        bookIds: [book.id],
        listIds: input.listIds,
        newLists: input.newLists,
      });
      toast.success(t("toast.addedToList"));
    } catch (error) {
      toast.error(t("toast.error"));
      throw error;
    }
  }

  function onConfirmDelete() {
    deleteBook.mutate(book.id, {
      onError: () => toast.error(t("toast.error")),
      onSuccess: () => {
        toast.success(t("toast.deleted"));
        setDeleteOpen(false);
        router.push("/books");
      },
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label={t("menu")} size="icon" variant="outline">
            <UiIcon name="more" size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/books/${book.id}/edit`}>
              <UiIcon name="edit" size={16} />
              {tDetails("edit")}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setStatusOpen(true)}>
            <UiIcon name="swap" size={16} />
            {t("changeReadingStatus")}
          </DropdownMenuItem>

          {book.isInReadingQueue ? (
            <DropdownMenuItem onSelect={onRemoveFromQueue}>
              <UiIcon name="bookmark" size={16} />
              {t("removeFromQueue")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={onAddToQueue}>
              <UiIcon name="bookmark" size={16} />
              {t("addToQueue")}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onSelect={() => setListOpen(true)}>
            <UiIcon name="list" size={16} />
            {t("addToList")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setDeleteOpen(true)} variant="destructive">
            <UiIcon name="trash" size={16} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangeReadingStatusDialog book={book} onOpenChange={setStatusOpen} open={statusOpen} />
      <BookListDialog
        bookCount={1}
        onConfirm={onConfirmList}
        onOpenChange={setListOpen}
        open={listOpen}
      />
      <DeleteBookDialog
        cancelLabel={tConfirm("cancel")}
        confirmLabel={tConfirm("confirm")}
        deletingLabel={tConfirm("deleting")}
        description={tConfirm("description", { title: book.title })}
        isDeleting={deleteBook.isPending}
        onConfirm={onConfirmDelete}
        onOpenChange={(open) => {
          if (!open && !deleteBook.isPending) setDeleteOpen(false);
        }}
        open={deleteOpen}
        title={tConfirm("title")}
      />
    </>
  );
}
