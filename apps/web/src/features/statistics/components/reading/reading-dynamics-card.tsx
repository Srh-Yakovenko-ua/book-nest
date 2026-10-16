"use client";

import type { ReadingStatisticsDynamicsSection, ReadingStatisticsPeriod } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { DynamicsMetric } from "../../model/statistics-dynamics";

import {
  canCompareDynamicsMetric,
  DYNAMICS_METRICS,
  dynamicsPoints,
} from "../../model/statistics-dynamics";
import { formatDayRange } from "../../model/statistics-format";
import { StatisticsMetricTabs, StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";
import { ReadingDynamicsChart } from "./reading-dynamics-chart";

export function ReadingDynamicsCard({
  dynamics,
  isComparisonLowerBound,
  period,
}: {
  dynamics: ReadingStatisticsDynamicsSection;
  isComparisonLowerBound: boolean;
  period: ReadingStatisticsPeriod;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.dynamics");
  const [metric, setMetric] = useState<DynamicsMetric>("reads");

  const points = dynamicsPoints({
    buckets: dynamics.buckets,
    comparisonBuckets: dynamics.comparisonBuckets,
    granularity: period.granularity,
    isComparisonLowerBound,
    locale,
    metric,
  });
  const isComparisonHidden =
    dynamics.comparisonBuckets !== null &&
    !canCompareDynamicsMetric({ isComparisonLowerBound, metric });
  const peak = metric === "pages" ? dynamics.peakPagesRead : dynamics.peakCompletedReads;
  const peakRange =
    peak === null ? null : formatDayRange({ from: peak.start, locale, to: peak.end });

  return (
    <StatisticsSection
      action={
        <StatisticsMetricTabs
          label={t("metricLabel")}
          metrics={DYNAMICS_METRICS}
          onChange={setMetric}
          optionLabel={(value) => t(`metrics.${value}`)}
          value={metric}
        />
      }
      description={t(`subtitles.${period.granularity}`)}
      note={
        <>
          {peak === null || peakRange === null ? null : (
            <p className="text-xs text-muted-foreground">
              {metric === "pages"
                ? t("peakPages", { pages: peak.pagesRead, range: peakRange })
                : t("peakReads", { range: peakRange, reads: peak.completedReads })}
            </p>
          )}
          {isComparisonHidden ? (
            <p className="text-xs text-muted-foreground">{t("comparisonLowerBound")}</p>
          ) : null}
        </>
      }
      title={t("title")}
    >
      {points.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <ReadingDynamicsChart metric={metric} points={points} />
      )}
    </StatisticsSection>
  );
}
