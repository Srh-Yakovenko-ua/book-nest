"use client";

import type { BookOrderStatisticsStore, Currency } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import {
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { z } from "zod";

import type { ChartConfig } from "@/components/ui/chart";

import { ChartContainer } from "@/components/ui/chart";
import { useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import type { StatisticsDrilldownFilters } from "../../model/statistics-drilldown";
import type { StoreScatterPoint } from "../../model/statistics-stores";

import { formatMoney } from "../../model/money-format";
import { storeHref } from "../../model/statistics-drilldown";
import { formatPercentValue } from "../../model/statistics-format";
import { storeScatter } from "../../model/statistics-stores";
import { StatisticsCurrencyTabs, StatisticsSection } from "./statistics-section";

const BUBBLE_RANGE: [number, number] = [140, 900];

const ScatterClickSchema = z.object({ store: z.string() });

export function StatisticsStoreMap({
  currencies,
  currency,
  drilldown,
  onCurrencyChange,
  stores,
}: {
  currencies: readonly Currency[];
  currency: Currency;
  drilldown: StatisticsDrilldownFilters;
  onCurrencyChange: (currency: Currency) => void;
  stores: readonly BookOrderStatisticsStore[];
}) {
  const t = useTranslations("delivery.statistics.storeMap");
  const locale = useLocale();
  const router = useRouter();

  const { points, withoutLandedData } = storeScatter({ currency, stores });

  const config = {
    stores: { color: "var(--chart-1)", label: t("title") },
  } satisfies ChartConfig;

  return (
    <StatisticsSection
      action={
        <StatisticsCurrencyTabs
          currencies={currencies}
          label={t("currencyLabel")}
          onChange={onCurrencyChange}
          value={currency}
        />
      }
      className="h-full"
      description={t("subtitle")}
      title={t("title")}
    >
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <ChartContainer
            aria-label={t("aria")}
            className="aspect-auto h-[17rem] w-full sm:h-[19rem]"
            config={config}
            role="img"
          >
            <ScatterChart margin={{ bottom: 18, left: 12, right: 12, top: 12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis
                axisLine={false}
                dataKey="averageLandedBookCost"
                label={{
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                  offset: -6,
                  position: "insideBottom",
                  value: t("axisX"),
                }}
                name={t("axisX")}
                tickFormatter={(value: number) =>
                  formatNumber(value, locale, { notation: "compact" })
                }
                tickLine={false}
                type="number"
              />
              <YAxis
                axisLine={false}
                dataKey="averageOrderAmount"
                label={{
                  angle: -90,
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                  position: "insideLeft",
                  style: { textAnchor: "middle" },
                  value: t("axisY"),
                }}
                name={t("axisY")}
                tickFormatter={(value: number) =>
                  formatNumber(value, locale, { notation: "compact" })
                }
                tickLine={false}
                type="number"
                width={48}
              />
              <ZAxis dataKey="booksCount" name={t("bubble")} range={BUBBLE_RANGE} type="number" />
              <RechartsTooltip
                content={<StoreMapTooltip currency={currency} />}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Scatter
                className="cursor-pointer"
                data={points}
                fill="color-mix(in srgb, var(--chart-1) 55%, var(--card))"
                onClick={(point) => {
                  const clicked = ScatterClickSchema.safeParse(point.payload);
                  if (!clicked.success) return;
                  router.push(storeHref(clicked.data.store, { ...drilldown, currency }));
                }}
                stroke="var(--chart-1)"
                strokeWidth={1.5}
              />
            </ScatterChart>
          </ChartContainer>

          <p className="text-xs text-muted-foreground">{t("legend")}</p>
        </>
      )}

      {withoutLandedData.length === 0 ? null : (
        <p className="text-xs text-muted-foreground">
          {t("insufficient", { stores: withoutLandedData.join(", ") })}
        </p>
      )}
    </StatisticsSection>
  );
}

function StoreMapTooltip({
  active,
  currency,
  payload,
}: {
  active?: boolean;
  currency: Currency;
  payload?: readonly { payload: StoreScatterPoint }[];
}) {
  const t = useTranslations("delivery.statistics.storeMap");
  const locale = useLocale();
  const point = payload?.[0]?.payload;
  if (active !== true || point === undefined) return null;

  return (
    <div className="grid min-w-48 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
      <div className="font-medium text-ink">{point.store}</div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-muted-foreground">
        <dt>{t("axisX")}</dt>
        <dd className="text-end font-medium text-foreground tabular-nums">
          {formatMoney({ amount: point.averageLandedBookCost, currency, locale })}
        </dd>
        <dt>{t("axisY")}</dt>
        <dd className="text-end font-medium text-foreground tabular-nums">
          {formatMoney({ amount: point.averageOrderAmount, currency, locale })}
        </dd>
        <dt>{t("bubble")}</dt>
        <dd className="text-end font-medium text-foreground tabular-nums">
          {formatNumber(point.booksCount, locale)}
        </dd>
        <dt>{t("orders")}</dt>
        <dd className="text-end font-medium text-foreground tabular-nums">
          {formatNumber(point.ordersCount, locale)}
        </dd>
        <dt>{t("coverage")}</dt>
        <dd className="text-end font-medium text-foreground tabular-nums">
          {formatPercentValue(point.coveragePercent, locale)}
        </dd>
      </dl>
    </div>
  );
}
