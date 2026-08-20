"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useAnimatedHeight } from "@/hooks/use-animated-height";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { ORDER_CARD_LAYOUT } from "../model/order-card-model";

export type OrderCardBook = {
  authorName: string;
  bookHref: string;
  coverSrc?: string;
  id: string;
  priceText: Nullable<string>;
  series: Nullable<OrderCardBookSeries>;
  title: string;
};

export type OrderCardBookSeries = {
  href: string;
  name: string;
  positionLabel: Nullable<string>;
};

export type OrderCardMetadataEntry = { label: string; value: string };

const TOTAL_SLOT = {
  alone: "pt-0.5 text-right tabular-nums max-sm:col-start-1 max-sm:row-start-2 max-sm:pt-0",
  besideBadge:
    "pt-0.5 text-right tabular-nums max-sm:col-start-2 max-sm:row-start-2 max-sm:min-w-0 max-sm:pt-0",
} as const;

export function OrderBookList<Book extends OrderCardBook>({
  books,
  renderBook,
}: {
  books: Book[];
  renderBook: (book: Book) => ReactNode;
}) {
  if (books.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 gap-x-5 border-t border-border px-3 lg:grid-cols-2">
      {books.map((book, bookIndex) => (
        <li
          className={cn(
            bookIndex > 0 && "border-t border-border",
            bookIndex === 1 && "lg:border-t-0",
          )}
          key={book.id}
        >
          {renderBook(book)}
        </li>
      ))}
    </ul>
  );
}

