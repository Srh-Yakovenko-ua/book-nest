"use client";

import type { ReadingStatisticsPublishersSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

import { coverageCaption } from "../../model/statistics-availability";
import { formatRatingScore, formatShare } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";
import { TasteRankingList } from "./taste-ranking-list";

const TOP_THREE_SIZE = 3;

export function PublishersSection({
  publishers,
}: {
  publishers: ReadingStatisticsPublishersSection;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.publishers");
  const coverage = coverageCaption(publishers.coverage);
  const knownCount = publishers.coverage.knownCount;
  const topThreeConcentration =
    publishers.totalPublishers > TOP_THREE_SIZE ? publishers.topThreeConcentration : null;

  if (publishers.availability === "unavailable") {
    return (
      <StatisticsSection title={t("title")}>
        <StatisticsSectionState
          density="compact"
          description={t("unavailableDescription")}
          kind="unavailable"
          title={t("unavailable")}
        />
      </StatisticsSection>
    );
  }

  return (
    <StatisticsSection
      action={
        publishers.items.length === 0 ? undefined : (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
            {t("count", { count: publishers.totalPublishers })}
          </span>
        )
      }
      description={coverage === null ? undefined : t("coverage", coverage)}
      title={t("title")}
    >
      {publishers.items.length === 0 ? (
        <StatisticsSectionState density="compact" kind="empty" title={t("empty")} />
      ) : (
        <>
          <TasteRankingList
            rows={publishers.items.map((entry) => ({
              contextActions: entry.contextActions,
              drilldown: entry.drilldown,
              key: entry.publisherId,
              label: entry.name,
              secondary: (
                <span className="inline-flex items-center gap-1">
                  {entry.averageRating === null ? null : (
                    <>
                      <UiIcon aria-hidden className="text-warning" name="star-fill" size={12} />
                      {formatRatingScore(entry.averageRating, locale)}
                      <span aria-hidden>·</span>
                    </>
                  )}
                  {t("share", {
                    percent: formatShare(
                      knownCount <= 0 ? 0 : entry.completedReadCount / knownCount,
                      locale,
                    ),
                  })}
                </span>
              ),
              value: entry.completedReadCount,
              valueLabel: t("reads", { count: entry.completedReadCount }),
            }))}
            scaleMax={knownCount}
            variant="compact"
          />
          {topThreeConcentration === null ? null : (
            <p className="text-xs text-muted-foreground">
              {t("topThreeShare", { percent: formatShare(topThreeConcentration, locale) })}
            </p>
          )}
        </>
      )}
    </StatisticsSection>
  );
}
