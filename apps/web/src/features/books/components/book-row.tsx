"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { GenreIcon, UiIcon } from "@/components/icons";
import { RatingScore } from "@/components/ui/rating-score";
import { StatusBadge, statusBadgeVariants } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { BookRowBook, LibraryBook, LibraryBookLinkComponent } from "../model/library-book";

import { BookLoanNote } from "./book-loan-note";

type BookRowCoverAspect = "portrait" | "stretch";

type BookRowProps = {
  accent?: boolean;
  actionsSlot?: React.ReactNode;
  book: BookRowBook;
  coverAspect?: BookRowCoverAspect;
  detailsSlot?: React.ReactNode;
  kebab?: React.ReactNode;
  leading?: React.ReactNode;
  linkComponent?: LibraryBookLinkComponent;
  mobileCompact?: boolean;
  note?: React.ReactNode;
  rowLink?: boolean;
  selected?: boolean;
  selectionControl?: React.ReactNode;
  statusPlacement?: "column" | "note";
  statusSlot?: React.ReactNode;
  tone?: BookRowTone;
};

type BookRowTone = "next" | "read";

type RowLinkComponent = "a" | LibraryBookLinkComponent;

const GENRES_VISIBLE = 2;
const TAGS_VISIBLE = 2;
const TOOLTIP_DELAY_MS = 400;

const MOBILE_COMPACT = {
  ageBadge: "max-sm:hidden",
  chips: "max-sm:hidden",
  cover: "max-sm:aspect-[2/3] max-sm:w-16 max-sm:self-start",
  formats: "max-sm:hidden",
  meta: "max-sm:text-[0.625rem]",
  metaIcon: "max-sm:size-3",
  rail: "max-sm:hidden",
  rating: "text-[0.625rem] [&_svg]:size-3",
  statusBadge:
    "max-sm:h-5 max-sm:gap-0.5 max-sm:px-1.5 max-sm:text-[0.625rem] max-sm:[&>svg]:size-3",
  statusGroup: "max-sm:flex-row max-sm:flex-wrap max-sm:items-center max-sm:gap-1",
  statusNote: "max-sm:basis-full",
} as const;

const morePillClass =
  "relative z-10 inline-flex shrink-0 items-center rounded-full border border-border/60 bg-secondary/40 px-1.5 py-0.5 text-xs font-medium text-muted-foreground";

const toneClass: Record<BookRowTone, string> = {
  next: "border-primary bg-primary/5 hover:border-primary",
  read: "border-success/40 bg-success-soft/40 hover:border-success/60",
};

export function BookRow({
  accent,
  actionsSlot,
  book,
  coverAspect = "stretch",
  detailsSlot,
  kebab,
  leading,
  linkComponent,
  mobileCompact,
  note,
  rowLink = true,
  selected,
  selectionControl,
  statusPlacement = "column",
  statusSlot,
  tone,
}: BookRowProps) {
  const LinkComp: RowLinkComponent = linkComponent ?? "a";
  const hasChips = (book.genres ?? []).length > 0 || (book.tags ?? []).length > 0;
  const compact = mobileCompact === true ? MOBILE_COMPACT : null;

  return (
    <article
      className={cn(
        "group/book-row @container/book-row relative flex min-h-[9.5rem] items-stretch gap-3.5 rounded-xl border border-border bg-card p-3 shadow-card transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none",
        accent && "border-accent-border",
        tone === undefined ? undefined : toneClass[tone],
        selected && "ring-1 ring-primary",
      )}
      data-slot="book-row"
    >
      {selectionControl === undefined ? null : (
        <div className="relative z-10 shrink-0">{selectionControl}</div>
      )}

      {leading === undefined ? null : <div className="relative z-10 shrink-0">{leading}</div>}

      <BookRowCover
        alt={book.cover?.alt ?? book.title}
        aspect={coverAspect}
        className={compact?.cover}
        src={book.cover?.src}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3 @xl/book-row:flex-row @xl/book-row:flex-wrap @xl/book-row:items-start @xl/book-row:gap-x-4 @xl/book-row:gap-y-3 @3xl/book-row:flex-nowrap @3xl/book-row:items-stretch">
        <BookRowMeta
          ageBadgeClassName={compact?.ageBadge}
          book={book}
          formatsClassName={compact?.formats}
          LinkComp={LinkComp}
          metaClassName={compact?.meta}
          metaIconClassName={compact?.metaIcon}
          mobileKebab={compact === null ? undefined : kebab}
          note={note}
          rowLink={rowLink}
        />

        {detailsSlot === undefined ? null : (
          <>
            <div className="hidden w-px self-stretch bg-border @3xl/book-row:block" />
            {detailsSlot}
          </>
        )}

        {statusPlacement === "column" ? (
          <>
            <div className="hidden w-px self-stretch bg-border @3xl/book-row:block" />
            {statusSlot ?? <BookRowStatuses book={book} compact={compact} />}
          </>
        ) : null}

        {hasChips ? (
          <>
            <div
              className={cn(
                "hidden w-px self-stretch bg-border @3xl/book-row:block",
                compact?.chips,
              )}
            />
            <BookRowChips className={compact?.chips} genres={book.genres} tags={book.tags} />
          </>
        ) : null}

        {actionsSlot === undefined ? null : (
          <>
            <div className="hidden w-px self-stretch bg-border @3xl/book-row:block" />
            <div className="flex flex-wrap content-start items-center gap-1.5 @xl/book-row:basis-full @3xl/book-row:min-w-0 @3xl/book-row:flex-1 @3xl/book-row:basis-0">
              {actionsSlot}
            </div>
          </>
        )}

        {compact === null ? null : (
          <BookRowQueueRating
            className="mt-auto self-end sm:hidden"
            inReadingQueue={book.isInReadingQueue}
            rating={book.rating}
            ratingClassName={compact.rating}
            ratingLabel={book.ratingLabel}
          />
        )}
      </div>

      <BookRowRail
        className={compact?.rail}
        inReadingQueue={book.isInReadingQueue}
        kebab={kebab}
        rating={book.rating}
        ratingLabel={book.ratingLabel}
      />
    </article>
  );
}

