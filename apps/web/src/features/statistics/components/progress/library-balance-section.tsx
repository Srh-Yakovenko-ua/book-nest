"use client";

import type { ReadingStatisticsLibraryBalanceSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/format";

import { formatShare } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { StatisticsStat } from "../statistics-stat";
import { StatisticsNote } from "../statistics-states";

const FORECAST_FRACTION = { maximumFractionDigits: 1 } as const;

export function LibraryBalanceSection({
  libraryBalance,
}: {
  libraryBalance: ReadingStatisticsLibraryBalanceSection;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.libraryBalance");

  const { flow, forecast, readRatio } = libraryBalance;

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
            forecast.data === null
              ? undefined
              : t("forecastPace", {
                  rate: formatNumber(forecast.data.readsPerMonth, locale, FORECAST_FRACTION),
                })
          }
          label={t("forecast")}
          value={
            forecast.data === null
              ? "—"
              : t("forecastValue", {
                  months: formatNumber(forecast.data.monthsRemaining, locale, FORECAST_FRACTION),
                })
          }
        />
      </dl>

      {flow.availability === "unavailable" || flow.data === null ? null : (
        <p className="text-sm text-foreground tabular-nums">
          {t("flow", {
            inflow: flow.data.inflow,
            net: flow.data.netChange,
            outflow: flow.data.outflow,
          })}
        </p>
      )}

      {forecast.availability === "unavailable" ? (
        <StatisticsNote>
          {t(`forecastReason.${forecast.reason ?? "INSUFFICIENT_SAMPLE"}`)}
        </StatisticsNote>
      ) : null}
    </StatisticsSection>
  );
}
