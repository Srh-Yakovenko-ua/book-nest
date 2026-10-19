"use client";

import type { ReadingStatisticsSeriesSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/format";

import { formatDayShort, formatShare } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { StatisticsStat } from "../statistics-stat";
import { StatisticsSectionState } from "../statistics-states";
import { TasteRankingList } from "../tastes/taste-ranking-list";

const LIFECYCLE_KEYS = ["started", "continued", "completed", "caughtUp"] as const;

export function SeriesSection({ series }: { series: ReadingStatisticsSeriesSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.series");

  if (series.availability === "unavailable") {
    return (
      <StatisticsSection description={t("description")} title={t("title")}>
        <StatisticsSectionState kind="unavailable" title={t("unavailable")} />
      </StatisticsSection>
    );
  }

  const marathon = series.marathon.availability === "unavailable" ? null : series.marathon.data;

  return (
    <StatisticsSection description={t("description")} title={t("title")}>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-foreground">
          {series.seriesShare === null
            ? t("shareUnknown")
            : t("share", {
                percent: formatShare(series.seriesShare, locale),
                series: series.seriesCompletedReadsCount,
                total: series.completedReadsCount,
              })}
        </span>
        <Progress aria-hidden className="h-2" value={(series.seriesShare ?? 0) * 100} />
      </div>

      <SeriesLifecycle lifecycle={series.lifecycle} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("mostActiveTitle")}
          </span>
          {series.mostActive.length === 0 ? (
            <StatisticsSectionState kind="empty" title={t("empty")} />
          ) : (
            <TasteRankingList
              rows={series.mostActive.map((entry) => ({
                contextActions: entry.contextActions,
                key: entry.seriesId,
                label: entry.name,
                value: entry.completedReadCycles,
                valueLabel: t("reads", { count: entry.completedReadCycles }),
              }))}
            />
          )}
        </div>

        {series.topProgress.length === 0 ? null : (
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("topProgressTitle")}
            </span>
            <TasteRankingList
              rows={series.topProgress.map((entry) => ({
                key: entry.seriesId,
                label: entry.name,
                value: entry.distinctFirstCompletions,
                valueLabel: t("firstCompletions", { count: entry.distinctFirstCompletions }),
              }))}
            />
          </div>
        )}
      </div>

      {marathon === null ? null : (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <UiIcon name="book-copy" size={16} />
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
    </StatisticsSection>
  );
}

function SeriesLifecycle({
  lifecycle,
}: {
  lifecycle: ReadingStatisticsSeriesSection["lifecycle"];
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.series");
  const data = lifecycle.data;

  if (lifecycle.availability === "unavailable" || data === null) {
    return (
      <StatisticsSectionState
        description={t(`reason.${lifecycle.reason ?? "LEGACY_HISTORY_INCOMPLETE"}`)}
        kind="unavailable"
        title={t("lifecycleUnavailable")}
      />
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {LIFECYCLE_KEYS.map((key) => (
        <StatisticsStat
          key={key}
          label={t(`lifecycle.${key}`)}
          value={formatNumber(data[key], locale)}
        />
      ))}
    </dl>
  );
}
