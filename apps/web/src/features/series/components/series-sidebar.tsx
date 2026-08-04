"use client";

import type { SeriesNextBook, SeriesOverviewView, SeriesView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon, type UiIconName } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { SeriesAttentionFilter, SeriesAttentionReason } from "../model/series-derive";

import { SERIES_ATTENTION_REASONS, seriesProgress } from "../model/series-derive";
import { SeriesOverviewError } from "./series-overview-error";

type SeriesSidebarProps = {
  activeAttention: null | SeriesAttentionFilter;
  almostReadSeries: SeriesView[];
  attentionCounts: Record<SeriesAttentionReason, number>;
  attentionLoading: boolean;
  isError: boolean;
  isLoading: boolean;
  onAttentionSelect: (filter: SeriesAttentionFilter) => void;
  onRetry: () => void;
  overview: SeriesOverviewView | undefined;
};

export function SeriesSidebar({
  activeAttention,
  almostReadSeries,
  attentionCounts,
  attentionLoading,
  isError,
  isLoading,
  onAttentionSelect,
  onRetry,
  overview,
}: SeriesSidebarProps) {
  const t = useTranslations("series.sidebar");
  const topUnfinished = overview?.topUnfinished ?? [];
  const continueSeries = topUnfinished[0];

  return (
    <aside
      aria-label={t("label")}
      className="flex flex-col gap-4 xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      {isError ? (
        <SeriesOverviewError onRetry={onRetry} />
      ) : (
        <>
          <SidebarBlock title={t("continueTitle")}>
            {isLoading ? (
              <RowSkeleton rows={1} />
            ) : continueSeries === undefined ? (
              <EmptyText>{t("continueEmpty")}</EmptyText>
            ) : (
              <ContinueBlock series={continueSeries} />
            )}
          </SidebarBlock>

          <SidebarBlock subtitle={t("closestSubtitle")} title={t("closestTitle")}>
            {isLoading ? (
              <RowSkeleton rows={3} />
            ) : almostReadSeries.length === 0 ? (
              <EmptyText>{t("closestEmpty")}</EmptyText>
            ) : (
              <ul className="flex flex-col gap-4">
                {almostReadSeries.map((series) => (
                  <AlmostReadRow key={series.id} series={series} />
                ))}
              </ul>
            )}
          </SidebarBlock>
        </>
      )}

      <AttentionBlock
        activeAttention={activeAttention}
        counts={attentionCounts}
        isLoading={attentionLoading}
        onSelect={onAttentionSelect}
      />
    </aside>
  );
}

const ATTENTION_ROW_META: Record<SeriesAttentionReason, { icon: UiIconName; toneClass: string }> = {
  empty: { icon: "book-x", toneClass: "text-destructive" },
  incomplete_data: { icon: "file-warning", toneClass: "text-muted-foreground" },
  incomplete_set: { icon: "book-copy", toneClass: "text-info" },
  unknown_status: { icon: "help-circle", toneClass: "text-warning" },
};

function AlmostReadRow({ series }: { series: SeriesView }) {
  const t = useTranslations("series.sidebar");
  const progress = seriesProgress(series);
  const nextBook = series.nextBook;
  const left = progress.denominator - progress.finished;

  return (
    <li className="flex flex-col gap-1.5">
      <Link
        className="cursor-pointer truncate font-heading text-sm leading-snug font-medium text-ink no-underline transition-colors outline-none hover:text-primary focus-visible:text-primary focus-visible:underline"
        href={`/series/${series.id}`}
      >
        {series.name}
      </Link>
      <p className="text-xs text-muted-foreground tabular-nums">
        {t("progressReading", { finished: progress.finished, left, total: progress.denominator })}
      </p>
      <div className="flex items-center gap-2">
        <Progress
          aria-label={t("progressBarLabel", { name: series.name, percent: progress.percent })}
          aria-valuenow={progress.percent}
          className="h-1.5 flex-1"
          value={progress.percent}
        />
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {progress.percent}%
        </span>
      </div>
      {nextBook === null ? null : (
        <Link
          className="group/next flex cursor-pointer items-center justify-between gap-2 rounded-md text-primary no-underline transition-colors outline-none hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50"
          href={`/books/${nextBook.id}`}
        >
          <span className="truncate text-xs group-hover/next:underline">
            {t("nextShort", { title: nextBook.title })}
          </span>
          <UiIcon
            aria-hidden
            className="shrink-0 transition-transform group-hover/next:translate-x-0.5 group-focus-visible/next:translate-x-0.5"
            name="arrow-right"
            size={14}
          />
        </Link>
      )}
    </li>
  );
}

