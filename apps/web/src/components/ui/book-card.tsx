"use client";

import { cva, type VariantProps } from "class-variance-authority";
import Image from "next/image";
import * as React from "react";

import { GenreIcon, type GenreIconName, UiIcon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import { Rating } from "@/components/ui/rating";
import { StatusBadge } from "@/components/ui/status-badge";
import { type StatusEntry } from "@/lib/book-status";
import { cn } from "@/lib/utils";

const bookCardVariants = cva(
  "group/book-card relative flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out motion-reduce:transition-none",
  {
    variants: {
      interactive: {
        true: "cursor-pointer hover:border-accent-border hover:shadow-hover focus-visible:border-accent-border focus-visible:shadow-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        false: "",
      },
      selected: {
        true: "border-primary shadow-[0_0_0_1px_var(--primary)]",
        false: "",
      },
    },
    defaultVariants: {
      interactive: false,
      selected: false,
    },
  },
);

type BookCardLinkComponent = React.ComponentType<{
  children?: React.ReactNode;
  className?: string;
  href: string;
}>;

type BookCardProps = Omit<React.ComponentProps<"article">, "title"> &
  VariantProps<typeof bookCardVariants> & {
    author: string;
    cover?: { alt?: string; src: string };
    coverActivateLabel?: string;
    genres?: { icon?: GenreIconName; label: string }[];
    href?: string;
    kebab?: React.ReactNode;
    linkComponent?: BookCardLinkComponent;
    onCoverActivate?: () => void;
    progress?: { ariaLabel?: string; current: number; total: number; unit?: string };
    rating?: number;
    ratingLabel?: string;
    series?: string;
    status: StatusEntry;
    title: string;
  };

function BookCard({
  author,
  className,
  cover,
  coverActivateLabel,
  genres,
  href,
  interactive,
  kebab,
  linkComponent,
  onCoverActivate,
  progress,
  rating,
  ratingLabel,
  selected,
  series,
  status,
  title,
  ...props
}: BookCardProps) {
  const isInteractive = interactive ?? href !== undefined;
  const LinkComp: "a" | BookCardLinkComponent = linkComponent ?? "a";

  return (
    <article
      className={cn(bookCardVariants({ interactive: isInteractive, selected }), className)}
      data-slot="book-card"
      {...props}
    >
      {kebab === undefined ? null : <div className="absolute top-3 right-3 z-10">{kebab}</div>}

      <div className="flex gap-3.5">
        <BookCover
          activateLabel={coverActivateLabel}
          alt={cover?.alt ?? title}
          onActivate={onCoverActivate}
          src={cover?.src}
        />
        <div className="flex min-w-0 flex-col gap-1.5 pr-16">
          <h3 className="font-heading text-[1.0625rem] leading-tight font-bold text-ink">
            {href === undefined ? (
              title
            ) : (
              <LinkComp
                className="font-bold text-ink no-underline transition-colors group-hover/book-card:text-primary after:absolute after:inset-0"
                href={href}
              >
                {title}
              </LinkComp>
            )}
          </h3>
          <p className="text-[0.8125rem] text-muted-foreground">{author}</p>
          <StatusBadge className="mt-0.5 self-start" entry={status} />
        </div>
      </div>

      {series === undefined ? null : (
        <p className="flex items-center gap-1.5 text-[0.8125rem] text-foreground/85">
          <UiIcon className="shrink-0 text-icon" name="layers" size={15} />
          <span className="min-w-0 truncate">{series}</span>
        </p>
      )}

      {progress === undefined ? null : (
        <div className="flex flex-col gap-1.5">
          <Progress
            aria-label={progress.ariaLabel}
            aria-valuetext={`${progress.current} / ${progress.total} ${progress.unit ?? ""}`.trim()}
            className="h-1.5"
            max={progress.total}
            value={progress.total <= 0 ? 0 : (progress.current / progress.total) * 100}
          />
          <span aria-hidden="true" className="self-end text-xs text-muted-foreground tabular-nums">
            {progress.current} / {progress.total} {progress.unit}
          </span>
        </div>
      )}

      {(genres === undefined || genres.length === 0) && rating === undefined ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {genres?.map((genre) => (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-tag px-2.5 py-0.5 text-xs font-medium text-tag-foreground"
              key={genre.label}
            >
              {genre.icon === undefined ? null : (
                <GenreIcon className="shrink-0 text-icon" name={genre.icon} size={14} />
              )}
              {genre.label}
            </span>
          ))}
          {rating === undefined ? null : (
            <Rating className="ml-auto" label={ratingLabel} size="sm" value={rating} />
          )}
        </div>
      )}
    </article>
  );
}

const coverBoxClass =
  "relative aspect-[3/4] w-[74px] shrink-0 overflow-hidden rounded-md bg-accent shadow-[0_2px_8px_oklch(0.296_0.041_53/0.14)]";

function BookCover({
  activateLabel,
  alt,
  onActivate,
  src,
}: {
  activateLabel?: string;
  alt: string;
  onActivate?: () => void;
  src?: string;
}) {
  if (src === undefined) {
    return (
      <div className="grid aspect-[3/4] w-[74px] shrink-0 place-items-center rounded-md bg-accent text-accent-foreground/70 shadow-[0_2px_8px_oklch(0.296_0.041_53/0.14)]">
        <UiIcon name="book" size={24} />
      </div>
    );
  }

  return (
    <BookCoverImage activateLabel={activateLabel} alt={alt} onActivate={onActivate} src={src} />
  );
}

function BookCoverImage({
  activateLabel,
  alt,
  onActivate,
  src,
}: {
  activateLabel?: string;
  alt: string;
  onActivate?: () => void;
  src: string;
}) {
  const [loaded, setLoaded] = React.useState(false);

  const image = (
    <Image
      alt={alt}
      className={cn(
        "object-cover transition-opacity duration-500 ease-out",
        loaded ? "opacity-100" : "motion-safe:opacity-0",
      )}
      fill
      onLoad={() => setLoaded(true)}
      sizes="74px"
      src={src}
      unoptimized
    />
  );

  if (onActivate === undefined) {
    return <div className={coverBoxClass}>{image}</div>;
  }

  return (
    <button
      aria-label={activateLabel}
      className={cn(
        coverBoxClass,
        "z-10 cursor-pointer transition-shadow duration-300 ease-out hover:shadow-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
      onClick={onActivate}
      type="button"
    >
      {image}
    </button>
  );
}

export { BookCard, bookCardVariants };
