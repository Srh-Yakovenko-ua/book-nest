"use client";

import type { ReadingStatisticsLanguagesSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { coverageCaption } from "../../model/statistics-availability";
import { formatShare } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
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
        languages.items.length === 0 ? undefined : (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
            {t("count", { count: languages.items.length })}
          </span>
        )
      }
      description={t("description")}
      note={coverage === null ? null : <StatisticsNote>{t("coverage", coverage)}</StatisticsNote>}
      title={t("title")}
    >
      {languages.items.length === 0 ? (
        <StatisticsSectionState density="compact" kind="empty" title={t("empty")} />
      ) : (
        <TasteRankingList
          rows={languages.items.map((entry) => ({
            drilldown: entry.drilldown,
            key: entry.language,
            label: tLabels(entry.language),
            secondary: t("share", { percent: formatShare(entry.shareOfKnown, locale) }),
            value: entry.shareOfKnown,
            valueLabel: t("reads", { count: entry.completedReadCount }),
          }))}
          scaleMax={1}
          variant="compact"
        />
      )}
    </StatisticsSection>
  );
}
