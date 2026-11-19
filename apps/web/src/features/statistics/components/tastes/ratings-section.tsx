"use client";

import type { ReadingStatisticsRatingsSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/lib/format";

import { coverageCaption } from "../../model/statistics-availability";
import { formatRatingScore, formatShare } from "../../model/statistics-format";
import { CompletedReadCard } from "../completed-read-card";
import { StatisticsSection } from "../statistics-section";
import { StatisticsStat } from "../statistics-stat";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { RatingDistribution } from "./rating-distribution";

export function RatingsSection({ ratings }: { ratings: ReadingStatisticsRatingsSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.ratings");
  const coverage = coverageCaption(ratings.coverage);

  if (ratings.availability === "unavailable") {
    return (
      <StatisticsSection description={t("description")} title={t("title")}>
        <StatisticsSectionState
          density="compact"
          description={t(`reason.${ratings.reason ?? "NO_RATINGS"}`)}
          kind="unavailable"
          title={t("unavailable")}
        />
      </StatisticsSection>
    );
  }

  return (
    <div className="@container">
      <div className="grid grid-cols-1 items-start gap-4 @4xl:grid-cols-2">
        <StatisticsSection
          description={t("description")}
          note={coverage === null ? null : <StatisticsNote>{t("coverage")}</StatisticsNote>}
          title={t("title")}
        >
          <dl className="grid grid-cols-3 gap-2">
            <StatisticsStat
              label={t("averageRating")}
              size="lg"
              value={
                ratings.averageRating === null
                  ? "—"
                  : t("scale", { value: formatRatingScore(ratings.averageRating, locale) })
              }
            />
            <StatisticsStat
              hint={
                ratings.coverage.percent === null
                  ? undefined
                  : t("ratedReadsHint", {
                      percent: formatShare(ratings.coverage.percent, locale),
                    })
              }
              label={t("ratedReads")}
              size="lg"
              value={t("ratedReadsValue", {
                rated: formatNumber(ratings.ratedReadsCount, locale),
                total: formatNumber(ratings.completedReadsCount, locale),
              })}
            />
            <StatisticsStat
              hint={
                ratings.highRatedShare === null
                  ? undefined
                  : t("highRatedHint", { percent: formatShare(ratings.highRatedShare, locale) })
              }
              label={t("highRated")}
              size="lg"
              value={
                ratings.highRatedShare === null
                  ? "—"
                  : t("highRatedValue", {
                      count: formatNumber(ratings.highRatedReadsCount, locale),
                      total: formatNumber(ratings.ratedReadsCount, locale),
                    })
              }
            />
          </dl>
          <RatingDistribution distribution={ratings.distribution} />
        </StatisticsSection>

        <StatisticsSection
          contentClassName="@container"
          description={t("topRatedDescription")}
          title={t("topRatedTitle")}
        >
          {ratings.topRated.length === 0 ? (
            <StatisticsSectionState density="compact" kind="empty" title={t("topRatedEmpty")} />
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 @md:grid-cols-2">
              {ratings.topRated.map((read) => (
                <li className="flex" key={read.readingCycleId}>
                  <CompletedReadCard read={read} showFinishedAt variant="compact" />
                </li>
              ))}
            </ul>
          )}
        </StatisticsSection>
      </div>
    </div>
  );
}