function BookRowChips({
  className,
  genres,
  tags,
}: {
  className?: string;
  genres?: LibraryBook["genres"];
  tags?: string[];
}) {
  const visibleGenres = (genres ?? []).slice(0, GENRES_VISIBLE);
  const visibleTags = (tags ?? []).slice(0, TAGS_VISIBLE);
  const hiddenTags = (tags ?? []).slice(TAGS_VISIBLE);

  if (visibleGenres.length === 0 && visibleTags.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap content-start items-center gap-1.5 @xl/book-row:basis-full @3xl/book-row:min-w-0 @3xl/book-row:flex-1 @3xl/book-row:basis-0",
        className,
      )}
    >
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

function BookRowCover({
  alt,
  aspect,
  className,
  src,
}: {
  alt: string;
  aspect: BookRowCoverAspect;
  className?: string;
  src?: string;
}) {
  const frameClass = aspect === "portrait" ? "aspect-[2/3] self-start" : "self-stretch";

  if (src === undefined) {
    return (
      <div
        className={cn(
          "grid w-24 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground/70",
          frameClass,
          className,
        )}
      >
        <UiIcon name="book" size={32} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-24 shrink-0 overflow-hidden rounded-lg bg-accent",
        frameClass,
        className,
      )}
    >
      <Image alt={alt} className="object-cover" fill sizes="96px" src={src} unoptimized />
    </div>
  );
}

