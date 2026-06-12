"use client";

import * as React from "react";
import { Area, CartesianGrid, Line, LineChart as RechartsLineChart, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-3)",
  "var(--chart-2)",
] as const;

type LineChartProps = {
  area?: boolean;
  ariaLabel: string;
  className?: string;
  data: readonly Record<string, number | string>[];
  series: readonly LineChartSeries[];
};

type LineChartSeries = {
  color?: string;
  key: string;
  label: string;
};

function LineChart({ data, series, ariaLabel, area = false, className }: LineChartProps) {
  const config = React.useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        series.map((entry, index) => [
          entry.key,
          { label: entry.label, color: entry.color ?? CHART_PALETTE[index % CHART_PALETTE.length] },
        ]),
      ),
    [series],
  );

  const showLegend = series.length > 1;

  return (
    <ChartContainer
      aria-label={ariaLabel}
      className={cn("aspect-[16/9] w-full", className)}
      config={config}
    >
      <RechartsLineChart
        data={data as Record<string, number | string>[]}
        margin={{ top: 12, right: 12, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={10} />
        <YAxis axisLine={false} tickLine={false} width={34} />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ stroke: "var(--border)" }} />
        {showLegend ? <ChartLegend content={<ChartLegendContent />} verticalAlign="top" /> : null}
        {area
          ? series.map((entry) => (
              <Area
                dataKey={entry.key}
                fill={`var(--color-${entry.key})`}
                fillOpacity={0.16}
                key={`${entry.key}-area`}
                stroke="none"
                type="monotone"
              />
            ))
          : null}
        {series.map((entry) => (
          <Line
            activeDot={{ r: 5, fill: "var(--card)", strokeWidth: 2 }}
            dataKey={entry.key}
            dot={false}
            key={entry.key}
            stroke={`var(--color-${entry.key})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            type="monotone"
          />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  );
}

export { LineChart };
export type { LineChartSeries };
