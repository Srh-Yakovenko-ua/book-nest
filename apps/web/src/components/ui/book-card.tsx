"use client";

import { cva, type VariantProps } from "class-variance-authority";
import Image from "next/image";
import * as React from "react";

import { GenreIcon, type GenreIconName, UiIcon, type UiIconName } from "@/components/icons";
import { RatingScore } from "@/components/ui/rating-score";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type StatusEntry, type StatusTone } from "@/lib/book-status";
import { cn } from "@/lib/utils";

const bookCardVariants = cva(
  "group/book-card relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out motion-reduce:transition-none",
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
    authors: string[];
    cover?: { alt?: string; src: string };
    coverActivateLabel?: string;
    formats?: { icon: UiIconName; label: string; value: string }[];
    genres?: { icon?: GenreIconName; label: string }[];
    href?: string;
    kebab?: React.ReactNode;
    linkComponent?: BookCardLinkComponent;
    note?: React.ReactNode;
    onCoverActivate?: () => void;
    ownership?: StatusEntry;
    ownershipTooltip?: string;
    progress?: { current: number; total: number; unit?: string };
    publisher?: string;
    rating?: number;
    ratingLabel?: string;
    series?: { href: string; name: string; positionLabel?: string };
    status: StatusEntry;
    tags?: string[];
    title: string;
  };

const GENRES_VISIBLE = 2;
const TAGS_VISIBLE = 3;
const TOOLTIP_DELAY_MS = 400;

const morePillClass =
  "relative z-10 inline-flex shrink-0 items-center rounded-full border border-border/60 bg-secondary/40 px-1.5 py-0.5 text-xs font-medium text-muted-foreground";

const statusToneText: Record<StatusTone, string> = {
  accent: "text-icon",
  danger: "text-error",
  info: "text-info",
  neutral: "text-muted-foreground",
  primary: "text-icon",
  success: "text-success",
  warning: "text-warning",
};