function AttentionBlock({
  activeAttention,
  counts,
  isLoading,
  onSelect,
}: {
  activeAttention: null | SeriesAttentionFilter;
  counts: Record<SeriesAttentionReason, number>;
  isLoading: boolean;
  onSelect: (filter: SeriesAttentionFilter) => void;
}) {
  const t = useTranslations("series.attention");
  const visible = SERIES_ATTENTION_REASONS.filter((reason) => counts[reason] > 0);

  return (
    <SidebarBlock icon="alert-triangle" iconClassName="text-warning" title={t("title")}>
      {isLoading ? (
        <RowSkeleton rows={2} />
      ) : visible.length === 0 ? (
        <div className="flex items-center gap-2">
          <UiIcon aria-hidden className="shrink-0 text-success" name="check-circle" size={16} />
          <span className="text-xs text-muted-foreground">{t("allClear")}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <ul className="-mx-1.5 flex flex-col gap-0.5">
            {visible.map((reason) => (
              <AttentionRow
                active={activeAttention === reason}
                count={counts[reason]}
                key={reason}
                onSelect={onSelect}
                reason={reason}
              />
            ))}
          </ul>
          <button
            aria-pressed={activeAttention === "any"}
            className={cn(
              "group/viewall -mx-1.5 flex cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs font-medium text-primary transition-colors outline-none hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50",
              activeAttention === "any" && "text-primary-hover",
            )}
            onClick={() => onSelect("any")}
            type="button"
          >
            <span className="group-hover/viewall:underline">{t("viewAll")}</span>
            <UiIcon
              aria-hidden
              className="shrink-0 transition-transform group-hover/viewall:translate-x-0.5 group-focus-visible/viewall:translate-x-0.5"
              name="arrow-right"
              size={16}
            />
          </button>
        </div>
      )}
    </SidebarBlock>
  );
}

function AttentionRow({
  active,
  count,
  onSelect,
  reason,
}: {
  active: boolean;
  count: number;
  onSelect: (filter: SeriesAttentionFilter) => void;
  reason: SeriesAttentionReason;
}) {
  const t = useTranslations("series.attention");
  const meta = ATTENTION_ROW_META[reason];

  return (
    <li>
      <button
        aria-pressed={active}
        className={cn(
          "group/attention flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50",
          active && "bg-secondary",
        )}
        onClick={() => onSelect(reason)}
        type="button"
      >
        <UiIcon aria-hidden className={cn("shrink-0", meta.toneClass)} name={meta.icon} size={16} />
        <span className="min-w-0 flex-1 truncate text-xs text-ink">{t(reason, { count })}</span>
        <UiIcon
          aria-hidden
          className="shrink-0 text-muted-foreground transition-transform group-hover/attention:translate-x-0.5 group-focus-visible/attention:translate-x-0.5"
          name="chevron-right"
          size={16}
        />
      </button>
    </li>
  );
}

function ContinueBlock({ series }: { series: SeriesView }) {
  const t = useTranslations("series.sidebar");
  const progress = seriesProgress(series);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Link
          className="cursor-pointer font-heading text-sm leading-snug font-medium text-ink no-underline transition-colors outline-none hover:text-primary focus-visible:text-primary focus-visible:underline"
          href={`/series/${series.id}`}
        >
          {series.name}
        </Link>
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("progressReading", {
            finished: progress.finished,
            left: progress.denominator - progress.finished,
            total: progress.denominator,
          })}
        </p>
      </div>
      {series.nextBook === null ? null : <NextBookRow nextBook={series.nextBook} />}
    </div>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function NextBookRow({ nextBook }: { nextBook: SeriesNextBook }) {
  const t = useTranslations("series.sidebar");
  const cover = nextBook.cover;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t("nextBookHeading")}</p>
      <Link
        className="group/next -mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-md p-1.5 no-underline transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
        href={`/books/${nextBook.id}`}
      >
        {cover === null || cover === undefined ? (
          <div
            aria-hidden
            className="grid aspect-[2/3] w-14 shrink-0 place-items-center rounded-md border border-border bg-accent text-accent-foreground/50"
          >
            <UiIcon name="book" size={18} />
          </div>
        ) : (
          <Image
            alt={t("nextCoverAlt", { title: nextBook.title })}
            className="aspect-[2/3] w-14 shrink-0 rounded-md border border-border object-cover"
            height={84}
            src={cover.urls.thumb}
            unoptimized
            width={56}
          />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-ink transition-colors group-hover/next:text-primary">
            {nextBook.title}
          </span>
          {nextBook.partNumber === null ? null : (
            <span className="text-xs text-muted-foreground">
              {t("nextBookPart", { number: nextBook.partNumber })}
            </span>
          )}
        </span>
      </Link>
    </div>
  );
}

function RowSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <div className="flex flex-col gap-1 px-2" key={index}>
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function SidebarBlock({
  children,
  icon,
  iconClassName,
  subtitle,
  title,
}: {
  children: ReactNode;
  icon?: UiIconName;
  iconClassName?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className="sidebar-card-leaf flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-col gap-0.5">
        <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-ink">
          {icon === undefined ? null : (
            <UiIcon aria-hidden className={cn("shrink-0", iconClassName)} name={icon} size={16} />
          )}
          {title}
        </h2>
        {subtitle === undefined ? null : (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}
