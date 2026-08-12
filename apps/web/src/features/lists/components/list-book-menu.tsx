"use client";

import type { ListBookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookListMembershipDialog } from "@/features/books/components/book-list-membership-dialog";
import { Link } from "@/i18n/navigation";

import type { ListBookReorder } from "../model/list-reorder";

import { listBookReadingAction } from "../model/list-book-reading-action";

type ListBookMenuProps = {
  book: ListBookView;
  disabled: boolean;
  onAddToQueue: () => void;
  onMove: (direction: "down" | "up") => void;
  onRemove: () => void;
  onStartReading: () => void;
  reorder: ListBookReorder;
};

export function ListBookMenu({
  book,
  disabled,
  onAddToQueue,
  onMove,
  onRemove,
  onStartReading,
  reorder,
}: ListBookMenuProps) {
  const t = useTranslations("lists.details.book");
  const tCta = useTranslations("lists.details.book.cta");
  const [membershipOpen, setMembershipOpen] = useState(false);

  const readingAction = listBookReadingAction(book.readingStatus);
  const isLocked = reorder.kind === "locked";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("actions", { title: book.title })}
            className="size-8 rounded-lg border-[1.5px] border-border bg-card text-muted-foreground transition-all duration-[180ms] ease-out hover:border-brand hover:bg-accent hover:text-brand dark:hover:bg-accent"
            disabled={disabled}
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon name="more" size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {readingAction === null ? null : (
            <DropdownMenuItem onSelect={onStartReading}>
              <UiIcon name="book" size={16} />
              {tCta(readingAction)}
            </DropdownMenuItem>
          )}

          {book.isInReadingQueue ? (
            <DropdownMenuItem asChild>
              <Link href="/reading-queue">
                <UiIcon name="bookmark" size={16} />
                {t("goToQueue")}
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={onAddToQueue}>
              <UiIcon name="bookmark" size={16} />
              {t("addToQueue")}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onSelect={() => setMembershipOpen(true)}>
            <UiIcon name="list" size={16} />
            {t("addToOtherList")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled={isLocked || !reorder.canMoveUp} onSelect={() => onMove("up")}>
            <UiIcon name="arrow-up" size={16} />
            {t("moveUp")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isLocked || !reorder.canMoveDown}
            onSelect={() => onMove("down")}
          >
            <UiIcon name="arrow-down" size={16} />
            {t("moveDown")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={onRemove} variant="destructive">
            <UiIcon name="x-circle" size={16} />
            {t("remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BookListMembershipDialog
        bookId={book.id}
        onOpenChange={setMembershipOpen}
        open={membershipOpen}
      />
    </>
  );
}
