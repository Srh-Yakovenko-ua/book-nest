"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { LibraryActions, PendingBookAction } from "../model/book-card-actions";
import type { LibraryBook } from "../model/library-book";

import { canMarkFinished, canStartReading } from "../model/book-card-actions";

type BookCardActionsProps = {
  actions: LibraryActions;
  book: LibraryBook;
  onOpenDialog: (action: PendingBookAction) => void;
};

export function BookCardActions({ actions, book, onOpenDialog }: BookCardActionsProps) {
  const t = useTranslations("books.library");

  const favoriteLabel = book.isFavorite ? t("actions.unfavorite") : t("actions.favorite");

  return (
    <div className="flex items-center gap-0.5">
      <Button
        aria-label={favoriteLabel}
        aria-pressed={book.isFavorite}
        className={cn(
          "rounded-lg border-[1.5px] transition-all duration-[180ms] ease-out",
          book.isFavorite
            ? "border-brand bg-brand text-white shadow-btn hover:border-primary-hover hover:bg-primary-hover hover:text-white dark:hover:bg-primary-hover [&_svg]:animate-[heart-pop_320ms_ease]"
            : "border-border bg-card text-muted-foreground hover:border-brand hover:bg-accent hover:text-brand dark:hover:bg-accent",
        )}
        onClick={() => actions.onToggleFavorite({ id: book.id, isFavorite: !book.isFavorite })}
        size="icon-sm"
        title={favoriteLabel}
        variant="ghost"
      >
        <UiIcon name={book.isFavorite ? "heart-fill" : "heart"} size={18} />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("menu")}
            className="rounded-lg border-[1.5px] border-border bg-card text-muted-foreground transition-all duration-[180ms] ease-out hover:border-brand hover:bg-accent hover:text-brand dark:hover:bg-accent"
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon name="more" size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => actions.onEdit(book.id)}>
            <UiIcon name="edit" size={16} />
            {t("actions.edit")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {canStartReading(book.readingStatus) ? (
            <DropdownMenuItem
              onSelect={() =>
                void actions.onChangeReadingStatus({
                  bookIds: [book.id],
                  readingStatus: "reading",
                })
              }
            >
              <UiIcon name="book" size={16} />
              {t("actions.startReading")}
            </DropdownMenuItem>
          ) : null}

          {canMarkFinished(book.readingStatus) ? (
            <DropdownMenuItem
              onSelect={() =>
                void actions.onChangeReadingStatus({
                  bookIds: [book.id],
                  readingStatus: "finished",
                })
              }
            >
              <UiIcon name="check-circle" size={16} />
              {t("actions.markFinished")}
            </DropdownMenuItem>
          ) : null}

          {book.isInReadingQueue ? (
            <DropdownMenuItem onSelect={() => void actions.onRemoveFromQueue(book.id)}>
              <UiIcon name="bookmark" size={16} />
              {t("actions.removeFromQueue")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void actions.onAddToQueue([book.id])}>
              <UiIcon name="bookmark" size={16} />
              {t("actions.addToQueue")}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onSelect={() =>
              onOpenDialog({ bookIds: [book.id], clearSelectionOnSuccess: false, type: "list" })
            }
          >
            <UiIcon name="list" size={16} />
            {t("actions.addToList")}
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() =>
              onOpenDialog({
                bookIds: [book.id],
                clearSelectionOnSuccess: false,
                defaultReadingStatus: book.readingStatus,
                type: "readingStatus",
              })
            }
          >
            <UiIcon name="swap" size={16} />
            {t("actions.changeReadingStatus")}
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() =>
              onOpenDialog({
                bookIds: [book.id],
                clearSelectionOnSuccess: false,
                defaultOwnershipStatus: book.ownershipStatus,
                type: "ownership",
              })
            }
          >
            <UiIcon name="package" size={16} />
            {t("actions.changeOwnership")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={() =>
              onOpenDialog({
                bookIds: [book.id],
                clearSelectionOnSuccess: false,
                title: book.title,
                type: "delete",
              })
            }
            variant="destructive"
          >
            <UiIcon name="trash" size={16} />
            {t("actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
