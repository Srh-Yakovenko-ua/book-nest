"use client";

import type { BookOrderStatisticsMonth, Currency, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Bar, CartesianGrid, BarChart as RechartsBarChart, XAxis, YAxis } from "recharts";

import type { ChartConfig } from "@/components/ui/chart";

import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import type { StatisticsDrilldownFilters } from "../../model/statistics-drilldown";
import type { DynamicsMetric, DynamicsPoint } from "../../model/statistics-dynamics";

import { formatMoney } from "../../model/money-format";
import { monthHref } from "../../model/statistics-drilldown";
import {
  DYNAMICS_METRICS,
  isMoneyMetric,
  monthLabel,
  monthlyPoints,
} from "../../model/statistics-dynamics";
import { formatPercentValue } from "../../model/statistics-format";
import {
  StatisticsCurrencyTabs,
  StatisticsMetricTabs,
  StatisticsSection,
} from "./statistics-section";

const CURRENT_FILL = "color-mix(in srgb, var(--chart-1) 62%, var(--card))";
const COMPARISON_FILL = "color-mix(in srgb, var(--chart-4) 18%, var(--card))";
const COMPARISON_STROKE = "var(--chart-4)";

export function StatisticsDynamics({
  comparisonLabel,
  comparisonMonths,
  currencies,
  currency,
  currentLabel,
  drilldown,
  months,
  onCurrencyChange,
  range,
}: {
  comparisonLabel: Nullable<string>;
  comparisonMonths: Nullable<readonly BookOrderStatisticsMonth[]>;
  currencies: readonly Currency[];
  currency: Currency;
  currentLabel: Nullable<string>;
  drilldown: StatisticsDrilldownFilters;
  months: readonly BookOrderStatisticsMonth[];
  onCurrencyChange: (currency: Currency) => void;
  range: { from: Nullable<string>; to: Nullable<string> };
}) {
  const t = useTranslations("delivery.statistics.dynamics");
  const locale = useLocale();
  const router = useRouter();
  const [metric, setMetric] = useState<DynamicsMetric>("spend");

  const points = monthlyPoints({ comparisonMonths, currency, metric, months, range });
  const isMoney = isMoneyMetric(metric);
  const hasComparison = comparisonMonths !== null;

  const config = {
    comparisonValue: { color: COMPARISON_STROKE, label: comparisonLabel ?? t("comparison") },
    value: { color: "var(--chart-1)", label: currentLabel ?? t("current") },
  } satisfies ChartConfig;

  const formatValue = (value: number) =>
    isMoney ? formatMoney({ amount: value, currency, locale }) : formatNumber(value, locale);

  return (
    <StatisticsSection
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatisticsMetricTabs
            label={t("metricLabel")}
            metrics={DYNAMICS_METRICS}
            onChange={setMetric}
            optionLabel={(value) => t(`metrics.${value}`)}
            value={metric}
          />
          {isMoney ? (
            <StatisticsCurrencyTabs
              currencies={currencies}
              label={t("currencyLabel")}
              onChange={onCurrencyChange}
              value={currency}
            />
          ) : null}
        </div>
      }
      description={t("subtitle")}
      title={t("title")}
    >
      {points.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <ChartContainer
            aria-label={t("aria", { metric: t(`metrics.${metric}`) })}
            className="aspect-auto h-[16rem] w-full sm:h-[22rem] xl:h-[24rem]"
            config={config}
            role="img"
          >
            <RechartsBarChart
              data={points}
              margin={{ bottom: 0, left: 4, right: 4, top: 12 }}
              onClick={(event) => {
                const month = event?.activeLabel;
                if (typeof month !== "string") return;
                router.push(monthHref(month, drilldown));
              }}
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
              <XAxis
                axisLine={{ stroke: "var(--border)" }}
                dataKey="month"
                interval="preserveStartEnd"
                minTickGap={16}
                tickFormatter={(value: string) => monthLabel(value, locale, false)}
                tickLine={false}
                tickMargin={10}
              />
              <YAxis
                axisLine={false}
                tickFormatter={(value: number) =>
                  formatNumber(value, locale, { notation: "compact" })
                }
                tickLine={false}
                width={44}
              />
              <ChartTooltip
                content={
                  <DynamicsTooltip
                    comparisonLabel={comparisonLabel}
                    currentLabel={currentLabel}
                    formatValue={formatValue}
                    hasComparison={hasComparison}
                  />
                }
                cursor={{ fill: "var(--muted)" }}
              />
              {hasComparison ? (
                <Bar
                  dataKey="comparisonValue"
                  fill={COMPARISON_FILL}
                  maxBarSize={22}
                  radius={[6, 6, 0, 0]}
                  stroke={COMPARISON_STROKE}
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                />
              ) : null}
              <Bar
                className="cursor-pointer"
                dataKey="value"
                fill={CURRENT_FILL}
                maxBarSize={26}
                radius={[6, 6, 0, 0]}
              />
            </RechartsBarChart>
          </ChartContainer>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: CURRENT_FILL }} />
              {currentLabel ?? t("current")}
            </span>
            {hasComparison ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-[3px] border border-dashed"
                  style={{ background: COMPARISON_FILL, borderColor: COMPARISON_STROKE }}
                />
                {comparisonLabel ?? t("comparison")}
              </span>
            ) : null}
            <span className="ms-auto">{t("clickHint")}</span>
          </div>
        </>
      )}
    </StatisticsSection>
  );
}

function DynamicsTooltip({
  active,
  comparisonLabel,
  currentLabel,
  formatValue,
  hasComparison,
  payload,
}: {
  active?: boolean;
  comparisonLabel: Nullable<string>;
  currentLabel: Nullable<string>;
  formatValue: (value: number) => string;
  hasComparison: boolean;
  payload?: readonly { payload: DynamicsPoint }[];
}) {
  const t = useTranslations("delivery.statistics.dynamics");
  const locale = useLocale();
  const point = payload?.[0]?.payload;
  if (active !== true || point === undefined) return null;

  const difference = point.comparisonValue === null ? null : point.value - point.comparisonValue;
  const percent =
    point.comparisonValue === null || point.comparisonValue === 0
      ? null
      : ((point.value - point.comparisonValue) / point.comparisonValue) * 100;

  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
      <div className="font-medium text-ink">{monthLabel(point.month, locale, true)}</div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">{currentLabel ?? t("current")}</dt>
        <dd className="text-end font-semibold text-ink tabular-nums">{formatValue(point.value)}</dd>
        {hasComparison && point.comparisonValue !== null ? (
          <>
            <dt className="text-muted-foreground">{comparisonLabel ?? t("comparison")}</dt>
            <dd className="text-end font-medium text-foreground tabular-nums">
              {formatValue(point.comparisonValue)}
            </dd>
            <dt className="text-muted-foreground">{t("difference")}</dt>
            <dd className="text-end font-medium text-foreground tabular-nums">
              {difference === null ? "—" : signed(difference, formatValue)}
              {percent === null ? null : (
                <span className="ms-1 text-muted-foreground">
                  ({signedPercent(percent, locale)})
                </span>
              )}
            </dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

function signed(value: number, formatValue: (value: number) => string): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatValue(Math.abs(value))}`;
}

function signedPercent(value: number, locale: string): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatPercentValue(Math.abs(value), locale)}`;
}
