"use client";

import type { SeriesNextBook, SeriesOverviewView, SeriesView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";

import { seriesProgress } from "../model/series-derive";
import { SeriesOverviewError } from "./series-overview-error";

type SeriesSidebarProps = {
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  overview: SeriesOverviewView | undefined;
};

export function SeriesSidebar({ isError, isLoading, onRetry, overview }: SeriesSidebarProps) {
  const t = useTranslations("series.sidebar");
  const topUnfinished = overview?.topUnfinished ?? [];
  const continueSeries = topUnfinished[0];
  const statusCounts = overview?.statusCounts;

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

          <SidebarBlock title={t("closestTitle")}>
            {isLoading ? (
              <RowSkeleton rows={3} />
            ) : topUnfinished.length === 0 ? (
              <EmptyText>{t("closestEmpty")}</EmptyText>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {topUnfinished.slice(0, 3).map((series) => (
                  <ClosestRow key={series.id} series={series} />
                ))}
              </ul>
            )}
          </SidebarBlock>

          <SidebarBlock title={t("statusTitle")}>
            {isLoading || statusCounts === undefined ? (
              <RowSkeleton rows={3} />
            ) : (
              <dl className="flex flex-col gap-2">
                <StatusRow label={t("statusCompleted")} value={statusCounts.completed} />
                <StatusRow label={t("statusOngoing")} value={statusCounts.ongoing} />
                <StatusRow label={t("statusUnknown")} value={statusCounts.unknown} />
              </dl>
            )}
          </SidebarBlock>
        </>
      )}
    </aside>
  );
}

function ClosestRow({ series }: { series: SeriesView }) {
  const t = useTranslations("series.sidebar");
  const progress = seriesProgress(series);

  return (
    <li>
      <Link
        className="group/closest flex flex-col gap-0.5 rounded-md px-2 py-1.5 no-underline transition-colors hover:bg-secondary"
        href={`/series/${series.id}`}
      >
        <span className="truncate text-sm font-medium text-ink transition-colors group-hover/closest:text-primary">
          {series.name}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("progress", {
            finished: progress.finished,
            percent: progress.percent,
            total: progress.denominator,
          })}
        </span>
      </Link>
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

function SidebarBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="sidebar-card-leaf flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="font-heading text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function StatusRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
