"use client";

import type { ReadingStatisticsLibraryBalanceSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/format";

import { formatShare } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { StatisticsStat } from "../statistics-stat";

const FORECAST_FRACTION = { maximumFractionDigits: 1 } as const;

export function LibraryBalanceSection({
  libraryBalance,
}: {
  libraryBalance: ReadingStatisticsLibraryBalanceSection;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.libraryBalance");

  const { flow, forecast, readRatio } = libraryBalance;
  const forecastEstimate = forecast.availability === "unavailable" ? null : forecast.data;
  const flowCounts = flow.availability === "available" ? flow.data : null;

  return (
    <StatisticsSection description={t("description")} title={t("title")}>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatisticsStat
          label={t("currentTbr")}
          value={t("currentTbrValue", {
            total: formatNumber(libraryBalance.currentOwnedTotal, locale),
            unread: formatNumber(libraryBalance.currentTbrCount, locale),
          })}
        />

        <StatisticsStat
          hint={readRatio === null ? t("readRatioEmpty") : t("readRatioHint")}
          label={t("readRatio")}
          value={
            readRatio === null ? (
              "—"
            ) : (
              <div className="flex flex-col gap-1.5">
                {`${formatShare(readRatio, locale)}%`}
                <Progress aria-hidden className="h-1.5" value={readRatio * 100} />
              </div>
            )
          }
        />

        <StatisticsStat
          hint={
            forecastEstimate === null
              ? t(`forecastReason.${forecast.reason ?? "INSUFFICIENT_SAMPLE"}`)
              : t("forecastHint", {
                  rate: formatNumber(forecastEstimate.readsPerMonth, locale, FORECAST_FRACTION),
                })
          }
          label={t("forecast")}
          value={
            forecastEstimate === null
              ? "—"
              : t("forecastValue", {
                  months: formatNumber(forecastEstimate.monthsRemaining, locale, FORECAST_FRACTION),
                })
          }
        />
      </dl>

      {flowCounts === null ? null : (
        <p className="text-sm text-foreground tabular-nums">
          {t("flow", {
            inflow: flowCounts.inflow,
            net: flowCounts.netChange,
            outflow: flowCounts.outflow,
          })}
        </p>
      )}
    </StatisticsSection>
  );
}
