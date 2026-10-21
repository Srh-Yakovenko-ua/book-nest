"use client";

import type { ReadingStatisticsInsight, ReadingStatisticsInsightTone } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
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

const INSIGHT_TONE_CLASS = {
  negative: "bg-warning-soft text-warning",
  neutral: "bg-primary/10 text-primary",
  positive: "bg-success-soft text-success",
} as const satisfies Record<ReadingStatisticsInsightTone, string>;

const INSIGHT_EMPHASIS = {
  figure: {
    body: "flex min-w-0 flex-col gap-1.5 pt-1",
    sentence: "text-sm leading-relaxed text-muted-foreground",
    value: "font-heading text-lg leading-none font-semibold text-ink",
  },
  plain: {
    body: "flex min-w-0 flex-col gap-1.5",
    sentence: "text-sm leading-relaxed text-foreground",
    value: "font-semibold text-ink",
  },
} as const;

type InsightEmphasis = keyof typeof INSIGHT_EMPHASIS;

export function StatisticsInsightBody({
  emphasis = "plain",
  insight,
  isLowerBound,
}: {
  emphasis?: InsightEmphasis;
  insight: ReadingStatisticsInsight;
  isLowerBound: boolean;
}) {
  const emphasisClass = INSIGHT_EMPHASIS[emphasis];
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
      <div className={emphasisClass.body}>
        <p className={emphasisClass.sentence}>
          {t.rich(view.code, {
            ...view.values,
            value: (chunks) => <strong className={emphasisClass.value}>{chunks}</strong>,
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
  insights: readonly ReadingStatisticsInsight[];
  isLowerBound: boolean;
}) {
  const t = useTranslations("statistics.insights");

  if (insights.length === 0) return null;

  return (
    <StatisticsSection title={t("title")}>
      <ul className="flex flex-col divide-y divide-border">
        {insights.map((insight) => (
          <li className="py-3 first:pt-0 last:pb-0" key={`${insight.code}-${insight.category}`}>
            <StatisticsInsightBody
              emphasis="figure"
              insight={insight}
              isLowerBound={isLowerBound}
            />
          </li>
        ))}
      </ul>
    </StatisticsSection>
  );
}
