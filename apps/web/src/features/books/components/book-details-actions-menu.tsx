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

import { useDeleteBook } from "../api/use-book-actions";
import { useReadingQueuePosition } from "../api/use-reading-queue";
import { shouldShowReadingQueue } from "../model/reading-queue-visibility";
import { useRemoveFromQueueWithUndo } from "../model/use-remove-from-queue-with-undo";
import { AddToQueueDialog } from "./add-to-queue-dialog";
import { BookListMembershipDialog } from "./book-list-membership-dialog";
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

  const deleteBook = useDeleteBook();
  const position = useReadingQueuePosition(book);
  const removeFromQueue = useRemoveFromQueueWithUndo();
  const showQueueAction = shouldShowReadingQueue(book.readingStatus);

  const [statusOpen, setStatusOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addQueueOpen, setAddQueueOpen] = useState(false);

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

          {showQueueAction &&
            (book.isInReadingQueue ? (
              <DropdownMenuItem
                disabled={removeFromQueue.isPending}
                onSelect={() => removeFromQueue.remove(book.id, position)}
              >
                <UiIcon name="bookmark" size={16} />
                {t("removeFromQueue")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setAddQueueOpen(true)}>
                <UiIcon name="bookmark" size={16} />
                {t("addToQueue")}
              </DropdownMenuItem>
            ))}

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
      <AddToQueueDialog
        book={book}
        context="detail"
        onOpenChange={setAddQueueOpen}
        open={addQueueOpen}
      />
      <BookListMembershipDialog bookId={book.id} onOpenChange={setListOpen} open={listOpen} />
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
