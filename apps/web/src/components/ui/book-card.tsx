"use client";

import { cva, type VariantProps } from "class-variance-authority";
import Image from "next/image";
import * as React from "react";

import { GenreIcon, type GenreIconName, UiIcon, type UiIconName } from "@/components/icons";
import { RatingScore } from "@/components/ui/rating-score";
import { StatusBadge, statusBadgeVariants } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type StatusEntry } from "@/lib/book-status";
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
    ageBadge?: string;
    authors: string[];
    cover?: { alt?: string; src: string };
    coverActivateLabel?: string;
    footer?: React.ReactNode;
    formats?: { icon: UiIconName; label: string; value: string }[];
    genres?: { icon?: GenreIconName; label: string }[];
    href?: string;
    kebab?: React.ReactNode;
    linkComponent?: BookCardLinkComponent;
    mobileCompact?: boolean;
    note?: React.ReactNode;
    onCoverActivate?: () => void;
    ownership?: StatusEntry;
    ownershipTooltip?: string;
    progress?: { current: number; total: number; unit?: string };
    publisher?: string;
    rating?: number;
    ratingLabel?: string;
    series?: { href: string; name: string; positionLabel?: string };
    status?: StatusEntry;
    tags?: string[];
    title: string;
  };

const GENRES_VISIBLE = 2;
const TAGS_VISIBLE = 2;
const TOOLTIP_DELAY_MS = 400;

const MOBILE_COMPACT = {
  ageBadge: "max-sm:h-6 max-sm:px-1 max-sm:text-[0.625rem]",
  actions: "max-sm:top-2 max-sm:right-2",
  author: "max-sm:text-xs",
  body: "max-sm:px-2",
  capsule: "max-sm:gap-1 max-sm:px-1.5 max-sm:py-1",
  capsuleIcon: "max-sm:size-3.5",
  capsuleLeft: "max-sm:bottom-2 max-sm:left-2",
  capsuleRight: "max-sm:right-2 max-sm:bottom-2",
  chips: "max-sm:hidden",
  meta: "max-sm:text-[0.625rem]",
  metaIcon: "max-sm:size-3",
  ratingBlock: "mt-auto self-end text-[0.625rem] sm:hidden [&_svg]:size-3",
  ratingInline: "max-sm:hidden",
  seriesIcon: "max-sm:mt-0.5",
  seriesRow: "max-sm:items-start",
  seriesText: "max-sm:overflow-visible max-sm:whitespace-normal",
  statusBadge: "max-sm:size-6 max-sm:justify-center max-sm:gap-0 max-sm:px-0",
  statusGroup: "max-sm:top-2 max-sm:left-2 max-sm:gap-1",
  statusLabel: "max-sm:hidden",
  title: "max-sm:text-sm",
} as const;

const morePillClass =
  "relative z-10 inline-flex shrink-0 items-center rounded-full border border-border/60 bg-secondary/40 px-1.5 py-0.5 text-xs font-medium text-muted-foreground";

