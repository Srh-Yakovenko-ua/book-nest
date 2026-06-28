"use client";

import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Rating } from "@/components/ui/rating";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

import type { LibraryBook, LibraryBookLinkComponent } from "../model/library-book";

type BookRowProps = {
  book: LibraryBook;
  kebab?: React.ReactNode;
  linkComponent?: LibraryBookLinkComponent;
  selected?: boolean;
  selectionControl?: React.ReactNode;
};

export function BookRow({ book, kebab, linkComponent, selected, selectionControl }: BookRowProps) {
  const LinkComp: "a" | LibraryBookLinkComponent = linkComponent ?? "a";

  return (
    <article
      className={cn(
        "group/book-row @container/book-row relative flex items-center gap-3.5 rounded-xl border border-border bg-card p-3 shadow-card transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none",
        selected && "ring-1 ring-primary",
      )}
      data-slot="book-row"
    >
      {selectionControl === undefined ? null : (
        <div className="relative z-10 shrink-0">{selectionControl}</div>
      )}

      <BookRowCover alt={book.cover?.alt ?? book.title} src={book.cover?.src} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="truncate font-heading text-sm leading-tight font-bold text-ink">
          <LinkComp
            className="text-ink no-underline transition-colors group-hover/book-row:text-primary after:absolute after:inset-0"
            href={book.href}
          >
            {book.title}
          </LinkComp>
        </h3>
        <p className="truncate text-xs text-muted-foreground">{book.author}</p>
      </div>

      <div className="hidden w-36 shrink-0 @md/book-row:block">
        <StatusBadge entry={book.status} />
      </div>

      <div className="hidden h-5 w-24 shrink-0 items-center @xl/book-row:flex">
        {book.rating === undefined ? null : (
          <Rating label={book.ratingLabel} size="sm" value={book.rating} />
        )}
      </div>

      <span className="hidden w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums @2xl/book-row:inline">
        {book.year ?? ""}
      </span>

      <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums @3xl/book-row:inline">
        {book.pagesText ?? ""}
      </span>

      {kebab === undefined ? null : <div className="relative z-10 shrink-0">{kebab}</div>}
    </article>
  );
}

function BookRowCover({ alt, src }: { alt: string; src?: string }) {
  if (src === undefined) {
    return (
      <div className="grid aspect-[3/4] w-11 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={18} />
      </div>
    );
  }

  return (
    <div className={cn("relative aspect-[3/4] w-11 shrink-0 overflow-hidden rounded-md bg-accent")}>
      <Image alt={alt} className="object-cover" fill sizes="44px" src={src} unoptimized />
    </div>
  );
}
