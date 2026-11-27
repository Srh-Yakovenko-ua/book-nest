"use client";

import type { ReadingStatisticsLibraryBalanceSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/format";

import { formatShare } from "../../model/statistics-format";
import { ProgressCard, progressFigure } from "./progress-card";
import { ProgressInfoHint } from "./progress-info-hint";

const FORECAST_FRACTION = { maximumFractionDigits: 1 } as const;

type LibraryForecastEstimate = NonNullable<
  ReadingStatisticsLibraryBalanceSection["forecast"]["data"]
>;

export function LibraryBalanceSection({
  libraryBalance,
}: {
  libraryBalance: ReadingStatisticsLibraryBalanceSection;
}) {
  const t = useTranslations("statistics.libraryBalance");
  const { flow, forecast } = libraryBalance;
  const flowCounts = flow.availability === "available" ? flow.data : null;
  const estimate = forecast.availability === "unavailable" ? null : forecast.data;
  const facts =
    estimate === null && flowCounts === null ? undefined : (
      <dl className="flex flex-col gap-1.5 border-t border-border/60 pt-3 text-xs">
        {estimate === null ? null : <LibraryForecast estimate={estimate} />}
        {flowCounts === null ? null : (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <dt className="text-muted-foreground">{t("flowLabel")}</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {t("flow", {
                inflow: flowCounts.inflow,
                net: flowCounts.netChange,
                outflow: flowCounts.outflow,
              })}
            </dd>
          </div>
        )}
      </dl>
    );

  return (
    <ProgressCard
      description={t("description")}
      icon="library"
      illustration="library"
      lead={<LibraryReadShare libraryBalance={libraryBalance} />}
      title={t("title")}
    >
      {facts}
    </ProgressCard>
  );
}

function LibraryForecast({ estimate }: { estimate: LibraryForecastEstimate }) {
  const locale = useLocale();
  const t = useTranslations("statistics.libraryBalance");

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <dt className="text-muted-foreground">{t("forecastLabel")}</dt>
      <dd className="inline-flex flex-wrap items-center gap-x-0.5 font-medium text-foreground">
        <span className="tabular-nums">
          {t("forecastEstimate", {
            months: formatNumber(estimate.monthsRemaining, locale, FORECAST_FRACTION),
            rate: formatNumber(estimate.readsPerMonth, locale, FORECAST_FRACTION),
          })}
        </span>
        <ProgressInfoHint topic={t("forecastLabel")}>{t("forecastBasis")}</ProgressInfoHint>
      </dd>
    </div>
  );
}

function LibraryReadShare({
  libraryBalance,
}: {
  libraryBalance: ReadingStatisticsLibraryBalanceSection;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.libraryBalance");
  const { currentOwnedTotal, currentTbrCount, readRatio } = libraryBalance;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <dl className="flex min-w-0 flex-col gap-1">
          <dt className="text-xs text-muted-foreground">{t("currentTbr")}</dt>
          <dd className="text-base font-medium text-foreground">
            {t.rich("currentTbrBooks", {
              count: currentOwnedTotal,
              num: progressFigure,
              total: formatNumber(currentOwnedTotal, locale),
              unread: formatNumber(currentTbrCount, locale),
            })}
          </dd>
        </dl>
        {readRatio === null ? null : (
          <Badge className="h-auto min-h-6 px-2.5 text-sm tabular-nums" variant="success">
            {t("readShareBadge", { percent: formatShare(readRatio, locale) })}
          </Badge>
        )}
      </div>

      {readRatio === null ? (
        <p className="flex items-baseline gap-2 text-sm text-muted-foreground">
          <span className="font-heading text-lg font-semibold text-ink">—</span>
          <span>{t("readRatioEmpty")}</span>
        </p>
      ) : (
        <ReadShareBar
          ownedTotal={currentOwnedTotal}
          readRatio={readRatio}
          unreadCount={currentTbrCount}
        />
      )}
    </div>
  );
}

function ReadShareBar({
  ownedTotal,
  readRatio,
  unreadCount,
}: {
  ownedTotal: number;
  readRatio: number;
  unreadCount: number;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.libraryBalance");
  const readCount = Math.round(readRatio * ownedTotal);

  return (
    <>
      <Progress
        aria-label={t("readRatioProgressLabel", { percent: formatShare(readRatio, locale) })}
        className="h-2"
        value={readRatio * 100}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
            {t("legendRead", { count: readCount })}
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full border border-border bg-muted"
            />
            {t("legendUnread", { count: unreadCount })}
          </li>
        </ul>
        <p>{t("readRatioHint")}</p>
      </div>
    </>
  );
}
