"use client";

import type { ReadingStatisticsKpis } from "@app/shared";
import type { MouseEvent, ReactNode } from "react";

import { BookCheck, BookOpen, CalendarCheck, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { StatCard } from "@/components/ui/stat-card";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import type { StatisticsDestination, StatisticsKpiKey } from "../../model/statistics-view";

import { coverageCaption } from "../../model/statistics-availability";
import { formatRatingScore, formatShare } from "../../model/statistics-format";
import { STATISTICS_KPI_DESTINATIONS } from "../../model/statistics-view";
import {
  StatisticsCountDelta,
  StatisticsRateDelta,
  StatisticsScoreDelta,
} from "../statistics-delta";

const KPI_LINK = {
  card: "h-full transition-[border-color,box-shadow] duration-200 group-hover:border-accent-border group-hover:shadow-hover motion-reduce:transition-none",
  link: "group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
} as const;

export function StatisticsKpiGrid({
  destinationHref,
  isLowerBound,
  kpis,
  onOpen,
}: {
  destinationHref: (destination: StatisticsDestination) => string;
  isLowerBound: boolean;
  kpis: ReadingStatisticsKpis;
  onOpen: (destination: StatisticsDestination) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.kpi");

  const lowerBound = (value: string) => (isLowerBound ? t("lowerBoundValue", { value }) : value);
  const ratingCoverage = coverageCaption(kpis.averageRating.coverage);
  const isRatingKnown = kpis.averageRating.availability !== "unavailable";

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiLink destinationHref={destinationHref} kpi="completedReads" onOpen={onOpen}>
        <StatCard
          caption={
            <StatisticsCountDelta
              comparison={kpis.completedReads.comparison}
              current={kpis.completedReads.value}
              formatValue={(value) => t("completedReads.value", { count: value })}
            />
          }
          className={KPI_LINK.card}
          icon="book"
          iconSlot={<BookCheck aria-hidden />}
          label={t("completedReads.label")}
          microfact={t("completedReads.unique", { count: kpis.uniqueBooksCompleted.value })}
          size="compact"
          unit={t("completedReads.unit", { count: kpis.completedReads.value })}
          value={formatNumber(kpis.completedReads.value, locale)}
        />
      </KpiLink>

      <KpiLink destinationHref={destinationHref} kpi="pagesRead" onOpen={onOpen}>
        <StatCard
          caption={
            <StatisticsCountDelta
              comparison={kpis.pagesRead.comparison}
              current={kpis.pagesRead.value ?? 0}
              formatValue={(value) => t("pagesRead.value", { count: value })}
            />
          }
          className={KPI_LINK.card}
          icon="pages"
          iconSlot={<BookOpen aria-hidden />}
          iconTone="info"
          label={t("pagesRead.label")}
          microfact={isLowerBound ? t("lowerBoundHint") : undefined}
          size="compact"
          value={
            kpis.pagesRead.availability === "unavailable" || kpis.pagesRead.value === null ? (
              <UnavailableValue />
            ) : (
              lowerBound(formatNumber(kpis.pagesRead.value, locale))
            )
          }
        />
      </KpiLink>

      <KpiLink destinationHref={destinationHref} kpi="activeDays" onOpen={onOpen}>
        <StatCard
          caption={
            <StatisticsCountDelta
              comparison={kpis.activeDays.countComparison}
              current={kpis.activeDays.value}
              formatValue={(value) => t("activeDays.value", { count: value })}
            />
          }
          className={KPI_LINK.card}
          icon="calendar"
          iconSlot={<CalendarCheck aria-hidden />}
          iconTone="success"
          label={t("activeDays.label")}
          microfact={
            <span className="flex flex-wrap items-center gap-x-2">
              <span>
                {t("activeDays.rate", { percent: formatShare(kpis.activeDays.rate, locale) })}
              </span>
              <StatisticsRateDelta comparison={kpis.activeDays.rateComparison} />
            </span>
          }
          size="compact"
          unit={t("activeDays.unit", { count: kpis.activeDays.value })}
          value={lowerBound(formatNumber(kpis.activeDays.value, locale))}
        />
      </KpiLink>

      <KpiLink destinationHref={destinationHref} kpi="averageRating" onOpen={onOpen}>
        <StatCard
          caption={<StatisticsScoreDelta comparison={kpis.averageRating.comparison} />}
          className={KPI_LINK.card}
          icon="star"
          iconSlot={<Star aria-hidden />}
          iconTone="favorite"
          label={t("averageRating.label")}
          microfact={
            kpis.averageRating.availability === "unavailable"
              ? t(`averageRating.reason.${kpis.averageRating.reason ?? "NO_RATINGS"}`)
              : ratingCoverage === null
                ? undefined
                : t("averageRating.coverage", ratingCoverage)
          }
          size="compact"
          unit={isRatingKnown ? t("averageRating.scale") : undefined}
          value={
            isRatingKnown && kpis.averageRating.value !== null ? (
              formatRatingScore(kpis.averageRating.value, locale)
            ) : (
              <UnavailableValue />
            )
          }
        />
      </KpiLink>
    </div>
  );
}

function isBrowserHandledClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.altKey || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey;
}

function KpiLink({
  children,
  destinationHref,
  kpi,
  onOpen,
}: {
  children: ReactNode;
  destinationHref: (destination: StatisticsDestination) => string;
  kpi: StatisticsKpiKey;
  onOpen: (destination: StatisticsDestination) => void;
}) {
  const destination = STATISTICS_KPI_DESTINATIONS[kpi];

  return (
    <Link
      className={KPI_LINK.link}
      href={destinationHref(destination)}
      onClick={(event) => {
        if (isBrowserHandledClick(event)) return;
        event.preventDefault();
        onOpen(destination);
      }}
      scroll={false}
    >
      {children}
    </Link>
  );
}

function UnavailableValue(): ReactNode {
  return <span className="text-muted-foreground">—</span>;
}
