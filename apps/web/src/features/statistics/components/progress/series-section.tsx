"use client";

import type {
  Nullable,
  ReadingStatisticsContextAction,
  ReadingStatisticsSeriesSection,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { toContextActionLink, toContextActionLinks } from "../../model/statistics-drilldown";
import { formatDayShort, formatShare } from "../../model/statistics-format";
import { StatisticsMetricTabs } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";
import { ProgressCard, progressFigure } from "./progress-card";
import { SeriesLifecycle } from "./series-lifecycle";
import { SeriesRankingList } from "./series-ranking-list";

const SERIES_RANKING_MODES = ["mostActive", "topProgress"] as const;

type SeriesRankingMode = (typeof SERIES_RANKING_MODES)[number];

export function SeriesSection({ series }: { series: ReadingStatisticsSeriesSection }) {
  const t = useTranslations("statistics.series");

  if (series.availability === "unavailable") {
    return (
      <ProgressCard
        description={t("description")}
        icon="book-copy"
        illustration="series"
        title={t("title")}
      >
        <StatisticsSectionState kind="unavailable" title={t("unavailable")} />
      </ProgressCard>
    );
  }

  if (series.completedReadsCount === 0) {
    return (
      <ProgressCard
        description={t("description")}
        icon="book-copy"
        illustration="series"
        title={t("title")}
      >
        <StatisticsSectionState
          description={t("noReadsDescription")}
          kind="empty"
          title={t("noReadsTitle")}
        />
      </ProgressCard>
    );
  }

  return <SeriesActivity series={series} />;
}

function MostActiveRanking({ series }: { series: ReadingStatisticsSeriesSection }) {
  const t = useTranslations("statistics.series");

  if (series.mostActive.length === 0) {
    return <StatisticsSectionState density="compact" kind="empty" title={t("empty")} />;
  }

  return (
    <SeriesRankingList
      label={t("mostActiveTitle")}
      rows={series.mostActive.map((entry) => ({
        href: openSeriesHref(entry.contextActions),
        key: entry.seriesId,
        name: entry.name,
        value: entry.completedReadCycles,
        valueLabel: t("reads", { count: entry.completedReadCycles }),
      }))}
    />
  );
}

function openSeriesHref(actions: readonly ReadingStatisticsContextAction[]): Nullable<string> {
  return toContextActionLinks(actions).find((link) => link.kind === "open_series")?.href ?? null;
}

function SeriesActivity({ series }: { series: ReadingStatisticsSeriesSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.series");
  const [mode, setMode] = useState<SeriesRankingMode>("mostActive");
  const marathon = series.marathon.availability === "unavailable" ? null : series.marathon.data;

  return (
    <ProgressCard
      description={t("description")}
      icon="book-copy"
      illustration="series"
      lead={<SeriesShare series={series} />}
      title={t("title")}
    >
      <SeriesLifecycle lifecycle={series.lifecycle} />

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StatisticsMetricTabs
            className="max-w-full *:px-2 *:text-xs @xs:*:px-4 @xs:*:text-sm"
            label={t("rankingModeLabel")}
            metrics={SERIES_RANKING_MODES}
            onChange={setMode}
            optionLabel={(rankingMode) => t(`rankingModes.${rankingMode}`)}
            value={mode}
          />
          <p className="min-w-0 basis-48 text-xs text-muted-foreground">
            {mode === "mostActive" ? t("mostActiveCaption") : t("topProgressCaption")}
          </p>
        </div>
        {mode === "mostActive" ? (
          <MostActiveRanking series={series} />
        ) : (
          <TopProgressRanking series={series} />
        )}
      </div>

      {marathon === null ? null : (
        <div className="flex items-center gap-2.5 rounded-lg bg-secondary/50 px-3 py-2">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <UiIcon name="book-copy" size={15} />
          </span>
          <p className="min-w-0 text-sm text-foreground">
            {t("marathon", {
              date: formatDayShort(marathon.endFinishedAt, locale),
              length: marathon.length,
              name: marathon.name,
            })}
          </p>
        </div>
      )}
    </ProgressCard>
  );
}

function SeriesShare({ series }: { series: ReadingStatisticsSeriesSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.series");
  const share = series.seriesShare;

  if (share === null) {
    return <p className="text-sm text-muted-foreground">{t("shareUnknown")}</p>;
  }

  const percent = formatShare(share, locale);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-base font-medium text-foreground">
          {t.rich("shareCount", {
            num: progressFigure,
            series: series.seriesCompletedReadsCount,
            total: series.completedReadsCount,
          })}
        </p>
        <Badge
          className="h-auto min-h-6 shrink-0 px-2.5 text-sm font-semibold text-accent-foreground tabular-nums"
          variant="primary"
        >
          {percent}%
        </Badge>
      </div>
      <Progress
        aria-label={t("shareProgressLabel", { percent })}
        className="h-2"
        value={share * 100}
      />
    </div>
  );
}

function TopProgressRanking({ series }: { series: ReadingStatisticsSeriesSection }) {
  const t = useTranslations("statistics.series");

  if (series.topProgress.length === 0) {
    return <StatisticsSectionState density="compact" kind="empty" title={t("topProgressEmpty")} />;
  }

  return (
    <SeriesRankingList
      label={t("topProgressTitle")}
      rows={series.topProgress.map((entry) => ({
        href: toContextActionLink({ kind: "open_series", seriesId: entry.seriesId }).href,
        key: entry.seriesId,
        name: entry.name,
        value: entry.distinctFirstCompletions,
        valueLabel: t("firstCompletions", { count: entry.distinctFirstCompletions }),
      }))}
    />
  );
}
