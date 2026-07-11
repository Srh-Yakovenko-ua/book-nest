"use client";

import type { ListBookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { LibraryBookLabels } from "@/features/books/model/library-book";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { BookCard } from "@/components/ui/book-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookListMembershipDialog } from "@/features/books/components/book-list-membership-dialog";
import { toLibraryBook } from "@/features/books/model/library-book";
import { Link } from "@/i18n/navigation";

type ListBookCardProps = {
  book: ListBookView;
  bookCount: number;
  canReorder: boolean;
  labels: LibraryBookLabels;
  onAddToQueue: () => void;
  onMove: (direction: "down" | "up") => void;
  onRemove: () => void;
};

export function ListBookCard({
  book,
  bookCount,
  canReorder,
  labels,
  onAddToQueue,
  onMove,
  onRemove,
}: ListBookCardProps) {
  const t = useTranslations("lists.details.book");
  const [membershipOpen, setMembershipOpen] = useState(false);

  const libraryBook = toLibraryBook(book, labels);
  const moveUpDisabled = !canReorder || book.position <= 1;
  const moveDownDisabled = !canReorder || book.position >= bookCount;

  return (
    <>
      <BookCard
        ageBadge={libraryBook.ageBadge}
        authors={libraryBook.authors}
        cover={libraryBook.cover}
        formats={libraryBook.formats}
        genres={libraryBook.genres}
        href={libraryBook.href}
        kebab={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={t("actions", { title: book.title })}
                className="size-8 rounded-lg border-[1.5px] border-border bg-card text-muted-foreground transition-all duration-[180ms] ease-out hover:border-brand hover:bg-accent hover:text-brand dark:hover:bg-accent"
                size="icon-sm"
                variant="ghost"
              >
                <UiIcon name="more" size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href={libraryBook.href}>
                  <UiIcon name="eye" size={16} />
                  {t("view")}
                </Link>
              </DropdownMenuItem>

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

              <DropdownMenuItem disabled={moveUpDisabled} onSelect={() => onMove("up")}>
                <UiIcon name="arrow-up" size={16} />
                {t("moveUp")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={moveDownDisabled} onSelect={() => onMove("down")}>
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
        }
        linkComponent={Link}
        note={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{t("position", { n: book.position })}</Badge>
            {book.isInReadingQueue ? (
              <Badge variant="primary">
                <UiIcon name="bookmark" size={12} />
                {t("inQueue")}
              </Badge>
            ) : null}
          </div>
        }
        ownership={libraryBook.ownership}
        ownershipTooltip={libraryBook.loan?.text}
        progress={libraryBook.progress}
        publisher={libraryBook.publisher}
        rating={libraryBook.rating}
        ratingLabel={libraryBook.ratingLabel}
        series={libraryBook.series}
        status={libraryBook.status}
        tags={libraryBook.tags}
        title={libraryBook.title}
      />

      <BookListMembershipDialog
        bookId={book.id}
        onOpenChange={setMembershipOpen}
        open={membershipOpen}
      />
    </>
  );
}
