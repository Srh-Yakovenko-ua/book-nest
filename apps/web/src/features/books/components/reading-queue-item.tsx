"use client";

import type { PointerEvent, ReactNode } from "react";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { LibraryBook } from "../model/library-book";

type ReadingQueueItemProps = {
  book: LibraryBook;
  dragHandle: ReactNode;
  onMoveDown?: () => void;
  onMoveUp?: () => void;
  onRemove: () => void;
  onStartReading: () => void;
  position: number;
};

export function QueueDragHandle({
  disabled = false,
  label,
  onPointerDown,
}: {
  disabled?: boolean;
  label: string;
  onPointerDown?: (event: PointerEvent) => void;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "grid size-8 shrink-0 touch-none place-items-center rounded-md text-muted-foreground opacity-70 transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:opacity-100",
        disabled ? "cursor-not-allowed opacity-30" : "cursor-grab active:cursor-grabbing",
      )}
      disabled={disabled}
      onPointerDown={onPointerDown}
      type="button"
    >
      <UiIcon name="grip" size={16} />
    </button>
  );
}

export function ReadingQueueItem({
  book,
  dragHandle,
  onMoveDown,
  onMoveUp,
  onRemove,
  onStartReading,
  position,
}: ReadingQueueItemProps) {
  const t = useTranslations("readingQueue.item");
  const genres = book.genres ?? [];
  const tags = book.tags ?? [];
  const showMeta = book.series !== undefined || genres.length > 0 || tags.length > 0;

  return (
    <article className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-card transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-hover sm:gap-3.5">
      {dragHandle}

      <span
        aria-label={t("positionAria", { position })}
        className="w-7 shrink-0 text-center font-mono text-sm text-muted-foreground tabular-nums"
      >
        {t("position", { position })}
      </span>

      <QueueItemCover alt={book.cover?.alt ?? book.title} src={book.cover?.src} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate font-heading text-sm leading-tight font-bold text-ink">
            <Link
              className="text-ink no-underline transition-colors hover:text-primary"
              href={book.href}
            >
              {book.title}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge entry={book.status} />
          {book.readingStatus === "reading" ? (
            <Badge variant="info">{t("readingNow")}</Badge>
          ) : null}
          {book.ownership === undefined ? null : <StatusBadge entry={book.ownership} />}
        </div>

        {showMeta ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {book.series === undefined ? null : (
              <span className="inline-flex items-center gap-1">
                <UiIcon name="layers" size={13} />
                {book.series}
              </span>
            )}
            {genres.map((genre) => (
              <QueueChip key={genre.label}>{genre.label}</QueueChip>
            ))}
            {tags.map((tag) => (
              <QueueChip key={tag}>#{tag}</QueueChip>
            ))}
          </div>
        ) : null}
      </div>

      <span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums lg:inline">
        {book.pagesText ?? ""}
      </span>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button onClick={onStartReading} size="sm">
          {t("startReading")}
        </Button>
        <Button asChild className="hidden md:inline-flex" size="sm" variant="ghost">
          <Link href={book.href}>{t("viewBook")}</Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={t("moreActions", { title: book.title })}
              size="icon-sm"
              variant="ghost"
            >
              <UiIcon name="more" size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem disabled={onMoveUp === undefined} onSelect={() => onMoveUp?.()}>
              <UiIcon name="arrow-up" size={15} />
              {t("moveUp")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={onMoveDown === undefined} onSelect={() => onMoveDown?.()}>
              <UiIcon name="arrow-down" size={15} />
              {t("moveDown")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRemove} variant="destructive">
              <UiIcon name="x-circle" size={15} />
              {t("remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

function QueueChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
      {children}
    </span>
  );
}

function QueueItemCover({ alt, src }: { alt: string; src?: string }) {
  if (src === undefined) {
    return (
      <div className="grid aspect-[3/4] w-11 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={18} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-11 shrink-0 overflow-hidden rounded-md bg-accent">
      <Image alt={alt} className="object-cover" fill sizes="44px" src={src} unoptimized />
    </div>
  );
}
