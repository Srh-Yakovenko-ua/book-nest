"use client";

import type { ListBookView } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingScore } from "@/components/ui/rating-score";
import { StatusBadge } from "@/components/ui/status-badge";
import { toLibraryBook } from "@/features/books/model/library-book";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { ListBookCta } from "../model/list-book-cta";
import type { ListBookItemProps } from "../model/list-book-item";

import { listBookCta } from "../model/list-book-cta";
import {
  ListBookDragHandle,
  ListBookFavoriteButton,
  ListBookSelectionCheckbox,
} from "./list-book-controls";
import { ListBookMenu } from "./list-book-menu";

const CTA_APPEARANCE = {
  continue: { icon: "book", target: "book" },
  resume: { icon: "book", target: "reading" },
  start: { icon: "book", target: "reading" },
  view: { icon: "eye", target: "book" },
} as const satisfies Record<ListBookCta, { icon: UiIconName; target: "book" | "reading" }>;

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
  const libraryBook = toLibraryBook(book, labels);
  const authors = libraryBook.authors.join(", ");
  const cover = book.cover ?? null;

  return (
    <article
      className={cn(
        "group/list-book relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-card transition-[box-shadow,border-color,opacity] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none",
        selection?.isSelected === true && "border-primary shadow-[0_0_0_1px_var(--primary)]",
        drag?.isDropTarget === true && "border-primary ring-3 ring-ring/50",
        drag?.isDragged === true && "opacity-50",
        isPending && "opacity-60",
      )}
      data-slot="list-book-card"
      {...drag?.containerProps}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-accent">
        {cover === null ? (
          <span className="grid size-full place-items-center text-accent-foreground/70">
            <UiIcon name="book" size={48} />
          </span>
        ) : (
          <Image
            alt={book.title}
            className="object-cover"
            fill
            sizes="(min-width:1280px) 19rem, (min-width:640px) 45vw, 90vw"
            src={cover.urls.card}
            unoptimized
          />
        )}

        <div className="pointer-events-none absolute inset-0 bg-[image:var(--book-cover-scrim)]" />

        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
          {selection === undefined ? null : (
            <ListBookSelectionCheckbox selection={selection} title={book.title} />
          )}
          <ListBookDragHandle drag={drag} onMove={onMove} reorder={reorder} title={book.title} />
        </div>

        <div className="absolute top-3 right-3 z-10">
          <ListBookFavoriteButton isFavorite={book.isFavorite} onToggle={onToggleFavorite} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <h3
          className="line-clamp-2 font-heading text-[1.0625rem] leading-tight font-bold text-ink"
          title={book.title}
        >
          <Link
            className="font-bold text-ink no-underline transition-colors group-hover/list-book:text-primary after:absolute after:inset-0"
            href={libraryBook.href}
          >
            {book.title}
          </Link>
        </h3>

        <p
          className="line-clamp-1 text-[0.8125rem] text-muted-foreground"
          title={authors === "" ? t("unknownAuthor") : authors}
        >
          {authors === "" ? t("unknownAuthor") : authors}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge entry={libraryBook.status} />
          {libraryBook.ownership === undefined ? null : (
            <StatusBadge entry={libraryBook.ownership} />
          )}
        </div>

        <ListBookMeta book={book} labels={labels} showPosition={showPosition} />

        <div className="relative z-10 mt-auto flex items-center gap-2 pt-2">
          <ListBookCtaButton
            book={book}
            href={libraryBook.href}
            isPending={isPending}
            onStartReading={onStartReading}
          />
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
      </div>
    </article>
  );
}

function ListBookCtaButton({
  book,
  href,
  isPending,
  onStartReading,
}: {
  book: ListBookView;
  href: string;
  isPending: boolean;
  onStartReading: () => void;
}) {
  const t = useTranslations("lists.details.book.cta");
  const cta = listBookCta(book.readingStatus);
  const appearance = CTA_APPEARANCE[cta];

  if (appearance.target === "book") {
    return (
      <Button asChild className="flex-1" size="sm" variant="secondary">
        <Link href={href}>
          <UiIcon name={appearance.icon} size={16} />
          {t(cta)}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      className="flex-1"
      disabled={isPending}
      loading={isPending}
      onClick={onStartReading}
      size="sm"
    >
      <UiIcon name={appearance.icon} size={16} />
      {t(cta)}
    </Button>
  );
}

function ListBookMeta({
  book,
  labels,
  showPosition,
}: {
  book: ListBookView;
  labels: ListBookItemProps["labels"];
  showPosition: boolean;
}) {
  const t = useTranslations("lists.details.book");
  const rating = book.readingProgress?.rating ?? null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
      {book.pagesCount === null ? null : (
        <span className="inline-flex items-center gap-1.5">
          <UiIcon aria-hidden className="shrink-0 text-icon" name="pages" size={14} />
          {labels.pagesText(book.pagesCount)}
        </span>
      )}

      {rating === null ? null : (
        <RatingScore className="text-xs" label={labels.ratingLabel(rating)} value={rating} />
      )}

      {showPosition ? (
        <Badge className="tabular-nums" variant="secondary">
          {t("position", { n: book.position })}
        </Badge>
      ) : null}

      {book.isInReadingQueue ? (
        <Badge variant="primary">
          <UiIcon name="bookmark" size={12} />
          {t("inQueue")}
        </Badge>
      ) : null}
    </div>
  );
}
