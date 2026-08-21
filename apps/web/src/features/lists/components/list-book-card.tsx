"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { BookCard } from "@/components/ui/book-card";
import { StatusBadge, statusBadgeVariants } from "@/components/ui/status-badge";
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

const POSITION_PILL =
  "inline-flex h-7 items-center gap-1.5 rounded-full border border-[color:var(--book-overlay-badge-border)] bg-[color-mix(in_srgb,var(--book-overlay-badge-surface)_78%,transparent)] px-2.5 text-xs font-medium text-[color:var(--book-overlay-badge-foreground)] tabular-nums shadow-sm backdrop-blur-[6px]";

export function ListBookCard({
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
  const tReorder = useTranslations("lists.details.reorder");
  const libraryBook = toLibraryBook(book, labels);
  const authors = libraryBook.authors.length === 0 ? [t("unknownAuthor")] : libraryBook.authors;

  return (
    <div className="group/list-book relative grid">
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 empty:hidden">
        {selection === undefined ? null : (
          <ListBookSelectionCheckbox selection={selection} title={book.title} />
        )}
        {reorder.kind === "movable" ? (
          <ListBookDragHandle
            className={POSITION_PILL}
            drag={drag}
            label={
              showPosition
                ? tReorder("handlePosition", { n: book.position, title: book.title })
                : undefined
            }
            onMove={onMove}
            reorder={reorder}
            title={book.title}
          >
            {showPosition ? t("position", { n: book.position }) : null}
          </ListBookDragHandle>
        ) : showPosition ? (
          <span aria-label={t("positionLabel", { n: book.position })} className={POSITION_PILL}>
            {t("position", { n: book.position })}
          </span>
        ) : null}
      </div>

      <BookCard
        authors={authors}
        className={cn(
          drag?.isDropTarget === true && "border-primary ring-3 ring-ring/50",
          drag?.isDragged === true && "opacity-50",
          isPending && "opacity-60",
        )}
        cover={libraryBook.cover}
        data-slot="list-book-card"
        formats={libraryBook.formats}
        genres={libraryBook.genres}
        href={libraryBook.href}
        kebab={
          <div className="flex items-center gap-0.5">
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
        }
        linkComponent={Link}
        mobileCompact
        note={
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge entry={libraryBook.status} />
            {libraryBook.ageBadge === undefined ? null : (
              <span className={statusBadgeVariants({ tone: "danger" })}>
                {libraryBook.ageBadge}
              </span>
            )}
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
        publisher={libraryBook.publisher}
        rating={libraryBook.rating}
        ratingLabel={libraryBook.ratingLabel}
        selected={selection?.isSelected}
        series={libraryBook.series}
        tags={libraryBook.tags}
        title={book.title}
        {...drag?.containerProps}
      />
    </div>
  );
}
