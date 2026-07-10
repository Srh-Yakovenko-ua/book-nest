"use client";

import {
  Bar,
  CartesianGrid,
  LabelList,
  BarChart as RechartsBarChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const BAR_REST_FILL = "color-mix(in srgb, var(--chart-1) 52%, var(--card))";

type BarChartDatum = {
  fullLabel?: string;
  label: string;
  value: number;
};

type BarChartProps = {
  ariaLabel: string;
  className?: string;
  data: readonly BarChartDatum[];
  showValueLabels?: boolean;
  valueLabel: string;
};

const config = {
  value: { label: "Value", color: "var(--chart-1)" },
} satisfies ChartConfig;

function BarChart({
  data,
  valueLabel,
  ariaLabel,
  showValueLabels = true,
  className,
}: BarChartProps) {
  return (
    <ChartContainer
      aria-label={ariaLabel}
      className={cn("aspect-[16/9] w-full", className)}
      config={{ ...config, value: { ...config.value, label: valueLabel } }}
      role="img"
    >
      <RechartsBarChart
        data={data as BarChartDatum[]}
        margin={{ top: 20, right: 8, bottom: 0, left: 8 }}
      >
        <CartesianGrid
          stroke="var(--border)"
          strokeDasharray="3 4"
          syncWithTicks
          vertical={false}
        />
        <XAxis
          axisLine={{ stroke: "var(--border)" }}
          dataKey="label"
          tickLine={false}
          tickMargin={10}
        />
        <YAxis axisLine={false} tickLine={false} width={34} />
        <ChartTooltip
          content={<ChartTooltipContent labelKey="fullLabel" nameKey="value" />}
          cursor={false}
        />
        <Bar
          activeBar={{ fill: "var(--chart-1)" }}
          dataKey="value"
          fill={BAR_REST_FILL}
          maxBarSize={30}
          radius={[8, 8, 0, 0]}
        >
          {showValueLabels ? (
            <LabelList
              className="fill-ink text-[0.78rem] font-bold tabular-nums"
              dataKey="value"
              position="top"
            />
          ) : null}
        </Bar>
      </RechartsBarChart>
    </ChartContainer>
  );
}

export { BarChart };
export type { BarChartDatum };
