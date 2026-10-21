"use client";

import type {
  Nullable,
  ReadingStatisticsComparison,
  ReadingStatisticsDynamicsSection,
  ReadingStatisticsPeriod,
} from "@app/shared";
import type { ReactNode } from "react";

import { TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { DynamicsMetric } from "../../model/statistics-dynamics";

import {
  canCompareDynamicsMetric,
  DYNAMICS_METRICS,
  dynamicsPoints,
} from "../../model/statistics-dynamics";
import { formatDayRange } from "../../model/statistics-format";
import { ReadingBucketDetails } from "../details/reading-bucket-details";
import { StatisticsMetricTabs, StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";
import {
  type DynamicsChartHandle,
  type DynamicsChartVariant,
  type DynamicsLegendRanges,
  ReadingDynamicsChart,
} from "./reading-dynamics-chart";

const PEAK_SUMMARY = {
  icon: "mt-1 size-4 shrink-0 text-icon",
  row: "flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed text-foreground",
  value: {
    compact: (chunks: ReactNode) => (
      <strong className="font-semibold text-ink tabular-nums">{chunks}</strong>
    ),
    full: (chunks: ReactNode) => chunks,
  },
} as const satisfies {
  icon: string;
  row: string;
  value: Record<DynamicsChartVariant, (chunks: ReactNode) => ReactNode>;
};

export function ReadingDynamicsCard({
  comparison,
  dynamics,
  insight,
  isComparisonLowerBound,
  metric,
  onMetricChange,
  period,
  variant,
}: {
  comparison: Nullable<ReadingStatisticsComparison>;
  dynamics: ReadingStatisticsDynamicsSection;
  insight?: ReactNode;
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
  const peakSummary =
    peak === null || peakRange === null
      ? null
      : metric === "pages"
        ? t.rich("peakPages", {
            pages: peak.pagesRead,
            range: peakRange,
            value: PEAK_SUMMARY.value[variant],
          })
        : t.rich("peakReads", {
            range: peakRange,
            reads: peak.completedReads,
            value: PEAK_SUMMARY.value[variant],
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
      description={t(`subtitles.${period.granularity}`)}
      note={
        <>
          {variant === "full" && peakSummary !== null ? (
            <p className="text-xs text-muted-foreground">{peakSummary}</p>
          ) : null}
          {isComparisonHidden ? (
            <p className="text-xs text-muted-foreground">{t("comparisonLowerBound")}</p>
          ) : null}
          {variant === "full" ? insight : null}
        </>
      }
      title={t("title")}
    >
      {variant === "compact" && peakSummary !== null ? (
        <p className={PEAK_SUMMARY.row}>
          <TrendingUp aria-hidden className={PEAK_SUMMARY.icon} />
          <span>{peakSummary}</span>
        </p>
      ) : null}
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
