"use client";

import type {
  ReadingStatisticsInsight,
  ReadingStatisticsInsightsSection,
  ReadingStatisticsInsightTone,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { toContextActionLink } from "../../model/statistics-drilldown";
import {
  formatDayLong,
  formatRatingScore,
  formatShare,
  weekdayLabel,
} from "../../model/statistics-format";
import { toInsightView } from "../../model/statistics-insights";
import { useGenreName } from "../../model/use-genre-name";
import { StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";

const INSIGHT_TONE_CLASS = {
  negative: "bg-warning-soft text-warning",
  neutral: "bg-primary/10 text-primary",
  positive: "bg-success-soft text-success",
} as const satisfies Record<ReadingStatisticsInsightTone, string>;

export function StatisticsInsightBody({
  insight,
  isLowerBound,
}: {
  insight: ReadingStatisticsInsight;
  isLowerBound: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.insights.codes");
  const tActions = useTranslations("statistics.contextActions");
  const tLanguage = useTranslations("books.classification.languageLabels");
  const genreName = useGenreName();

  const view = toInsightView({
    format: {
      day: (day) => formatDayLong(day, locale),
      genre: genreName,
      language: (language) => tLanguage(language),
      rating: (value) => formatRatingScore(value, locale),
      share: (ratio) => `${formatShare(ratio, locale)}%`,
      weekday: (weekday) => weekdayLabel({ locale, weekday }),
    },
    insight,
    isLowerBound,
  });
  const action = insight.action === undefined ? null : toContextActionLink(insight.action);

  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          INSIGHT_TONE_CLASS[insight.tone],
        )}
      >
        <UiIcon name={view.icon} size={16} />
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-sm leading-relaxed text-foreground">
          {t.rich(view.code, {
            ...view.values,
            value: (chunks) => <strong className="font-semibold text-ink">{chunks}</strong>,
          })}
        </p>
        {action === null ? null : (
          <Link
            className="-mx-1 inline-flex min-h-9 items-center gap-1 self-start rounded-md px-1 text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            href={action.href}
          >
            {tActions(action.kind)}
            <UiIcon aria-hidden name="arrow-right" size={12} />
          </Link>
        )}
      </div>
    </div>
  );
}

export function StatisticsInsights({
  insights,
  isLowerBound,
}: {
  insights: ReadingStatisticsInsightsSection;
  isLowerBound: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.insights");

  return (
    <StatisticsSection
      description={t("description", { count: formatNumber(insights.items.length, locale) })}
      title={t("title")}
    >
      {insights.items.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <div
          aria-label={t("title")}
          className="-mx-1 snap-x snap-mandatory overflow-x-auto rounded-lg px-1 pb-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:overflow-visible"
          role="region"
          tabIndex={0}
        >
          <ul className="flex gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-4">
            {insights.items.map((insight) => (
              <li
                className="w-[85%] shrink-0 snap-start lg:w-auto lg:shrink"
                key={`${insight.code}-${insight.category}`}
              >
                <Card className="h-full px-4 py-3.5">
                  <StatisticsInsightBody insight={insight} isLowerBound={isLowerBound} />
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </StatisticsSection>
  );
}
