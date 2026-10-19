"use client";

import type {
  Nullable,
  ReadingStatisticsActivityContribution,
  ReadingStatisticsBucket,
  ReadingStatisticsDateRange,
  ReadingStatisticsDrilldown,
} from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { RatingScore } from "@/components/ui/rating-score";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";

import type { DynamicsMetric } from "../../model/statistics-dynamics";

import {
  useCompletedReadsInterval,
  useReadingActivityInterval,
} from "../../api/use-reading-interval-details";
import { buildStatisticsDrilldownTarget } from "../../model/statistics-drilldown";
import { formatDayLong, formatDayRange, formatDayShort } from "../../model/statistics-format";
import { StatisticsMetricTabs } from "../statistics-section";
import { StatisticsStat } from "../statistics-stat";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { CompletedReadDetails } from "./completed-read-details";
import { StatisticsBookCover } from "./statistics-book-cover";
import { StatisticsDetailSurface } from "./statistics-detail-surface";

const BUCKET_SERIES = ["current", "comparison"] as const;

type BucketSeries = (typeof BUCKET_SERIES)[number];

type DayContributions = { date: string; items: ReadingStatisticsActivityContribution[] };

export function ReadingBucketDetails({
  bucket,
  comparisonBucket,
  metric,
  onClose,
}: {
  bucket: ReadingStatisticsBucket;
  comparisonBucket: Nullable<ReadingStatisticsBucket>;
  metric: DynamicsMetric;
  onClose: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.details.bucket");
  const tDynamics = useTranslations("statistics.dynamics");
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [series, setSeries] = useState<BucketSeries>("current");

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.defaultPrevented || event.key !== "Escape") return;
      onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const interval = series === "comparison" && comparisonBucket !== null ? comparisonBucket : bucket;
  const range = { from: interval.start, to: interval.end };

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-sm font-semibold text-ink outline-none"
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
        >
          {t("title", {
            metric: tDynamics(`metrics.${metric}`),
            range: formatDayRange({ ...range, locale }) ?? range.from,
          })}
        </h3>
        <Button aria-label={t("close")} onClick={onClose} size="icon-sm" variant="ghost">
          <UiIcon name="x" size={16} />
        </Button>
      </div>

      {comparisonBucket === null ? null : (
        <StatisticsMetricTabs
          label={t("seriesLabel")}
          metrics={BUCKET_SERIES}
          onChange={setSeries}
          optionLabel={(value) => tDynamics(value)}
          value={series}
        />
      )}

      {metric === "reads" ? (
        <CompletedReadsOfBucket drilldown={interval.drilldown} key={interval.start} />
      ) : (
        <ReadingActivityOfBucket key={interval.start} range={range} />
      )}
    </section>
  );
}

function CompletedReadsList({ range }: { range: ReadingStatisticsDateRange }) {
  const locale = useLocale();
  const t = useTranslations("statistics.details.bucket");
  const tDay = useTranslations("statistics.details.day");
  const tRead = useTranslations("statistics.details.completedRead");
  const query = useCompletedReadsInterval(range);

  if (query.isPending) return <DetailsLoading />;
  if (query.isError) return <DetailsError onRetry={() => void query.refetch()} />;

  const reads = query.data.pages.flatMap((page) => page.items);
  const totalCount = query.data.pages[0]?.totalCount ?? 0;

  if (reads.length === 0) {
    return <StatisticsSectionState kind="empty" title={t("readsEmpty")} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t("readsTotal", { count: totalCount })}</p>
      <ul className="flex flex-col gap-1">
        {reads.map((read) => (
          <li key={read.readingCycleId}>
            <StatisticsDetailSurface
              detail={() => <CompletedReadDetails read={read} />}
              label={tRead("open", { title: read.book.title })}
              title={read.book.title}
              triggerClassName="flex w-full items-center gap-3 rounded-md p-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <StatisticsBookCover
                className="w-9 shrink-0"
                coverThumbUrl={read.book.coverThumbUrl}
                title={read.book.title}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {read.book.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <time dateTime={read.finishedAt}>{formatDayShort(read.finishedAt, locale)}</time>
                  {read.rating === null ? null : (
                    <RatingScore className="text-xs" value={read.rating} />
                  )}
                </span>
                {read.book.bookState === "soft_deleted" ? (
                  <span className="text-xs text-muted-foreground">{tDay("deletedBook")}</span>
                ) : null}
              </span>
            </StatisticsDetailSurface>
          </li>
        ))}
      </ul>
      <LoadMore
        hasMore={query.hasNextPage}
        isLoading={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />
    </div>
  );
}

function CompletedReadsOfBucket({ drilldown }: { drilldown: ReadingStatisticsDrilldown }) {
  const t = useTranslations("statistics.details.bucket");
  const target = buildStatisticsDrilldownTarget(drilldown);

  if (target.kind !== "completed_reads_interval") {
    return <StatisticsSectionState kind="unavailable" title={t("unsupported")} />;
  }

  return <CompletedReadsList range={{ from: target.from, to: target.to }} />;
}

function DetailsError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("statistics.details.bucket");

  return (
    <StatisticsSectionState
      action={
        <button
          className="cursor-pointer text-xs font-medium text-primary underline"
          onClick={onRetry}
          type="button"
        >
          {t("retry")}
        </button>
      }
      kind="error"
      title={t("error")}
    />
  );
}

