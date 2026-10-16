"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import type { ChartConfig } from "@/components/ui/chart";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatNumber } from "@/lib/format";

import type { DynamicsMetric, DynamicsPoint } from "../../model/statistics-dynamics";

import { formatDayRange } from "../../model/statistics-format";

const CURRENT_FILL = "var(--chart-1)";

const COMPARISON_STROKE = "var(--chart-4)";

export function ReadingDynamicsChart({
  metric,
  points,
}: {
  metric: DynamicsMetric;
  points: DynamicsPoint[];
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.dynamics");
  const isMobile = useIsMobile();

  const hasComparison = points.some((point) => point.comparisonBucket !== null);
  const config = {
    comparisonValue: { color: COMPARISON_STROKE, label: t("comparison") },
    value: { color: CURRENT_FILL, label: t("current") },
  } satisfies ChartConfig;

  return (
    <>
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.key}>
            {t("srBucket", {
              pages: point.bucket.pagesRead,
              range:
                formatDayRange({ from: point.bucket.start, locale, to: point.bucket.end }) ??
                point.label,
              reads: point.bucket.completedReads,
            })}
            {point.comparisonBucket === null || point.comparisonValue === null ? null : (
              <>
                {" "}
                {t("srComparison", {
                  metric: t(`metrics.${metric}`),
                  range:
                    formatDayRange({
                      from: point.comparisonBucket.start,
                      locale,
                      to: point.comparisonBucket.end,
                    }) ?? point.comparisonBucket.start,
                  value: formatNumber(point.comparisonValue, locale),
                })}
              </>
            )}
          </li>
        ))}
      </ul>
      <ChartContainer
        aria-hidden
        className="aspect-auto h-[16rem] w-full sm:h-[20rem]"
        config={config}
      >
        <ComposedChart
          accessibilityLayer={false}
          data={points}
          margin={{ left: 4, right: 4, top: 8 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey={isMobile ? "compactLabel" : "label"}
            interval="preserveStartEnd"
            minTickGap={isMobile ? 4 : 8}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickFormatter={(value: number) => formatNumber(value, locale)}
            tickLine={false}
            width={36}
          />
          <ChartTooltip content={<DynamicsTooltip metric={metric} />} />
          {hasComparison ? <ChartLegend content={<ChartLegendContent />} /> : null}
          <Bar dataKey="value" fill={CURRENT_FILL} maxBarSize={44} radius={[4, 4, 0, 0]} />
          {hasComparison ? (
            <Line
              dataKey="comparisonValue"
              dot={false}
              stroke={COMPARISON_STROKE}
              strokeDasharray="4 3"
              strokeWidth={2}
              type="monotone"
            />
          ) : null}
        </ComposedChart>
      </ChartContainer>
    </>
  );
}

function DynamicsTooltip({
  metric,
  payload,
}: {
  metric: DynamicsMetric;
  payload?: { payload: DynamicsPoint }[];
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.dynamics");
  const point = payload?.[0]?.payload;

  if (point === undefined) return null;

  const comparisonBucket = point.comparisonBucket;

  return (
    <div className="flex max-w-64 flex-col gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">{t("current")}</span>
        <span className="font-medium text-foreground">
          {formatDayRange({ from: point.bucket.start, locale, to: point.bucket.end }) ??
            point.label}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {t("tooltip.reads", { count: point.bucket.completedReads })}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {t("tooltip.uniqueBooks", { count: point.bucket.uniqueBooksCompleted })}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {t("tooltip.pages", { count: point.bucket.pagesRead })}
        </span>
      </div>
      {comparisonBucket === null || point.comparisonValue === null ? null : (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          <span className="text-muted-foreground">{t("comparison")}</span>
          <span className="font-medium text-foreground">
            {formatDayRange({ from: comparisonBucket.start, locale, to: comparisonBucket.end }) ??
              comparisonBucket.start}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {t("tooltip.comparison", {
              metric: t(`metrics.${metric}`),
              value: formatNumber(point.comparisonValue, locale),
            })}
          </span>
        </div>
      )}
    </div>
  );
}