function BookRowMeta({
  ageBadgeClassName,
  book,
  formatsClassName,
  LinkComp,
  metaClassName,
  metaIconClassName,
  mobileKebab,
  note,
  rowLink,
}: {
  ageBadgeClassName?: string;
  book: BookRowBook;
  formatsClassName?: string;
  LinkComp: RowLinkComponent;
  metaClassName?: string;
  metaIconClassName?: string;
  mobileKebab?: React.ReactNode;
  note?: React.ReactNode;
  rowLink: boolean;
}) {
  const headingLayout = mobileKebab === undefined ? "contents" : "flex items-start gap-2";
  const headingTextLayout =
    mobileKebab === undefined ? "contents" : "flex min-w-0 flex-1 flex-col gap-1";

  return (
    <div className="flex min-w-0 flex-col gap-1 @xl/book-row:min-w-[14rem] @xl/book-row:flex-1">
      <div className={cn(headingLayout, "sm:contents")}>
        <div className={cn(headingTextLayout, "sm:contents")}>
          <h3 className="line-clamp-2 font-heading text-sm leading-tight font-bold text-ink">
            <LinkComp
              className={cn(
                "text-ink no-underline transition-colors group-hover/book-row:text-primary",
                rowLink && "after:absolute after:inset-0",
              )}
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
        </div>

        {mobileKebab === undefined ? null : (
          <div className="relative z-10 shrink-0 sm:hidden">{mobileKebab}</div>
        )}
      </div>

      {note}

      {book.series === undefined ? null : (
        <LinkComp
          className={cn(
            "relative z-10 mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground no-underline transition-colors hover:text-primary",
            metaClassName,
          )}
          href={book.series.href}
        >
          <UiIcon className={cn("shrink-0 text-icon", metaIconClassName)} name="layers" size={15} />
          <span className="min-w-0 truncate">
            {book.series.name}
            {book.series.positionLabel === undefined ? null : (
              <span className="text-muted-foreground"> · {book.series.positionLabel}</span>
            )}
          </span>
        </LinkComp>
      )}

      {book.publisher === undefined ? null : (
        <p
          className={cn(
            "flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground",
            metaClassName,
          )}
        >
          <UiIcon
            className={cn("shrink-0 text-icon", metaIconClassName)}
            name="building"
            size={15}
          />
          <span className="min-w-0 truncate">{book.publisher}</span>
        </p>
      )}

      {(book.formats ?? []).length === 0 ? null : (
        <div
          className={cn(
            "flex min-w-0 items-center gap-x-3 overflow-hidden text-xs text-muted-foreground",
            formatsClassName,
          )}
        >
          {(book.formats ?? []).map((format) => (
            <span className="inline-flex shrink-0 items-center gap-1.5" key={format.value}>
              <UiIcon className="shrink-0 text-icon" name={format.icon} size={15} />
              {format.label}
            </span>
          ))}
        </div>
      )}

      {book.ageBadge === undefined ? null : (
        <span
          className={cn(
            statusBadgeVariants({ tone: "danger" }),
            "mt-auto self-end",
            ageBadgeClassName,
          )}
        >
          {book.ageBadge}
        </span>
      )}
    </div>
  );
}

function BookRowQueueRating({
  className,
  inReadingQueue,
  rating,
  ratingClassName,
  ratingLabel,
}: {
  className?: string;
  inReadingQueue?: boolean;
  rating?: number;
  ratingClassName?: string;
  ratingLabel?: string;
}) {
  const t = useTranslations("books.library");

  return (
    <div className={cn("flex flex-col items-end gap-2", className)}>
      {inReadingQueue === true ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs text-muted-foreground",
            ratingClassName,
          )}
        >
          <UiIcon className="shrink-0" name="bookmark" size={14} />
          {t("card.inQueue")}
        </span>
      ) : null}

      {rating === undefined ? null : (
        <RatingScore className={ratingClassName} label={ratingLabel} value={rating} />
      )}
    </div>
  );
}

function BookRowRail({
  className,
  inReadingQueue,
  kebab,
  rating,
  ratingLabel,
}: {
  className?: string;
  inReadingQueue?: boolean;
  kebab?: React.ReactNode;
  rating?: number;
  ratingLabel?: string;
}) {
  return (
    <div className={cn("flex shrink-0 flex-col items-end gap-2 self-stretch", className)}>
      {kebab === undefined ? null : <div className="relative z-10 shrink-0">{kebab}</div>}

      <BookRowQueueRating
        className="mt-auto"
        inReadingQueue={inReadingQueue}
        rating={rating}
        ratingLabel={ratingLabel}
      />
    </div>
  );
}

function BookRowStatuses({
  book,
  compact,
}: {
  book: BookRowBook;
  compact?: null | typeof MOBILE_COMPACT;
}) {
  return (
    <div className={cn("flex shrink-0 flex-col gap-1 @xl/book-row:w-40", compact?.statusGroup)}>
      {book.status === undefined ? null : (
        <StatusBadge className={compact?.statusBadge} entry={book.status} />
      )}

      {book.ownership === undefined ? null : (
        <StatusBadge className={compact?.statusBadge} entry={book.ownership} />
      )}

      {compact === null || compact === undefined || book.ageBadge === undefined ? null : (
        <span
          className={cn(statusBadgeVariants({ tone: "danger" }), compact.statusBadge, "sm:hidden")}
        >
          {book.ageBadge}
        </span>
      )}

      {book.loan === undefined ? null : (
        <BookLoanNote
          className={cn("text-xs", compact?.statusNote)}
          icon={book.loan.icon}
          text={book.loan.text}
        />
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
