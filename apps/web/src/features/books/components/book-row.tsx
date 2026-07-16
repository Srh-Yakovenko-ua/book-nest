"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { GenreIcon, UiIcon } from "@/components/icons";
import { RatingScore } from "@/components/ui/rating-score";
import { StatusBadge, statusBadgeVariants } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { LibraryBook, LibraryBookLinkComponent } from "../model/library-book";

import { BookLoanNote } from "./book-loan-note";

type BookRowProps = {
  accent?: boolean;
  book: LibraryBook;
  kebab?: React.ReactNode;
  leading?: React.ReactNode;
  linkComponent?: LibraryBookLinkComponent;
  note?: React.ReactNode;
  selected?: boolean;
  selectionControl?: React.ReactNode;
};

type RowLinkComponent = "a" | LibraryBookLinkComponent;

const GENRES_VISIBLE = 2;
const TAGS_VISIBLE = 2;
const TOOLTIP_DELAY_MS = 400;

const morePillClass =
  "relative z-10 inline-flex shrink-0 items-center rounded-full border border-border/60 bg-secondary/40 px-1.5 py-0.5 text-xs font-medium text-muted-foreground";

export function BookRow({
  accent,
  book,
  kebab,
  leading,
  linkComponent,
  note,
  selected,
  selectionControl,
}: BookRowProps) {
  const LinkComp: RowLinkComponent = linkComponent ?? "a";
  const hasChips = (book.genres ?? []).length > 0 || (book.tags ?? []).length > 0;

  return (
    <article
      className={cn(
        "group/book-row @container/book-row relative flex min-h-[9.5rem] items-stretch gap-3.5 rounded-xl border border-border bg-card p-3 shadow-card transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none",
        accent && "border-accent-border",
        selected && "ring-1 ring-primary",
      )}
      data-slot="book-row"
    >
      {selectionControl === undefined ? null : (
        <div className="relative z-10 shrink-0">{selectionControl}</div>
      )}

      {leading === undefined ? null : <div className="relative z-10 shrink-0">{leading}</div>}

      <BookRowCover alt={book.cover?.alt ?? book.title} src={book.cover?.src} />

      <div className="flex min-w-0 flex-1 flex-col gap-3 @xl/book-row:flex-row @xl/book-row:flex-wrap @xl/book-row:items-start @xl/book-row:gap-x-4 @xl/book-row:gap-y-3 @3xl/book-row:flex-nowrap @3xl/book-row:items-stretch">
        <BookRowMeta book={book} LinkComp={LinkComp} note={note} />

        <div className="hidden w-px self-stretch bg-border @3xl/book-row:block" />

        <BookRowStatuses book={book} />

        {hasChips ? (
          <>
            <div className="hidden w-px self-stretch bg-border @3xl/book-row:block" />
            <BookRowChips genres={book.genres} tags={book.tags} />
          </>
        ) : null}
      </div>

      <BookRowRail
        inReadingQueue={book.isInReadingQueue}
        kebab={kebab}
        rating={book.rating}
        ratingLabel={book.ratingLabel}
      />
    </article>
  );
}

function BookRowChips({ genres, tags }: { genres?: LibraryBook["genres"]; tags?: string[] }) {
  const visibleGenres = (genres ?? []).slice(0, GENRES_VISIBLE);
  const visibleTags = (tags ?? []).slice(0, TAGS_VISIBLE);
  const hiddenTags = (tags ?? []).slice(TAGS_VISIBLE);

  if (visibleGenres.length === 0 && visibleTags.length === 0) return null;

  return (
    <div className="flex flex-wrap content-start items-center gap-1.5 @xl/book-row:basis-full @3xl/book-row:min-w-0 @3xl/book-row:flex-1 @3xl/book-row:basis-0">
      {visibleGenres.map((genre) => (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-tag px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-tag-foreground"
          key={genre.label}
        >
          {genre.icon === undefined ? null : (
            <GenreIcon className="shrink-0 text-brand/90" name={genre.icon} size={14} />
          )}
          {genre.label}
        </span>
      ))}

      {visibleTags.map((tag) => (
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground/80"
          key={tag}
        >
          <UiIcon className="shrink-0 text-muted-foreground" name="hash" size={12} />
          {tag}
        </span>
      ))}

      <MorePill items={hiddenTags} />
    </div>
  );
}

