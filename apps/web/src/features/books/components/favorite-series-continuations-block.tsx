"use client";

import type { FavoriteSeriesContinuationItem, SeriesContinuationRankReason } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { MobilePageOverviewLink } from "@/components/ui/mobile-page-overview-panel";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ownershipStatuses,
  readingStatuses,
  type StatusDefinition,
  type StatusEntry,
} from "@/lib/book-status";
import { cn } from "@/lib/utils";

import {
  useFavoriteSeriesContinuations,
  useInvalidateFavoriteSeriesContinuations,
} from "../api/use-favorite-series-continuations";
import { useWantToBuy } from "../api/use-ownership";
import { useAddToReadingQueue } from "../api/use-reading-queue";

type ContinuationCta =
  | {
      href: string;
      kind: "navigation";
      labelKey:
        | "actions.continueReading"
        | "actions.openLoan"
        | "actions.openOrder"
        | "actions.openQueue"
        | "actions.openWishlist"
        | "actions.resumeReading";
    }
  | { kind: "add-to-queue" }
  | { kind: "want-to-buy" };

const COLLAPSED_COUNT = 3;

export function FavoriteSeriesContinuationsBlock() {
  const t = useTranslations("favorites.seriesContinuations");
  const query = useFavoriteSeriesContinuations();
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? items.length;
  const visibleItems = expanded ? items : items.slice(0, COLLAPSED_COUNT);
  const canExpand = items.length > COLLAPSED_COUNT;

  return (
    <section className="sidebar-card-leaf flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-primary">
            <UiIcon aria-hidden name="library" size={16} />
          </span>
          <h2 className="font-heading text-[0.9375rem] font-semibold text-ink">{t("title")}</h2>
          {total > COLLAPSED_COUNT ? (
            <span
              aria-label={t("countChip", { count: total })}
              className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums"
            >
              {total}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>

      <FavoriteSeriesContinuationsContent
        isError={query.isError}
        isPending={query.isPending}
        items={visibleItems}
        listId={listId}
        onRetry={() => void query.refetch()}
      />

      {canExpand && !query.isPending && !query.isError ? (
        <Button
          aria-controls={listId}
          aria-expanded={expanded}
          className="w-full justify-center gap-1.5"
          onClick={() => setExpanded((value) => !value)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {expanded ? t("collapse") : t("showAll")}
          <UiIcon name={expanded ? "chevron-up" : "chevron-down"} size={14} />
        </Button>
      ) : null}
    </section>
  );
}

function ContinuationCover({
  cover,
  title,
}: {
  cover: FavoriteSeriesContinuationItem["nextBook"]["cover"];
  title: string;
}) {
  const src = cover?.urls.card;
  const initial = title.trim().charAt(0).toUpperCase();

  return (
    <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-md bg-accent shadow-soft">
      {src === undefined ? (
        <div className="grid h-full w-full place-items-center text-accent-foreground">
          {initial.length === 0 ? (
            <UiIcon name="book" size={18} />
          ) : (
            <span className="font-heading text-lg leading-none font-semibold">{initial}</span>
          )}
        </div>
      ) : (
        <Image alt="" className="object-cover" fill sizes="48px" src={src} unoptimized />
      )}
    </div>
  );
}

function ContinuationRow({
  isRevealable,
  item,
}: {
  isRevealable: boolean;
  item: FavoriteSeriesContinuationItem;
}) {
  const t = useTranslations("favorites.seriesContinuations");
  const tReading = useTranslations("books.readingStatus.options");
  const tOwnership = useTranslations("books.ownershipStatus.options");

  const addToQueue = useAddToReadingQueue();
  const wantToBuy = useWantToBuy();
  const invalidateContinuations = useInvalidateFavoriteSeriesContinuations();

  const { nextBook, progress, rankReason, series } = item;
  const bookHref = `/books/${nextBook.id}`;
  const isReadingReason = rankReason === "reading" || rankReason === "paused";

  const statusEntry = isReadingReason
    ? buildStatusEntry({
        entries: readingStatuses,
        fallback: FALLBACK_READING_STATUS,
        label: tReading(nextBook.readingStatus),
        value: nextBook.readingStatus,
      })
    : buildStatusEntry({
        entries: ownershipStatuses,
        fallback: FALLBACK_OWNERSHIP_STATUS,
        label: tOwnership(nextBook.ownershipStatus),
        value: nextBook.ownershipStatus,
      });

  const seriesPercent =
    progress.totalBooks > 0 ? Math.round((progress.finishedBooks / progress.totalBooks) * 100) : 0;

  const cta = resolveCta(rankReason, nextBook.queue !== null, bookHref);

  const handleAddToQueue = () =>
    addToQueue.mutate(
      { bookId: nextBook.id, placement: "end" },
      { onSuccess: () => invalidateContinuations() },
    );

  const handleWantToBuy = () =>
    wantToBuy.mutate(
      { id: nextBook.id, payload: {} },
      { onSuccess: () => invalidateContinuations() },
    );

  return (
    <li
      className={cn(
        "flex min-w-0 gap-3 py-3.5 first:pt-0 last:pb-0",
        isRevealable &&
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:fill-mode-both motion-safe:slide-in-from-top-1",
      )}
    >
      <MobilePageOverviewLink
        aria-label={t("openBook", { title: nextBook.title })}
        className="shrink-0"
        href={bookHref}
      >
        <ContinuationCover cover={nextBook.cover} title={nextBook.title} />
      </MobilePageOverviewLink>
      <div className="flex min-w-0 flex-col gap-1.5">
        <MobilePageOverviewLink className="group min-w-0" href={bookHref}>
          <span className="line-clamp-2 text-sm font-medium text-ink transition-colors group-hover:text-primary">
            {nextBook.title}
          </span>
        </MobilePageOverviewLink>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          <UiIcon aria-hidden name="layers" size={13} />
          <MobilePageOverviewLink
            aria-label={t("openSeries", { title: series.title })}
            className="min-w-0 font-medium text-foreground hover:text-primary"
            href={`/series/${series.id}`}
          >
            {series.title}
          </MobilePageOverviewLink>
          {nextBook.seriesPosition !== null ? (
            <span className="whitespace-nowrap">
              {`· ${t("bookPosition", { position: nextBook.seriesPosition, total: series.totalBooks })}`}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("seriesProgress", {
              finished: progress.finishedBooks,
              total: progress.totalBooks,
            })}
          </span>
          <Progress className="h-1.5" value={seriesPercent} />
        </div>

        <StatusBadge entry={statusEntry} />

        {cta.kind === "navigation" ? (
          <Button asChild className="self-start" size="sm" variant="secondary">
            <MobilePageOverviewLink href={cta.href}>{t(cta.labelKey)}</MobilePageOverviewLink>
          </Button>
        ) : cta.kind === "add-to-queue" ? (
          <Button
            className="self-start"
            loading={addToQueue.isPending}
            onClick={handleAddToQueue}
            size="sm"
            variant="secondary"
          >
            {t("actions.addToQueue")}
          </Button>
        ) : (
          <Button
            className="self-start"
            loading={wantToBuy.isPending}
            onClick={handleWantToBuy}
            size="sm"
            variant="secondary"
          >
            {t("actions.addToWishlist")}
          </Button>
        )}
      </div>
    </li>
  );
}

function FavoriteSeriesContinuationsContent({
  isError,
  isPending,
  items,
  listId,
  onRetry,
}: {
  isError: boolean;
  isPending: boolean;
  items: FavoriteSeriesContinuationItem[];
  listId: string;
  onRetry: () => void;
}) {
  const t = useTranslations("favorites.seriesContinuations");

  if (isPending) {
    return <FavoriteSeriesContinuationsSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-2" role="status">
        <p className="text-xs text-muted-foreground">{t("error")}</p>
        <Button onClick={onRetry} size="sm" variant="outline">
          <UiIcon name="refresh" size={14} />
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border" id={listId}>
      {items.map((item, index) => (
        <ContinuationRow isRevealable={index >= COLLAPSED_COUNT} item={item} key={item.series.id} />
      ))}
    </ul>
  );
}

function FavoriteSeriesContinuationsSkeleton() {
  return (
    <div aria-busy className="flex flex-col divide-y divide-border">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="flex gap-3 py-3.5 first:pt-0 last:pb-0" key={index}>
          <Skeleton className="aspect-[2/3] w-16 shrink-0 rounded-md" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-7 w-36 rounded-[min(var(--radius-md),12px)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function resolveCta(
  rankReason: SeriesContinuationRankReason,
  isInQueue: boolean,
  bookHref: string,
): ContinuationCta {
  switch (rankReason) {
    case "available":
      return isInQueue
        ? { href: "/reading-queue", kind: "navigation", labelKey: "actions.openQueue" }
        : { kind: "add-to-queue" };
    case "in_transit":
      return { href: "/delivery/in-transit", kind: "navigation", labelKey: "actions.openOrder" };
    case "lent":
      return { href: "/loans", kind: "navigation", labelKey: "actions.openLoan" };
    case "not_owned":
      return { kind: "want-to-buy" };
    case "paused":
      return { href: bookHref, kind: "navigation", labelKey: "actions.resumeReading" };
    case "reading":
      return { href: bookHref, kind: "navigation", labelKey: "actions.continueReading" };
    case "want_to_buy":
      return { href: "/books-to-buy", kind: "navigation", labelKey: "actions.openWishlist" };
    default:
      return assertNever(rankReason);
  }
}

const FALLBACK_READING_STATUS: StatusDefinition =
  readingStatuses.find((entry) => entry.value === "not_started") ?? readingStatuses[0];

const FALLBACK_OWNERSHIP_STATUS: StatusDefinition =
  ownershipStatuses.find((entry) => entry.value === "none") ?? ownershipStatuses[0];

function assertNever(value: never): never {
  throw new Error(`Unhandled continuation rank reason: ${String(value)}`);
}

function buildStatusEntry({
  entries,
  fallback,
  label,
  value,
}: {
  entries: readonly StatusDefinition[];
  fallback: StatusDefinition;
  label: string;
  value: string;
}): StatusEntry {
  const base = entries.find((entry) => entry.value === value) ?? fallback;
  return { ...base, label };
}
