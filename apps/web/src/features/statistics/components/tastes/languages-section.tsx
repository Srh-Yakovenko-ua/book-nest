"use client";

import type { ReadingStatisticsLanguagesSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/lib/format";

import { coverageCaption } from "../../model/statistics-availability";
import { formatShare } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { StatisticsStat } from "../statistics-stat";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { TasteRankingList } from "./taste-ranking-list";

export function LanguagesSection({ languages }: { languages: ReadingStatisticsLanguagesSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.languages");
  const tLabels = useTranslations("books.classification.languageLabels");
  const coverage = coverageCaption(languages.coverage);

  if (languages.availability === "unavailable") {
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
      note={
        <>
          <StatisticsNote>{t("sourceHint")}</StatisticsNote>
          {coverage === null ? null : <StatisticsNote>{t("coverage", coverage)}</StatisticsNote>}
        </>
      }
      title={t("title")}
    >
      {languages.items.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatisticsStat
              label={t("countLabel")}
              value={formatNumber(languages.items.length, locale)}
            />
          </dl>
          <TasteRankingList
            rows={languages.items.map((entry) => ({
              key: entry.language,
              label: tLabels(entry.language),
              secondary: t("share", { percent: formatShare(entry.shareOfKnown, locale) }),
              value: entry.completedReadCount,
              valueLabel: t("reads", { count: entry.completedReadCount }),
            }))}
          />
        </>
      )}
    </StatisticsSection>
  );
}