export function OrderBookRow({
  actions,
  book,
  footnote,
}: {
  actions?: ReactNode;
  book: OrderCardBook;
  footnote?: ReactNode;
}) {
  return (
    <div className="group flex min-h-20 items-center gap-3 py-3 transition-colors max-sm:min-h-0 max-sm:py-2">
      <Link
        className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-accent shadow-soft"
        href={book.bookHref}
      >
        {book.coverSrc === undefined ? (
          <span className="grid h-full place-items-center text-accent-foreground/70">
            <UiIcon name="book" size={15} />
          </span>
        ) : (
          <Image
            alt={book.title}
            className="object-cover"
            fill
            sizes="48px"
            src={book.coverSrc}
            unoptimized
          />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          className="line-clamp-2 font-heading text-sm font-semibold text-ink hover:text-primary max-sm:leading-tight sm:line-clamp-1"
          href={book.bookHref}
        >
          {book.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{book.authorName}</p>
        {book.series === null ? null : (
          <Link
            className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground no-underline transition-colors hover:text-primary"
            href={book.series.href}
          >
            <UiIcon className="shrink-0 text-icon" name="layers" size={15} />
            <span className="min-w-0 truncate">
              {book.series.name}
              {book.series.positionLabel === null ? null : (
                <span className="text-muted-foreground"> · {book.series.positionLabel}</span>
              )}
            </span>
          </Link>
        )}
        {footnote}
      </div>
      {book.priceText === null ? null : (
        <p className="shrink-0 text-sm font-semibold text-ink tabular-nums">{book.priceText}</p>
      )}
      {actions}
    </div>
  );
}

export function OrderCard({
  actions,
  badge,
  booksCountText,
  children,
  expandControl,
  metaText,
  orderId,
  revealed = false,
  storeName,
  totalText,
}: {
  actions?: ReactNode;
  badge?: ReactNode;
  booksCountText: string;
  children: ReactNode;
  expandControl?: ReactNode;
  metaText: string;
  orderId: string;
  revealed?: boolean;
  storeName: string;
  totalText: Nullable<string>;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card max-sm:gap-3 max-sm:p-3",
        "motion-safe:transition-shadow motion-safe:duration-500",
        revealed && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      data-order-id={orderId}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:gap-y-3">
        <div className="flex min-w-0 items-start gap-3 max-sm:col-start-1 max-sm:row-start-1">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-accent text-icon">
            <UiIcon name="store" size={17} />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className="truncate font-heading text-base leading-tight font-semibold text-ink">
              {storeName}
            </h3>
            {metaText === "" ? null : (
              <p className="truncate font-mono text-xs text-muted-foreground">{metaText}</p>
            )}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-start gap-2 max-sm:contents">
          {badge}
          <div className={badge === undefined ? TOTAL_SLOT.alone : TOTAL_SLOT.besideBadge}>
            <p className="font-heading text-lg leading-tight font-semibold text-ink">
              {totalText ?? "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{booksCountText}</p>
          </div>
          {actions}
        </div>
      </header>

      {children}

      {expandControl}
    </article>
  );
}

export function OrderCardBooksRegion({
  children,
  containerRef,
  contentRef,
}: {
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className="overflow-hidden motion-safe:transition-[height] motion-safe:duration-300 motion-safe:ease-out"
      ref={containerRef}
    >
      <div className="flex flex-col gap-3" ref={contentRef}>
        {children}
      </div>
    </div>
  );
}

export function OrderCardExpandButton({
  expanded,
  hiddenCount,
  onToggle,
}: {
  expanded: boolean;
  hiddenCount: number;
  onToggle: () => void;
}) {
  const t = useTranslations("delivery.card");

  if (hiddenCount <= 0) return null;

  return (
    <Button className="self-center" onClick={onToggle} variant="ghost">
      <UiIcon name={expanded ? "chevron-up" : "chevron-down"} size={16} />
      {expanded ? t("collapseBooks") : t("showMoreBooks", { count: hiddenCount })}
    </Button>
  );
}

export function OrderShipmentSection({
  actions,
  badge,
  books,
  details,
  leading,
  metadata,
  openTrackingLabel,
  revealed = false,
  selected = false,
  shipmentId,
  title,
  trackingHref,
}: {
  actions?: ReactNode;
  badge: ReactNode;
  books: ReactNode;
  details?: ReactNode;
  leading?: ReactNode;
  metadata: OrderCardMetadataEntry[];
  openTrackingLabel: string;
  revealed?: boolean;
  selected?: boolean;
  shipmentId: Nullable<string>;
  title: string;
  trackingHref: Nullable<string>;
}) {
  const tCommon = useTranslations("common");

  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-border transition-colors max-sm:border-0",
        selected ? "bg-primary/5" : "bg-card",
        "motion-safe:transition-shadow motion-safe:duration-500",
        revealed && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      data-shipment-id={shipmentId ?? undefined}
    >
      <div className="flex items-start justify-between gap-3 bg-secondary/30 p-3 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-2 max-sm:gap-y-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 max-sm:flex-col max-sm:items-start">
            <div className="contents max-sm:flex max-sm:w-full max-sm:min-w-0 max-sm:items-center max-sm:gap-2">
              {leading}
              <UiIcon className="shrink-0 text-icon" name="package" size={16} />
              <h4 className="min-w-0 truncate font-heading text-sm font-semibold text-ink">
                {title}
              </h4>
            </div>
            {badge}
          </div>
          {metadata.length === 0 && trackingHref === null ? null : (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground max-sm:flex-col max-sm:items-start max-sm:gap-y-2">
              {metadata.map(({ label, value }, metadataIndex) => (
                <span className="contents" key={label}>
                  {metadataIndex === 0 ? null : (
                    <span aria-hidden className="max-sm:hidden">
                      ·
                    </span>
                  )}
                  <span className="min-w-0 break-words">
                    <span className="sr-only">{label}: </span>
                    {value}
                  </span>
                </span>
              ))}
              {trackingHref === null ? null : (
                <>
                  {metadata.length === 0 ? null : (
                    <span aria-hidden className="max-sm:hidden">
                      ·
                    </span>
                  )}
                  <a
                    className="inline-flex items-center gap-1.5 text-primary underline underline-offset-2"
                    href={trackingHref}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <UiIcon name="external" size={14} />
                    {openTrackingLabel}
                    <span className="sr-only">{tCommon("opensInNewTab")}</span>
                  </a>
                </>
              )}
            </p>
          )}
          {details}
        </div>
        {actions === undefined ? null : (
          <div className="flex shrink-0 items-center gap-1 max-sm:contents">{actions}</div>
        )}
      </div>

      {books}
    </section>
  );
}

export function useExpandableBooks({
  booksCount,
  hiddenCount,
  initiallyExpanded = false,
  revealKey,
  revealsThisCard,
}: {
  booksCount: number;
  hiddenCount: number;
  initiallyExpanded?: boolean;
  revealKey?: Nullable<string>;
  revealsThisCard?: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [handledRevealKey, setHandledRevealKey] = useState<Nullable<string>>(revealKey ?? null);

  if ((revealKey ?? null) !== handledRevealKey) {
    setHandledRevealKey(revealKey ?? null);
    if (revealsThisCard === true) {
      setExpanded(true);
    }
  }

  const visibleLimit = expanded ? booksCount : ORDER_CARD_LAYOUT.bookLimit;
  const { containerRef, contentRef } = useAnimatedHeight<HTMLDivElement>({
    contentKey: visibleLimit,
    expanded,
  });

  return {
    containerRef,
    contentRef,
    expanded,
    hiddenCount,
    toggle: () => setExpanded((value) => !value),
    visibleLimit,
  };
}
