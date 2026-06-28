"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { LibraryActions, PendingBookAction } from "../model/book-card-actions";

import { BookListDialog } from "./book-list-dialog";
import { BookOwnershipStatusDialog } from "./book-ownership-status-dialog";
import { BookReadingStatusDialog } from "./book-reading-status-dialog";
import { BookTagsDialog } from "./book-tags-dialog";
import { DeleteBookDialog } from "./delete-book-dialog";

type BookActionDialogsProps = {
  actions: LibraryActions;
  onClearSelection: () => void;
  onClose: () => void;
  pending: null | PendingBookAction;
};

export function BookActionDialogs({
  actions,
  onClearSelection,
  onClose,
  pending,
}: BookActionDialogsProps) {
  const t = useTranslations("books.library.bulk");
  const tConfirm = useTranslations("books.deleteConfirm");
  const [isDeleting, setIsDeleting] = useState(false);

  if (pending === null) return null;

  const action = pending;
  const bookCount = action.bookIds.length;

  async function runAction(run: () => Promise<void>) {
    await run();
    if (action.clearSelectionOnSuccess) onClearSelection();
  }

  if (action.type === "list") {
    return (
      <BookListDialog
        bookCount={bookCount}
        onConfirm={(input) =>
          runAction(() => actions.onAddToList({ bookIds: action.bookIds, ...input }))
        }
        onOpenChange={(open) => !open && onClose()}
        open
      />
    );
  }

  if (action.type === "readingStatus") {
    return (
      <BookReadingStatusDialog
        bookCount={bookCount}
        defaultValue={action.defaultReadingStatus}
        onConfirm={(readingStatus) =>
          runAction(() => actions.onChangeReadingStatus({ bookIds: action.bookIds, readingStatus }))
        }
        onOpenChange={(open) => !open && onClose()}
        open
      />
    );
  }

  if (action.type === "ownership") {
    return (
      <BookOwnershipStatusDialog
        bookCount={bookCount}
        defaultValue={action.defaultOwnershipStatus}
        onConfirm={(ownershipStatus) =>
          runAction(() => actions.onChangeOwnership({ bookIds: action.bookIds, ownershipStatus }))
        }
        onOpenChange={(open) => !open && onClose()}
        open
      />
    );
  }

  if (action.type === "tags") {
    return (
      <BookTagsDialog
        bookCount={bookCount}
        onConfirm={(tags) => runAction(() => actions.onAddTags({ bookIds: action.bookIds, tags }))}
        onOpenChange={(open) => !open && onClose()}
        open
      />
    );
  }

  const isSingle = bookCount === 1 && action.title !== undefined;
  const description = isSingle
    ? tConfirm("description", { title: action.title ?? "" })
    : t("deleteDescription", { count: bookCount });

  return (
    <DeleteBookDialog
      cancelLabel={tConfirm("cancel")}
      confirmLabel={tConfirm("confirm")}
      deletingLabel={tConfirm("deleting")}
      description={description}
      isDeleting={isDeleting}
      onConfirm={() => {
        setIsDeleting(true);
        void runAction(() => actions.onDelete(action.bookIds))
          .then(() => onClose())
          .catch(() => {})
          .finally(() => setIsDeleting(false));
      }}
      onOpenChange={(open) => {
        if (!open && !isDeleting) onClose();
      }}
      open
      title={isSingle ? tConfirm("title") : t("deleteTitle")}
    />
  );
}
