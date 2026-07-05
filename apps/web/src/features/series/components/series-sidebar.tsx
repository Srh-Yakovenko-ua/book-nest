"use client";

import type { SeriesOverviewView, SeriesView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";

import { seriesProgress } from "../model/series-derive";
import { SeriesOverviewError } from "./series-overview-error";

type SeriesSidebarProps = {
  isError: boolean;
  isLoading: boolean;
  onCreateSeries: () => void;
  onGoToUnfinished: () => void;
  onRetry: () => void;
  overview: SeriesOverviewView | undefined;
};

export function SeriesSidebar({
  isError,
  isLoading,
  onCreateSeries,
  onGoToUnfinished,
  onRetry,
  overview,
}: SeriesSidebarProps) {
  const t = useTranslations("series.sidebar");
  const topUnfinished = overview?.topUnfinished ?? [];
  const continueSeries = topUnfinished[0];
  const statusCounts = overview?.statusCounts;

  return (
    <aside
      aria-label={t("quickActions")}
      className="flex flex-col gap-4 xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <SidebarBlock title={t("quickActions")}>
        <div className="flex flex-col gap-2">
          <Button className="justify-start" onClick={onCreateSeries} variant="secondary">
            <UiIcon name="plus" size={16} />
            {t("createSeries")}
          </Button>
          <Button asChild className="justify-start" variant="secondary">
            <Link href="/books/new">
              <UiIcon name="book" size={16} />
              {t("addBook")}
            </Link>
          </Button>
          <Button className="justify-start" onClick={onGoToUnfinished} variant="ghost">
            <UiIcon name="target" size={16} />
            {t("goToUnfinished")}
          </Button>
        </div>
      </SidebarBlock>

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
    <div className="flex flex-col gap-2.5">
      <p className="font-heading text-sm leading-snug font-medium text-ink">{series.name}</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {t("progress", {
          finished: progress.finished,
          percent: progress.percent,
          total: progress.denominator,
        })}
      </p>
      {series.nextBook === null ? null : (
        <p className="truncate text-xs text-foreground/85">
          {t("next", { title: series.nextBook.title })}
        </p>
      )}
      <Button asChild className="mt-0.5 self-start" size="sm" variant="secondary">
        <Link href={`/series/${series.id}`}>
          {t("openSeries")}
          <UiIcon name="arrow-right" size={14} />
        </Link>
      </Button>
    </div>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
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
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
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
