"use client";

import type {
  Nullable,
  ReadingStatisticsActivityContribution,
  ReadingStatisticsBucket,
  ReadingStatisticsDateRange,
  ReadingStatisticsDrilldown,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

import type { DynamicsMetric } from "../../model/statistics-dynamics";

import {
  useCompletedReadsInterval,
  useReadingActivityInterval,
} from "../../api/use-reading-interval-details";
import { useAppendedPageFocus } from "../../hooks/use-appended-page-focus";
import { buildStatisticsDrilldownTarget } from "../../model/statistics-drilldown";
import { formatDayLong, formatDayRange } from "../../model/statistics-format";
import { StatisticsMetricTabs } from "../statistics-section";
import { StatisticsStat } from "../statistics-stat";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { CompletedReadsList } from "./completed-reads-list";
import { DetailsError, DetailsLoading, LoadMore } from "./details-states";
import { StatisticsBookCover } from "./statistics-book-cover";

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

function CompletedReadsOfBucket({ drilldown }: { drilldown: ReadingStatisticsDrilldown }) {
  const t = useTranslations("statistics.details.bucket");
  const target = buildStatisticsDrilldownTarget(drilldown);

  if (target.kind !== "completed_reads_interval") {
    return <StatisticsSectionState kind="unavailable" title={t("unsupported")} />;
  }

  return <CompletedReadsOfInterval range={{ from: target.from, to: target.to }} />;
}

function CompletedReadsOfInterval({ range }: { range: ReadingStatisticsDateRange }) {
  const t = useTranslations("statistics.details.bucket");
  const query = useCompletedReadsInterval(range);

  if (query.isPending) return <DetailsLoading label={t("loading")} />;
  if (query.isError) {
    return <DetailsError onRetry={() => void query.refetch()} title={t("error")} />;
  }

  return (
    <CompletedReadsList
      emptyTitle={t("readsEmpty")}
      hasMore={query.hasNextPage}
      isLoadingMore={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      pages={query.data.pages}
    />
  );
}

function groupByDate(items: readonly ReadingStatisticsActivityContribution[]): DayContributions[] {
  const dates = [...new Set(items.map((item) => item.date))];
  return dates.map((date) => ({ date, items: items.filter((item) => item.date === date) }));
}

function ReadingActivityOfBucket({ range }: { range: ReadingStatisticsDateRange }) {
  const locale = useLocale();
  const t = useTranslations("statistics.details.bucket");
  const tDay = useTranslations("statistics.details.day");
  const tKpi = useTranslations("statistics.kpi");
  const query = useReadingActivityInterval(range);
  const { focusRefFor, loadMore } = useAppendedPageFocus({
    onLoadMore: () => void query.fetchNextPage(),
    pages: query.data?.pages ?? [],
  });

  if (query.isPending) return <DetailsLoading label={t("loading")} />;
  if (query.isError) {
    return <DetailsError onRetry={() => void query.refetch()} title={t("error")} />;
  }

  const [summary] = query.data.pages;
  if (summary === undefined) {
    return <DetailsError onRetry={() => void query.refetch()} title={t("error")} />;
  }

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
                  <li
                    className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    key={item.book.bookId}
                    ref={focusRefFor(item)}
                    tabIndex={-1}
                  >
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
        onLoadMore={loadMore}
      />
    </div>
  );
}
