"use client";

import type { QueuePriority } from "@app/shared";
import type { LucideIcon } from "lucide-react";
import type { PointerEvent, ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
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
import { StatusBadge, statusBadgeVariants } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { LibraryBook } from "../model/library-book";
import type { ReadingQueueCard } from "../model/reading-queue-card";

import {
  QUEUE_PRIORITY_META,
  QUEUE_PRIORITY_REASON_ICONS,
  QUEUE_PRIORITY_REASON_LABEL_KEYS,
  reasonSupportsDate,
} from "../model/queue-priority";
import { priorityChipVariants } from "./queue-priority/queue-priority-variants";

type ReadingQueueItemProps = {
  book: LibraryBook;
  dragHandle: ReactNode;
  onMoveDown?: () => void;
  onMoveUp?: () => void;
  onRemove: () => void;
  onStartReading: () => void;
  position: number;
  queue: ReadingQueueCard;
};

const TOOLTIP_DELAY_MS = 400;

const dividerClass = "hidden w-px self-stretch bg-border @2xl/queue-card:block";

const statusBadgeCompactClass =
  "max-sm:h-5 max-sm:gap-0.5 max-sm:px-1.5 max-sm:text-[0.625rem] max-sm:[&>svg]:size-3";

export function QueueDragHandle({
  disabled = false,
  disabledTooltip,
  label,
  onPointerDown,
}: {
  disabled?: boolean;
  disabledTooltip?: string;
  label: string;
  onPointerDown?: (event: PointerEvent) => void;
}) {
  const handle = (
    <button
      aria-label={label}
      className={cn(
        "grid size-8 shrink-0 touch-none place-items-center self-center rounded-md text-muted-foreground opacity-70 transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none max-sm:size-6 max-sm:self-start sm:opacity-100",
        disabled ? "pointer-events-none opacity-30" : "cursor-grab active:cursor-grabbing",
      )}
      disabled={disabled}
      onPointerDown={onPointerDown}
      type="button"
    >
      <UiIcon name="grip" size={16} />
    </button>
  );

  if (disabled && disabledTooltip !== undefined) {
    return (
      <Tooltip delayDuration={TOOLTIP_DELAY_MS}>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0 cursor-not-allowed self-center">{handle}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{disabledTooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return handle;
}

export function ReadingQueueItem({
  book,
  dragHandle,
  onMoveDown,
  onMoveUp,
  onRemove,
  onStartReading,
  position,
  queue,
}: ReadingQueueItemProps) {
  const t = useTranslations("readingQueue.item");
  const isFirst = position === 1;

  return (
    <article className="group/queue-card @container/queue-card relative flex min-h-[9.5rem] items-stretch gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none max-sm:min-h-0 max-sm:gap-2 sm:gap-3.5">
      {dragHandle}

      <span
        aria-label={t("positionAria", { position })}
        className="w-6 shrink-0 self-center text-center font-mono text-sm text-muted-foreground tabular-nums max-sm:w-4 max-sm:self-start max-sm:pt-1 max-sm:text-xs"
      >
        {t("position", { position })}
      </span>

      <QueueItemCover alt={book.cover?.alt ?? book.title} src={book.cover?.src} />

      <div className="flex min-w-0 flex-1 flex-col gap-3 max-sm:gap-2 @2xl/queue-card:flex-row @2xl/queue-card:items-stretch @2xl/queue-card:gap-4">
        <QueueMeta book={book} />

        <div className={dividerClass} />

        <QueueStatuses book={book} ownership={queue.ownership} />

        <div className={dividerClass} />

        <QueuePriorityZone
          isFirst={isFirst}
          onStartReading={onStartReading}
          pagesText={book.pagesText}
          queue={queue}
        />
      </div>

      <QueueRail>
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
            {isFirst ? null : (
              <>
                <DropdownMenuItem onSelect={onStartReading}>
                  <UiIcon name="book" size={15} />
                  {t("startReading")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
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
      </QueueRail>
    </article>
  );
}

const coverFrameClass =
  "w-24 shrink-0 self-stretch rounded-lg bg-accent max-sm:aspect-[2/3] max-sm:w-16 max-sm:self-start";

function QueueItemCover({ alt, src }: { alt: string; src?: string }) {
  if (src === undefined) {
    return (
      <div className={cn("grid place-items-center text-accent-foreground/70", coverFrameClass)}>
        <UiIcon name="book" size={32} />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", coverFrameClass)}>
      <Image alt={alt} className="object-cover" fill sizes="96px" src={src} unoptimized />
    </div>
  );
}

function QueueMeta({ book }: { book: LibraryBook }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 @2xl/queue-card:flex-1">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="line-clamp-2 font-heading text-sm leading-tight font-bold text-ink">
          <Link
            className="text-ink no-underline transition-colors hover:text-primary"
            href={book.href}
          >
            {book.title}
          </Link>
        </h3>
        {book.authors.length === 0 ? null : (
          <p className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</p>
        )}
        {book.series === undefined ? null : (
          <Link
            className="relative z-10 mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground no-underline transition-colors hover:text-primary"
            href={book.series.href}
          >
            <UiIcon className="shrink-0 text-icon" name="layers" size={15} />
            <span className="min-w-0 truncate">
              {book.series.name}
              {book.series.positionLabel === undefined ? null : (
                <span className="text-muted-foreground"> · {book.series.positionLabel}</span>
              )}
            </span>
          </Link>
        )}
      </div>

      {book.ageBadge === undefined ? null : (
        <span className={cn(statusBadgeVariants({ tone: "danger" }), "mt-auto self-end")}>
          {book.ageBadge}
        </span>
      )}
    </div>
  );
}

function QueuePriorityChip({ label, priority }: { label: string; priority: QueuePriority }) {
  const { icon: Icon, tone } = QUEUE_PRIORITY_META[priority];

  return (
    <span className={priorityChipVariants({ tone })}>
      <Icon aria-hidden className="shrink-0" size={13} strokeWidth={1.9} />
      {label}
    </span>
  );
}

function QueuePriorityZone({
  isFirst,
  onStartReading,
  pagesText,
  queue,
}: {
  isFirst: boolean;
  onStartReading: () => void;
  pagesText?: string;
  queue: ReadingQueueCard;
}) {
  const t = useTranslations("books.organization.priority");
  const tQueue = useTranslations("readingQueue.item");
  const locale = useLocale();
  const { priority, reason, reasonCustomText, targetDate } = queue;

  const reasonLabel =
    reason === null
      ? ""
      : reason === "other"
        ? (reasonCustomText ?? "")
        : t(`reason.options.${QUEUE_PRIORITY_REASON_LABEL_KEYS[reason]}`);
  const showReason = priority === "high" && reason !== null && reasonLabel !== "";
  const showDate =
    priority === "high" && targetDate !== null && reason !== null && reasonSupportsDate(reason);

  return (
    <div className="flex flex-col items-start gap-2 @2xl/queue-card:w-44 @2xl/queue-card:shrink-0">
      {isFirst ? (
        <Button onClick={onStartReading} size="sm">
          <UiIcon name="book" size={15} />
          {tQueue("startReading")}
        </Button>
      ) : null}
      {priority === null ? null : (
        <QueuePriorityChip label={t(`${priority}.label`)} priority={priority} />
      )}
      {showReason ? (
        <QueueReason icon={QUEUE_PRIORITY_REASON_ICONS[reason]} label={reasonLabel} />
      ) : null}
      {showDate ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <UiIcon className="shrink-0 text-icon" name="calendar" size={12} />
          {formatDate(targetDate, locale)}
        </span>
      ) : null}
      {pagesText === undefined ? null : (
        <span className="mt-auto text-xs text-muted-foreground tabular-nums">{pagesText}</span>
      )}
    </div>
  );
}

function QueueRail({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 flex shrink-0 flex-col items-end self-stretch">{children}</div>
  );
}

function QueueReason({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <Tooltip delayDuration={TOOLTIP_DELAY_MS}>
      <TooltipTrigger
        aria-label={label}
        className="flex max-w-full min-w-0 cursor-default items-center gap-1 text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Icon aria-hidden className="shrink-0" size={12} strokeWidth={1.8} />
        <span className="min-w-0 truncate">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function QueueStatuses({
  book,
  ownership,
}: {
  book: LibraryBook;
  ownership: ReadingQueueCard["ownership"];
}) {
  const t = useTranslations("readingQueue.item");

  return (
    <div className="flex shrink-0 flex-col gap-1 max-sm:flex-row max-sm:flex-wrap max-sm:items-center @2xl/queue-card:w-40">
      <StatusBadge className={statusBadgeCompactClass} entry={book.status} />
      {book.readingStatus === "reading" ? (
        <Badge className="max-sm:h-5 max-sm:px-1.5 max-sm:text-[0.625rem]" variant="info">
          {t("readingNow")}
        </Badge>
      ) : null}
      <StatusBadge className={statusBadgeCompactClass} entry={ownership} />
    </div>
  );
}