function BookCard({
  authors,
  className,
  cover,
  coverActivateLabel,
  formats,
  genres,
  href,
  interactive,
  kebab,
  linkComponent,
  note,
  onCoverActivate,
  ownership,
  ownershipTooltip,
  progress,
  publisher,
  rating,
  ratingLabel,
  selected,
  series,
  status,
  tags,
  title,
  ...props
}: BookCardProps) {
  const isInteractive = interactive ?? href !== undefined;
  const LinkComp: "a" | BookCardLinkComponent = linkComponent ?? "a";
  const showChipDivider = (genres ?? []).length > 0 && (tags ?? []).length > 0;

  return (
    <article
      className={cn(bookCardVariants({ interactive: isInteractive, selected }), className)}
      data-slot="book-card"
      {...props}
    >
      <div className="relative">
        <BookCover
          activateLabel={coverActivateLabel}
          alt={cover?.alt ?? title}
          onActivate={onCoverActivate}
          src={cover?.src}
        />

        <div className="pointer-events-none absolute inset-0 bg-[image:var(--book-cover-scrim-top)]" />
        <div className="pointer-events-none absolute inset-0 bg-[image:var(--book-cover-scrim)]" />

        <div className="absolute top-11 left-3 z-10">
          <CoverStatusBadge progress={progress} status={status} />
        </div>

        {kebab === undefined ? null : <div className="absolute top-3 right-3 z-10">{kebab}</div>}

        {formats === undefined || formats.length === 0 ? null : (
          <div className="absolute bottom-3 left-3 z-10">
            <CoverInfo label={formats.map((format) => format.label).join(", ")}>
              {formats.map((format) => (
                <UiIcon key={format.value} name={format.icon} size={16} />
              ))}
            </CoverInfo>
          </div>
        )}

        {ownership === undefined ? null : (
          <div className="absolute right-3 bottom-3 z-10">
            <CoverInfo label={ownershipTooltip ?? ownership.label}>
              <UiIcon name={ownership.icon} size={16} />
            </CoverInfo>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 font-heading text-[1.0625rem] leading-tight font-bold text-ink">
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

        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[0.8125rem] text-muted-foreground">
            {authors.join(", ")}
          </p>
          {rating === undefined ? null : (
            <RatingScore className="shrink-0" label={ratingLabel} value={rating} />
          )}
        </div>

        {note}

        {series === undefined ? null : (
          <LinkComp
            className="relative z-10 flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-muted-foreground no-underline transition-colors hover:text-primary"
            href={series.href}
          >
            <UiIcon className="shrink-0 text-icon" name="layers" size={15} />
            <span className="min-w-0 truncate">
              {series.name}
              {series.positionLabel === undefined ? null : (
                <span className="text-muted-foreground"> · {series.positionLabel}</span>
              )}
            </span>
          </LinkComp>
        )}

        {publisher === undefined ? null : (
          <p className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
            <UiIcon className="shrink-0 text-icon" name="building" size={15} />
            <span className="min-w-0 truncate">{publisher}</span>
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2.5 pt-1">
          <div className="flex min-h-6 flex-wrap items-center gap-1.5">
            {(genres ?? []).slice(0, GENRES_VISIBLE).map((genre) => (
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
            <MorePill items={(genres ?? []).slice(GENRES_VISIBLE).map((genre) => genre.label)} />
          </div>

          {showChipDivider ? <div className="h-px bg-border/60" /> : null}

          <div className="flex min-h-6 flex-wrap items-center gap-1.5">
            {(tags ?? []).slice(0, TAGS_VISIBLE).map((tag) => (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground/80"
                key={tag}
              >
                <UiIcon className="shrink-0 text-muted-foreground" name="hash" size={12} />
                {tag}
              </span>
            ))}
            {(tags ?? []).length > TAGS_VISIBLE ? (
              <span className={morePillClass}>+{(tags ?? []).length - TAGS_VISIBLE}</span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function CoverInfo({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Tooltip delayDuration={TOOLTIP_DELAY_MS}>
      <TooltipTrigger
        aria-label={label}
        className="inline-flex cursor-default items-center gap-1.5 rounded-lg border border-[color:var(--book-overlay-capsule-border)] bg-[var(--book-overlay-capsule-surface)] px-2 py-1.5 text-[color:var(--book-overlay-capsule-foreground)] shadow-sm backdrop-blur-[6px] focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none"
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function CoverStatusBadge({
  progress,
  status,
}: {
  progress?: { current: number; total: number; unit?: string };
  status: StatusEntry;
}) {
  const toneText = statusToneText[status.tone];
  const badge = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--book-overlay-badge-border)] bg-[var(--book-overlay-badge-surface)] px-2.5 py-1.5 text-xs leading-none font-semibold shadow-[var(--book-overlay-badge-shadow)] backdrop-blur-md">
      <UiIcon className={cn("shrink-0", toneText)} name={status.icon} size={14} />
      <span className="text-[color:var(--book-overlay-badge-foreground)]">{status.label}</span>
    </span>
  );

  if (progress === undefined || progress.total <= 0) {
    return <div data-slot="cover-status-badge">{badge}</div>;
  }

  const percent = Math.round((progress.current / progress.total) * 100);
  const tooltip = `${progress.current} / ${progress.total} ${progress.unit ?? ""}`.trim();

  return (
    <Tooltip delayDuration={TOOLTIP_DELAY_MS}>
      <TooltipTrigger
        className="cursor-default rounded-full focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
        data-slot="cover-status-badge"
      >
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top">{`${tooltip} · ${percent}%`}</TooltipContent>
    </Tooltip>
  );
}

function MorePill({ items, prefix = "" }: { items: string[]; prefix?: string }) {
  if (items.length === 0) return null;
  const label = items.map((item) => `${prefix}${item}`).join(", ");

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

const coverBoxClass = "relative aspect-[3/4] w-full overflow-hidden bg-accent";

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
      <div className="grid aspect-[3/4] w-full place-items-center bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={48} />
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
      sizes="(min-width:1280px) 22rem, (min-width:640px) 45vw, 90vw"
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
        "z-10 block cursor-pointer transition duration-300 ease-out hover:brightness-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset",
      )}
      onClick={onActivate}
      type="button"
    >
      {image}
    </button>
  );
}

export { BookCard, bookCardVariants };