function BookCard({
  ageBadge,
  authors,
  className,
  cover,
  coverActivateLabel,
  footer,
  formats,
  genres,
  href,
  interactive,
  kebab,
  linkComponent,
  mobileCompact,
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
  const showChips = (genres ?? []).length > 0 || (tags ?? []).length > 0;
  const compact = mobileCompact === true ? MOBILE_COMPACT : null;

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

        {status === undefined && ageBadge === undefined ? null : (
          <div
            className={cn(
              "absolute top-3 left-3 z-10 flex items-center gap-1.5",
              compact?.statusGroup,
            )}
          >
            {status === undefined ? null : (
              <CoverStatusBadge
                className={compact?.statusBadge}
                labelClassName={compact?.statusLabel}
                progress={progress}
                status={status}
              />
            )}
            {ageBadge === undefined ? null : (
              <span className={cn(statusBadgeVariants({ tone: "danger" }), compact?.ageBadge)}>
                {ageBadge}
              </span>
            )}
          </div>
        )}

        {kebab === undefined ? null : (
          <div className={cn("absolute top-3 right-3 z-10", compact?.actions)}>{kebab}</div>
        )}

        {formats === undefined || formats.length === 0 ? null : (
          <div className={cn("absolute bottom-3 left-3 z-10", compact?.capsuleLeft)}>
            <CoverInfo
              className={compact?.capsule}
              label={formats.map((format) => format.label).join(", ")}
            >
              {formats.map((format) => (
                <UiIcon
                  className={compact?.capsuleIcon}
                  key={format.value}
                  name={format.icon}
                  size={16}
                />
              ))}
            </CoverInfo>
          </div>
        )}

        {ownership === undefined ? null : (
          <div className={cn("absolute right-3 bottom-3 z-10", compact?.capsuleRight)}>
            <CoverInfo className={compact?.capsule} label={ownershipTooltip ?? ownership.label}>
              <UiIcon className={compact?.capsuleIcon} name={ownership.icon} size={16} />
            </CoverInfo>
          </div>
        )}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col gap-1.5 p-4", compact?.body)}>
        <h3
          className={cn(
            "line-clamp-2 font-heading text-[1.0625rem] leading-tight font-bold text-ink",
            compact?.title,
          )}
        >
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
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[0.8125rem] text-muted-foreground",
              compact?.author,
            )}
          >
            {authors.join(", ")}
          </p>
          {rating === undefined ? null : (
            <RatingScore
              className={cn("shrink-0", compact?.ratingInline)}
              label={ratingLabel}
              value={rating}
            />
          )}
        </div>

        {note}

        {series === undefined ? null : (
          <LinkComp
            className={cn(
              "relative z-10 flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-muted-foreground no-underline transition-colors hover:text-primary",
              compact?.meta,
              compact?.seriesRow,
            )}
            href={series.href}
          >
            <UiIcon
              className={cn("shrink-0 text-icon", compact?.metaIcon, compact?.seriesIcon)}
              name="layers"
              size={15}
            />
            <span className={cn("min-w-0 truncate", compact?.seriesText)}>
              {series.name}
              {series.positionLabel === undefined ? null : (
                <span className="text-muted-foreground"> · {series.positionLabel}</span>
              )}
            </span>
          </LinkComp>
        )}

        {publisher === undefined ? null : (
          <p
            className={cn(
              "flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground",
              compact?.meta,
            )}
          >
            <UiIcon
              className={cn("shrink-0 text-icon", compact?.metaIcon)}
              name="building"
              size={15}
            />
            <span className="min-w-0 truncate">{publisher}</span>
          </p>
        )}

        {compact === null || rating === undefined ? null : (
          <RatingScore className={compact.ratingBlock} label={ratingLabel} value={rating} />
        )}

        {showChips ? (
          <div className={cn("mt-auto flex flex-col gap-2.5 pt-1", compact?.chips)}>
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
        ) : null}

        {footer === undefined ? null : (
          <div className="relative z-10 mt-auto border-t border-border/60 pt-3">{footer}</div>
        )}
      </div>
    </article>
  );
}

function CoverInfo({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <Tooltip delayDuration={TOOLTIP_DELAY_MS}>
      <TooltipTrigger
        aria-label={label}
        className={cn(
          "inline-flex cursor-default items-center gap-1.5 rounded-lg border border-[color:var(--book-overlay-capsule-border)] bg-[var(--book-overlay-capsule-surface)] px-2 py-1.5 text-[color:var(--book-overlay-capsule-foreground)] shadow-sm backdrop-blur-[6px] focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none",
          className,
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function CoverStatusBadge({
  className,
  labelClassName,
  progress,
  status,
}: {
  className?: string;
  labelClassName?: string;
  progress?: { current: number; total: number; unit?: string };
  status: StatusEntry;
}) {
  const badge = (
    <StatusBadge
      aria-label={status.label}
      className={cn("max-w-full", className)}
      entry={status}
      labelClassName={labelClassName}
    />
  );

  if (progress === undefined || progress.total <= 0) {
    return (
      <div className="max-w-full min-w-0" data-slot="cover-status-badge">
        {badge}
      </div>
    );
  }

  const percent = Math.round((progress.current / progress.total) * 100);
  const tooltip = `${progress.current} / ${progress.total} ${progress.unit ?? ""}`.trim();

  return (
    <Tooltip delayDuration={TOOLTIP_DELAY_MS}>
      <TooltipTrigger
        className="max-w-full cursor-default rounded-full focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
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
        "z-10 block cursor-zoom-in transition duration-300 ease-out hover:brightness-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset",
      )}
      onClick={onActivate}
      type="button"
    >
      {image}
    </button>
  );
}

export { BookCard, bookCardVariants };
