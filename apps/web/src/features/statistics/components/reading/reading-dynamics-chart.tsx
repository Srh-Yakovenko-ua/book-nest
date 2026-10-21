"use client";

import type { Nullable } from "@app/shared";
import type { KeyboardEvent, Ref } from "react";

import { useLocale, useTranslations } from "next-intl";
import { useImperativeHandle, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  type LabelListProps,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";

import type { ChartConfig } from "@/components/ui/chart";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { DynamicsMetric, DynamicsPoint } from "../../model/statistics-dynamics";

import { formatDayRange } from "../../model/statistics-format";

const CURRENT_FILL = "var(--chart-1)";

const COMPARISON_STROKE = "var(--chart-4)";

const COMPARISON_FILL = "color-mix(in srgb, var(--chart-4) 18%, var(--card))";

const DIMMED_OPACITY = 0.45;

const ActiveIndexSchema = z.coerce.number().int().nonnegative();

const CHART_HEIGHT = {
  compact: "h-44 sm:h-48",
  full: "h-[16rem] sm:h-[20rem]",
} as const satisfies Record<DynamicsChartVariant, string>;

const CHART_FRAME = {
  marginTop: 8,
  marginX: 4,
  valueLabelMarginTop: 16,
  yAxisWidth: 36,
} as const;

const VALUE_LABEL = {
  charWidth: 7.5,
  fill: "var(--muted-foreground)",
  gap: 6,
  offset: 4,
} as const;

export type DynamicsChartHandle = { focusBucket: (key: string) => void };

export type DynamicsChartVariant = "compact" | "full";

export type DynamicsLegendRanges = {
  comparison: Nullable<string>;
  current: Nullable<string>;
};

type ValueLabelEntry = Parameters<NonNullable<LabelListProps["valueAccessor"]>>[0];

export function ReadingDynamicsChart({
  legend,
  metric,
  onOpenBucket,
  openKey,
  points,
  ref,
  variant,
}: {
  legend: DynamicsLegendRanges;
  metric: DynamicsMetric;
  onOpenBucket: (key: string) => void;
  openKey: Nullable<string>;
  points: DynamicsPoint[];
  ref?: Ref<DynamicsChartHandle>;
  variant: DynamicsChartVariant;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.dynamics");
  const isMobile = useIsMobile();
  const [focusedKey, setFocusedKey] = useState<Nullable<string>>(null);
  const [rovingKey, setRovingKey] = useState<Nullable<string>>(null);
  const bucketButtons = useRef(new Map<string, HTMLButtonElement>());

  useImperativeHandle(ref, () => ({
    focusBucket: (key) => bucketButtons.current.get(key)?.focus(),
  }));

  const tabStopKey = points.some((point) => point.key === rovingKey)
    ? rovingKey
    : (points[0]?.key ?? null);
  const selectedKey = focusedKey ?? openKey;

  function moveBucketFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const nextIndex = nextBucketIndex({ index, key: event.key, lastIndex: points.length - 1 });
    const next = nextIndex === null ? undefined : points[nextIndex];
    if (next === undefined) return;
    event.preventDefault();
    setRovingKey(next.key);
    bucketButtons.current.get(next.key)?.focus();
  }

  const hasComparison = points.some((point) => point.comparisonBucket !== null);
  const showsValueLabels = variant === "compact" && !hasComparison;
  const longestValueLabel = Math.max(
    0,
    ...points.map((point) => formatNumber(point.value, locale).length),
  );
  const config = {
    comparisonValue: { color: COMPARISON_STROKE, label: t("comparison") },
    value: { color: CURRENT_FILL, label: t("current") },
  } satisfies ChartConfig;

  return (
    <>
      <ol aria-label={t("bucketsLabel")} className="sr-only">
        {points.map((point, index) => (
          <li key={point.key}>
            <button
              aria-expanded={point.key === openKey}
              onBlur={() => setFocusedKey(null)}
              onClick={() => onOpenBucket(point.key)}
              onFocus={() => {
                setFocusedKey(point.key);
                setRovingKey(point.key);
              }}
              onKeyDown={(event) => moveBucketFocus(event, index)}
              ref={(node) => {
                if (node === null) return;
                bucketButtons.current.set(point.key, node);
                return () => {
                  bucketButtons.current.delete(point.key);
                };
              }}
              tabIndex={point.key === tabStopKey ? 0 : -1}
              type="button"
            >
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
            </button>
          </li>
        ))}
      </ol>
      <ChartContainer
        aria-hidden
        className={cn(
          "aspect-auto w-full cursor-pointer rounded-lg",
          CHART_HEIGHT[variant],
          focusedKey !== null && "ring-[3px] ring-ring/50",
        )}
        config={config}
      >
        <ComposedChart
          accessibilityLayer={false}
          data={points}
          margin={{
            left: CHART_FRAME.marginX,
            right: CHART_FRAME.marginX,
            top: showsValueLabels ? CHART_FRAME.valueLabelMarginTop : CHART_FRAME.marginTop,
          }}
          onClick={(state) => {
            const index = ActiveIndexSchema.safeParse(state.activeIndex);
            const point = index.success ? points[index.data] : undefined;
            if (point !== undefined) onOpenBucket(point.key);
          }}
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
            width={CHART_FRAME.yAxisWidth}
          />
          <ChartTooltip content={<DynamicsTooltip metric={metric} />} />
          {hasComparison && variant === "full" ? (
            <ChartLegend content={<ChartLegendContent />} />
          ) : null}
          {hasComparison && variant === "compact" ? (
            <Bar
              dataKey="comparisonValue"
              fill={COMPARISON_FILL}
              maxBarSize={20}
              radius={[4, 4, 0, 0]}
              stroke={COMPARISON_STROKE}
              strokeDasharray="3 3"
              strokeWidth={1.5}
            />
          ) : null}
          <Bar
            dataKey="value"
            fill={CURRENT_FILL}
            maxBarSize={variant === "compact" ? 20 : 44}
            radius={[4, 4, 0, 0]}
          >
            {points.map((point) => (
              <Cell
                fillOpacity={selectedKey === null || point.key === selectedKey ? 1 : DIMMED_OPACITY}
                key={point.key}
              />
            ))}
            {showsValueLabels ? (
              <LabelList
                className="text-xs font-medium tabular-nums"
                fill={VALUE_LABEL.fill}
                offset={VALUE_LABEL.offset}
                position="top"
                valueAccessor={(entry) =>
                  compactValueLabel({ entry, locale, longestValueLabel, slots: points.length })
                }
              />
            ) : null}
          </Bar>
          {hasComparison && variant === "full" ? (
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
      {hasComparison && variant === "compact" ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: CURRENT_FILL }} />
            {legend.current === null ? t("current") : t("legendCurrent", { range: legend.current })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2 rounded-full border border-dashed"
              style={{ background: COMPARISON_FILL, borderColor: COMPARISON_STROKE }}
            />
            {legend.comparison === null
              ? t("comparison")
              : t("legendComparison", { range: legend.comparison })}
          </span>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">{t("openHint")}</p>
    </>
  );
}

function compactValueLabel({
  entry,
  locale,
  longestValueLabel,
  slots,
}: {
  entry: ValueLabelEntry;
  locale: string;
  longestValueLabel: number;
  slots: number;
}): string | undefined {
  const { parentViewBox: chart, value } = entry;
  if (typeof value !== "number" || value <= 0) return undefined;
  if (chart === undefined || !("width" in chart)) return undefined;

  const plotWidth = chart.width - CHART_FRAME.yAxisWidth - CHART_FRAME.marginX * 2;
  const barSlotWidth = plotWidth / slots;
  const labelWidth = longestValueLabel * VALUE_LABEL.charWidth + VALUE_LABEL.gap;
  return labelWidth <= barSlotWidth ? formatNumber(value, locale) : undefined;
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

function nextBucketIndex({
  index,
  key,
  lastIndex,
}: {
  index: number;
  key: string;
  lastIndex: number;
}): Nullable<number> {
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return Math.min(index + 1, lastIndex);
    case "ArrowLeft":
    case "ArrowUp":
      return Math.max(index - 1, 0);
    case "End":
      return lastIndex;
    case "Home":
      return 0;
    default:
      return null;
  }
}