function BookRowCover({ alt, src }: { alt: string; src?: string }) {
  if (src === undefined) {
    return (
      <div className="grid w-24 shrink-0 place-items-center self-stretch rounded-lg bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={32} />
      </div>
    );
  }

  return (
    <div className="relative w-24 shrink-0 self-stretch overflow-hidden rounded-lg bg-accent">
      <Image alt={alt} className="object-cover" fill sizes="96px" src={src} unoptimized />
    </div>
  );
}

function BookRowMeta({
  book,
  LinkComp,
  note,
}: {
  book: LibraryBook;
  LinkComp: RowLinkComponent;
  note?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 @xl/book-row:min-w-[14rem] @xl/book-row:flex-1">
      <h3 className="line-clamp-2 font-heading text-sm leading-tight font-bold text-ink">
        <LinkComp
          className="text-ink no-underline transition-colors group-hover/book-row:text-primary after:absolute after:inset-0"
          href={book.href}
        >
          {book.title}
        </LinkComp>
      </h3>

      {book.originalTitle === undefined ? null : (
        <p className="truncate text-xs text-muted-foreground italic">{book.originalTitle}</p>
      )}

      {book.authors.length === 0 ? null : (
        <p className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</p>
      )}

      {note}

      {book.series === undefined ? null : (
        <LinkComp
          className="relative z-10 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground no-underline transition-colors hover:text-primary"
          href={book.series.href}
        >
          <UiIcon className="shrink-0 text-icon" name="layers" size={15} />
          <span className="min-w-0 truncate">
            {book.series.name}
            {book.series.positionLabel === undefined ? null : (
              <span className="text-muted-foreground"> · {book.series.positionLabel}</span>
            )}
          </span>
        </LinkComp>
      )}

      {book.publisher === undefined ? null : (
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <UiIcon className="shrink-0 text-icon" name="building" size={15} />
          <span className="min-w-0 truncate">{book.publisher}</span>
        </p>
      )}

      {(book.formats ?? []).length === 0 ? null : (
        <div className="flex min-w-0 items-center gap-x-3 overflow-hidden text-xs text-muted-foreground">
          {(book.formats ?? []).map((format) => (
            <span className="inline-flex shrink-0 items-center gap-1.5" key={format.value}>
              <UiIcon className="shrink-0 text-icon" name={format.icon} size={15} />
              {format.label}
            </span>
          ))}
        </div>
      )}

      {book.ageBadge === undefined ? null : (
        <span className={cn(statusBadgeVariants({ tone: "danger" }), "mt-auto self-end")}>
          {book.ageBadge}
        </span>
      )}
    </div>
  );
}

function BookRowRail({
  inReadingQueue,
  kebab,
  rating,
  ratingLabel,
}: {
  inReadingQueue?: boolean;
  kebab?: React.ReactNode;
  rating?: number;
  ratingLabel?: string;
}) {
  const t = useTranslations("books.library");

  return (
    <div className="flex shrink-0 flex-col items-end gap-2 self-stretch">
      {kebab === undefined ? null : <div className="relative z-10 shrink-0">{kebab}</div>}

      <div className="mt-auto flex flex-col items-end gap-2">
        {inReadingQueue === true ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <UiIcon className="shrink-0" name="bookmark" size={14} />
            {t("card.inQueue")}
          </span>
        ) : null}

        {rating === undefined ? null : <RatingScore label={ratingLabel} value={rating} />}
      </div>
    </div>
  );
}

function BookRowStatuses({ book }: { book: LibraryBook }) {
  return (
    <div className="flex shrink-0 flex-col gap-1 @xl/book-row:w-40">
      <StatusBadge entry={book.status} />
      {book.ownership === undefined ? null : <StatusBadge entry={book.ownership} />}
      {book.loan === undefined ? null : (
        <BookLoanNote className="text-xs" icon={book.loan.icon} text={book.loan.text} />
      )}
    </div>
  );
}

function MorePill({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  const label = items.join(", ");

  return (
    <Tooltip delayDuration={TOOLTIP_DELAY_MS}>
      <TooltipTrigger
        aria-label={label}
        className={cn(
          morePillClass,
          "cursor-default focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
      >
        +{items.length}
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
