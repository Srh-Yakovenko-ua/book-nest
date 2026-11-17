"use client";

import type { ReadingStatisticsKpis } from "@app/shared";
import type { MouseEvent, ReactNode } from "react";

import { ArrowUpRight, BookCheck, BookOpen, CalendarCheck, Star } from "lucide-react";
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

const KPI_CARD = {
  affordance:
    "pointer-events-none absolute top-3 right-3 hidden size-4 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none sm:block",
  caption: "block min-h-5",
  card: "h-full justify-start transition duration-200 group-hover:border-accent-border group-hover:shadow-hover group-focus-visible:border-accent-border group-focus-visible:shadow-hover motion-reduce:transition-none",
  grid: "grid grid-cols-1 gap-3 @xs:grid-cols-2 @xs:xl:grid-cols-4",
  label: "block min-h-10 @3xs:min-h-0 sm:pe-4",
  link: "group @container relative rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  microfactLines: "flex flex-col gap-0.5",
  value: "text-2xl lg:text-3xl",
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
  const lowerBoundHint = isLowerBound ? <span>{t("lowerBoundHint")}</span> : null;
  const activeDaysRate = (
    <span className="flex flex-wrap items-center gap-x-2">
      <span>{t("activeDays.rate", { percent: formatShare(kpis.activeDays.rate, locale) })}</span>
      <StatisticsRateDelta comparison={kpis.activeDays.rateComparison} />
    </span>
  );
  const ratingCoverage = coverageCaption(kpis.averageRating.coverage);
  const isRatingKnown = kpis.averageRating.availability !== "unavailable";
  const hasComparison = [
    kpis.completedReads.comparison,
    kpis.pagesRead.comparison,
    kpis.activeDays.countComparison,
    kpis.averageRating.comparison,
  ].some((comparison) => comparison !== null);

  const caption = (delta: ReactNode) =>
    hasComparison ? <span className={KPI_CARD.caption}>{delta}</span> : delta;
  const label = (text: string) => <span className={KPI_CARD.label}>{text}</span>;

  return (
    <div className="@container">
      <div className={KPI_CARD.grid}>
        <KpiLink destinationHref={destinationHref} kpi="completedReads" onOpen={onOpen}>
          <StatCard
            caption={caption(
              <StatisticsCountDelta
                comparison={kpis.completedReads.comparison}
                current={kpis.completedReads.value}
                formatValue={(value) => t("completedReads.value", { count: value })}
              />,
            )}
            className={KPI_CARD.card}
            icon="book"
            iconBadgeSize="md"
            iconSlot={<BookCheck aria-hidden />}
            label={label(t("completedReads.label"))}
            labelOverflow="wrap"
            microfact={t("completedReads.unique", { count: kpis.uniqueBooksCompleted.value })}
            size="compact"
            unit={t("completedReads.unit", { count: kpis.completedReads.value })}
            value={formatNumber(kpis.completedReads.value, locale)}
            valueClassName={KPI_CARD.value}
          />
        </KpiLink>

        <KpiLink destinationHref={destinationHref} kpi="pagesRead" onOpen={onOpen}>
          <StatCard
            caption={caption(
              <StatisticsCountDelta
                comparison={kpis.pagesRead.comparison}
                current={kpis.pagesRead.value ?? 0}
                formatValue={(value) => t("pagesRead.value", { count: value })}
              />,
            )}
            className={KPI_CARD.card}
            icon="pages"
            iconBadgeSize="md"
            iconSlot={<BookOpen aria-hidden />}
            iconTone="info"
            label={label(t("pagesRead.label"))}
            labelOverflow="wrap"
            microfact={lowerBoundHint ?? undefined}
            size="compact"
            value={
              kpis.pagesRead.availability === "unavailable" || kpis.pagesRead.value === null ? (
                <UnavailableValue />
              ) : (
                lowerBound(formatNumber(kpis.pagesRead.value, locale))
              )
            }
            valueClassName={KPI_CARD.value}
          />
        </KpiLink>

        <KpiLink destinationHref={destinationHref} kpi="activeDays" onOpen={onOpen}>
          <StatCard
            caption={caption(
              <StatisticsCountDelta
                comparison={kpis.activeDays.countComparison}
                current={kpis.activeDays.value}
                formatValue={(value) => t("activeDays.value", { count: value })}
              />,
            )}
            className={KPI_CARD.card}
            icon="calendar"
            iconBadgeSize="md"
            iconSlot={<CalendarCheck aria-hidden />}
            iconTone="success"
            label={label(t("activeDays.label"))}
            labelOverflow="wrap"
            microfact={
              lowerBoundHint === null ? (
                activeDaysRate
              ) : (
                <span className={KPI_CARD.microfactLines}>
                  {activeDaysRate}
                  {lowerBoundHint}
                </span>
              )
            }
            size="compact"
            unit={t("activeDays.unit", { count: kpis.activeDays.value })}
            value={lowerBound(formatNumber(kpis.activeDays.value, locale))}
            valueClassName={KPI_CARD.value}
          />
        </KpiLink>

        <KpiLink destinationHref={destinationHref} kpi="averageRating" onOpen={onOpen}>
          <StatCard
            caption={caption(<StatisticsScoreDelta comparison={kpis.averageRating.comparison} />)}
            className={KPI_CARD.card}
            icon="star"
            iconBadgeSize="md"
            iconSlot={<Star aria-hidden />}
            iconTone="favorite"
            label={label(t("averageRating.label"))}
            labelOverflow="wrap"
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
            valueClassName={KPI_CARD.value}
          />
        </KpiLink>
      </div>
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
      className={KPI_CARD.link}
      href={destinationHref(destination)}
      onClick={(event) => {
        if (isBrowserHandledClick(event)) return;
        event.preventDefault();
        onOpen(destination);
      }}
      scroll={false}
    >
      {children}
      <ArrowUpRight aria-hidden className={KPI_CARD.affordance} />
    </Link>
  );
}

function UnavailableValue(): ReactNode {
  return <span className="text-muted-foreground">—</span>;
}
