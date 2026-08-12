"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { toLibraryBook } from "@/features/books/model/library-book";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { ListBookItemProps } from "../model/list-book-item";

import {
  ListBookDragHandle,
  ListBookFavoriteButton,
  ListBookSelectionCheckbox,
} from "./list-book-controls";
import { ListBookMenu } from "./list-book-menu";

export function ListBookRow({
  book,
  drag,
  isPending,
  labels,
  onAddToQueue,
  onMove,
  onRemove,
  onStartReading,
  onToggleFavorite,
  reorder,
  selection,
  showPosition,
}: ListBookItemProps) {
  const t = useTranslations("lists.details.book");
  const libraryBook = toLibraryBook(book, labels);
  const authors = libraryBook.authors.join(", ");
  const authorsText = authors === "" ? t("unknownAuthor") : authors;
  const cover = book.cover ?? null;

  return (
    <article
      className={cn(
        "group/list-row relative flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition-[box-shadow,border-color,opacity] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none",
        selection?.isSelected === true && "border-primary shadow-[0_0_0_1px_var(--primary)]",
        drag?.isDropTarget === true && "border-primary ring-3 ring-ring/50",
        drag?.isDragged === true && "opacity-50",
        isPending && "opacity-60",
      )}
      data-slot="list-book-row"
      {...drag?.containerProps}
    >
      {selection === undefined ? null : (
        <div className="relative z-10 shrink-0">
          <ListBookSelectionCheckbox selection={selection} title={book.title} />
        </div>
      )}

      <div className="relative z-10 shrink-0 empty:hidden">
        <ListBookDragHandle drag={drag} onMove={onMove} reorder={reorder} title={book.title} />
      </div>

      {cover === null ? (
        <span className="grid h-15 w-10 shrink-0 place-items-center rounded-sm bg-accent text-accent-foreground/70">
          <UiIcon name="book" size={18} />
        </span>
      ) : (
        <span className="relative h-15 w-10 shrink-0 overflow-hidden rounded-sm bg-accent">
          <Image
            alt={book.title}
            className="object-cover"
            fill
            sizes="40px"
            src={cover.urls.thumb}
            unoptimized
          />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <TooltipHint label={book.title}>
          <h3 className="line-clamp-1 text-sm leading-tight font-semibold text-ink">
            <Link
              className="text-ink no-underline transition-colors group-hover/list-row:text-primary after:absolute after:inset-0"
              href={libraryBook.href}
            >
              {book.title}
            </Link>
          </h3>
        </TooltipHint>
        <TooltipHint label={authorsText}>
          <p className="line-clamp-1 text-xs text-muted-foreground">{authorsText}</p>
        </TooltipHint>
        {showPosition ? (
          <Badge
            aria-label={t("positionLabel", { n: book.position })}
            className="mt-0.5 w-fit tabular-nums"
            variant="secondary"
          >
            {t("position", { n: book.position })}
          </Badge>
        ) : null}
      </div>

      <StatusBadge className="max-sm:hidden" entry={libraryBook.status} />

      {libraryBook.ownership === undefined ? null : (
        <StatusBadge className="max-lg:hidden" entry={libraryBook.ownership} />
      )}

      {book.pagesCount === null ? null : (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground max-xl:hidden">
          <UiIcon aria-hidden className="shrink-0 text-icon" name="pages" size={14} />
          {labels.pagesText(book.pagesCount)}
        </span>
      )}

      <div className="relative z-10 flex shrink-0 items-center gap-1.5">
        <ListBookFavoriteButton isFavorite={book.isFavorite} onToggle={onToggleFavorite} />
        <ListBookMenu
          book={book}
          disabled={isPending}
          onAddToQueue={onAddToQueue}
          onMove={onMove}
          onRemove={onRemove}
          onStartReading={onStartReading}
          reorder={reorder}
        />
      </div>
    </article>
  );
}
