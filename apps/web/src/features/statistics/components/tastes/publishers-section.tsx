"use client";

import type { ReadingStatisticsPublishersSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";

import { coverageCaption } from "../../model/statistics-availability";
import { formatRatingScore, formatShare } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { StatisticsStat } from "../statistics-stat";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { TasteRankingList } from "./taste-ranking-list";

export function PublishersSection({
  publishers,
}: {
  publishers: ReadingStatisticsPublishersSection;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.publishers");
  const coverage = coverageCaption(publishers.coverage);

  if (publishers.availability === "unavailable") {
    return (
      <StatisticsSection description={t("description")} title={t("title")}>
        <StatisticsSectionState
          description={t("unavailableDescription")}
          kind="unavailable"
          title={t("unavailable")}
        />
      </StatisticsSection>
    );
  }

  return (
    <StatisticsSection
      description={t("description")}
      note={coverage === null ? null : <StatisticsNote>{t("coverage", coverage)}</StatisticsNote>}
      title={t("title")}
    >
      {publishers.items.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <StatisticsStat
              label={t("totalLabel")}
              value={formatNumber(publishers.totalPublishers, locale)}
            />
            <StatisticsStat
              label={t("concentrationLabel")}
              value={
                publishers.topThreeConcentration === null
                  ? "—"
                  : `${formatShare(publishers.topThreeConcentration, locale)}%`
              }
            />
          </dl>
          <TasteRankingList
            rows={publishers.items.map((entry) => ({
              contextActions: entry.contextActions,
              key: entry.publisherId,
              label: entry.name,
              secondary:
                entry.averageRating === null ? undefined : (
                  <span className="inline-flex items-center gap-0.5">
                    <UiIcon aria-hidden className="text-warning" name="star-fill" size={12} />
                    {formatRatingScore(entry.averageRating, locale)}
                  </span>
                ),
              value: entry.completedReadCount,
              valueLabel: t("reads", { count: entry.completedReadCount }),
            }))}
          />
        </>
      )}
    </StatisticsSection>
  );
}
