"use client";

import type {
  Nullable,
  ReadingStatisticsComparison,
  ReadingStatisticsDynamicsSection,
  ReadingStatisticsInsight,
  ReadingStatisticsPeriod,
} from "@app/shared";
import type { ReactNode } from "react";

import { TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { formatNumber } from "@/lib/format";

import type { DynamicsMetric } from "../../model/statistics-dynamics";
import type { ComparisonNoticeTone } from "./reading-comparison-notice";

import {
  canCompareDynamicsMetric,
  DYNAMICS_METRICS,
  dynamicsPoints,
} from "../../model/statistics-dynamics";
import { formatDayRange } from "../../model/statistics-format";
import { ReadingBucketDetails } from "../details/reading-bucket-details";
import { StatisticsMetricTabs, StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";
import { ReadingComparisonNotice } from "./reading-comparison-notice";
import {
  type DynamicsChartHandle,
  type DynamicsChartVariant,
  type DynamicsLegendRanges,
  ReadingDynamicsChart,
} from "./reading-dynamics-chart";

const PEAK_SUMMARY = {
  compact: {
    icon: "mt-1 size-4 shrink-0 text-icon",
    row: "flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed text-foreground",
    value: (chunks: ReactNode) => (
      <strong className="font-semibold text-ink tabular-nums">{chunks}</strong>
    ),
  },
  full: {
    icon: "size-3.5 shrink-0 text-primary",
    row: "inline-flex w-fit max-w-full items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs text-foreground",
    value: (chunks: ReactNode) => (
      <strong className="font-semibold text-ink tabular-nums">{chunks}</strong>
    ),
  },
} as const satisfies Record<
  DynamicsChartVariant,
  { icon: string; row: string; value: (chunks: ReactNode) => ReactNode }
>;

const COMPARISON_TONE = {
  down: "negative",
  same: "same",
  up: "positive",
} as const satisfies Record<ComparisonDirection, ComparisonNoticeTone>;

type ComparisonDirection = "down" | "same" | "up";

type ComparisonResult = Extract<
  ReadingStatisticsInsight,
  { code: "completed_reads_vs_comparison" | "pages_read_vs_comparison" }
>["params"];

export function ReadingDynamicsCard({
  comparison,
  comparisonResult,
  dynamics,
  isComparisonLowerBound,
  metric,
  onMetricChange,
  period,
  variant,
}: {
  comparison: Nullable<ReadingStatisticsComparison>;
  comparisonResult?: ComparisonResult;
  dynamics: ReadingStatisticsDynamicsSection;
  isComparisonLowerBound: boolean;
  metric: DynamicsMetric;
  onMetricChange: (metric: DynamicsMetric) => void;
  period: ReadingStatisticsPeriod;
  variant: DynamicsChartVariant;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.dynamics");
  const chart = useRef<DynamicsChartHandle>(null);
  const [openKey, setOpenKey] = useState<Nullable<string>>(null);

  const points = dynamicsPoints({
    buckets: dynamics.buckets,
    comparisonBuckets: dynamics.comparisonBuckets,
    granularity: period.granularity,
    isComparisonLowerBound,
    locale,
    metric,
  });
  const openPoint = points.find((point) => point.key === openKey) ?? null;
  const isComparisonHidden =
    dynamics.comparisonBuckets !== null &&
    !canCompareDynamicsMetric({ isComparisonLowerBound, metric });
  const peak = metric === "pages" ? dynamics.peakPagesRead : dynamics.peakCompletedReads;
  const peakRange =
    peak === null ? null : formatDayRange({ from: peak.start, locale, to: peak.end });
  const peakStyle = PEAK_SUMMARY[variant];
  const peakSummary =
    peak === null || peakRange === null
      ? null
      : metric === "pages"
        ? t.rich("peakPages", {
            pages: peak.pagesRead,
            range: peakRange,
            value: peakStyle.value,
          })
        : t.rich("peakReads", {
            range: peakRange,
            reads: peak.completedReads,
            value: peakStyle.value,
          });

  return (
    <StatisticsSection
      action={
        <StatisticsMetricTabs
          label={t("metricLabel")}
          metrics={DYNAMICS_METRICS}
          onChange={onMetricChange}
          optionLabel={(value) => t(`metrics.${value}`)}
          value={metric}
        />
      }
      description={
        metric === "pages" ? t("descriptions.pages") : t(`descriptions.reads.${period.granularity}`)
      }
      note={
        variant === "full" && !isComparisonHidden && comparisonResult !== undefined ? (
          <DynamicsComparisonResult metric={metric} result={comparisonResult} />
        ) : null
      }
      title={t("title")}
    >
      {isComparisonHidden ? (
        <ReadingComparisonNotice
          description={t("comparisonUnavailable.description")}
          title={t("comparisonUnavailable.title")}
          tone="unavailable"
        />
      ) : null}
      {peakSummary === null ? null : (
        <p className={peakStyle.row}>
          <TrendingUp aria-hidden className={peakStyle.icon} />
          <span>{peakSummary}</span>
        </p>
      )}
      {points.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <>
          <ReadingDynamicsChart
            legend={dynamicsLegend({ comparison, locale, period })}
            metric={metric}
            onOpenBucket={setOpenKey}
            openKey={openPoint?.key ?? null}
            points={points}
            ref={chart}
            variant={variant}
          />
          {openPoint === null ? null : (
            <ReadingBucketDetails
              bucket={openPoint.bucket}
              comparisonBucket={openPoint.comparisonBucket}
              key={`${openPoint.key}-${metric}`}
              metric={metric}
              onClose={() => {
                setOpenKey(null);
                chart.current?.focusBucket(openPoint.key);
              }}
            />
          )}
        </>
      )}
    </StatisticsSection>
  );
}

function comparisonDirectionOf(absoluteDelta: number): ComparisonDirection {
  if (absoluteDelta > 0) return "up";
  if (absoluteDelta < 0) return "down";
  return "same";
}

function DynamicsComparisonResult({
  metric,
  result,
}: {
  metric: DynamicsMetric;
  result: ComparisonResult;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.dynamics.comparisonResult");
  const direction = comparisonDirectionOf(result.absoluteDelta);

  return (
    <ReadingComparisonNotice
      description={t("values", {
        comparison: formatNumber(result.comparisonValue, locale),
        current: formatNumber(result.currentValue, locale),
      })}
      title={t(metric, { delta: Math.abs(result.absoluteDelta), direction })}
      tone={COMPARISON_TONE[direction]}
    />
  );
}

function dynamicsLegend({
  comparison,
  locale,
  period,
}: {
  comparison: Nullable<ReadingStatisticsComparison>;
  locale: string;
  period: ReadingStatisticsPeriod;
}): DynamicsLegendRanges {
  return {
    comparison:
      comparison === null
        ? null
        : formatDayRange({ from: comparison.from, locale, to: comparison.to }),
    current: formatDayRange({ from: period.from, locale, to: period.to }),
  };
}