function DetailsLoading() {
  const t = useTranslations("statistics.details.bucket");

  return (
    <output aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-2">
      <Skeleton className="h-4 w-32 rounded-md" />
      <Skeleton className="h-12 w-full rounded-md" />
      <Skeleton className="h-12 w-full rounded-md" />
    </output>
  );
}

function groupByDate(items: readonly ReadingStatisticsActivityContribution[]): DayContributions[] {
  const dates = [...new Set(items.map((item) => item.date))];
  return dates.map((date) => ({ date, items: items.filter((item) => item.date === date) }));
}

function LoadMore({
  hasMore,
  isLoading,
  onLoadMore,
}: {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}): ReactNode {
  const t = useTranslations("statistics.details.bucket");

  if (!hasMore) return null;

  return (
    <Button
      className="self-start"
      disabled={isLoading}
      onClick={onLoadMore}
      size="sm"
      variant="secondary"
    >
      {t("loadMore")}
    </Button>
  );
}

function ReadingActivityOfBucket({ range }: { range: ReadingStatisticsDateRange }) {
  const locale = useLocale();
  const t = useTranslations("statistics.details.bucket");
  const tDay = useTranslations("statistics.details.day");
  const tKpi = useTranslations("statistics.kpi");
  const query = useReadingActivityInterval(range);

  if (query.isPending) return <DetailsLoading />;
  if (query.isError) return <DetailsError onRetry={() => void query.refetch()} />;

  const [summary] = query.data.pages;
  if (summary === undefined) return <DetailsError onRetry={() => void query.refetch()} />;

  const isObservedOnly = summary.historyQuality === "legacy_observed_only";
  const observed = (value: number) => {
    const formatted = formatNumber(value, locale);
    return isObservedOnly ? tKpi("lowerBoundValue", { value: formatted }) : formatted;
  };
  const days = groupByDate(query.data.pages.flatMap((page) => page.items));

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-3 gap-2">
        <StatisticsStat label={tDay("pagesLabel")} value={observed(summary.pagesRead)} />
        <StatisticsStat label={t("activeDaysLabel")} value={observed(summary.activeDays)} />
        <StatisticsStat label={tDay("booksLabel")} value={observed(summary.booksCount)} />
      </dl>

      {isObservedOnly ? (
        <StatisticsNote>
          {t("observedOnly", { date: formatDayLong(summary.reliableFrom, locale) })}
        </StatisticsNote>
      ) : null}

      {days.length === 0 ? (
        <StatisticsSectionState
          kind="empty"
          title={isObservedOnly ? t("pagesEmptyObservedOnly") : t("pagesEmpty")}
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {days.map((day) => (
            <li className="flex flex-col gap-1.5" key={day.date}>
              <time className="text-xs font-medium text-muted-foreground" dateTime={day.date}>
                {formatDayLong(day.date, locale)}
              </time>
              <ul className="flex flex-col gap-2">
                {day.items.map((item) => (
                  <li className="flex items-center gap-3" key={item.book.bookId}>
                    <StatisticsBookCover
                      className="w-9 shrink-0"
                      coverThumbUrl={item.book.coverThumbUrl}
                      title={item.book.title}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.book.title}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {tDay("bookPages", { pages: formatNumber(item.pagesRead, locale) })}
                      </span>
                      {item.book.bookState === "soft_deleted" ? (
                        <span className="text-xs text-muted-foreground">{tDay("deletedBook")}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      <LoadMore
        hasMore={query.hasNextPage}
        isLoading={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />
    </div>
  );
}
