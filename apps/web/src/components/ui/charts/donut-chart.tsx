"use client";

import * as React from "react";
import { Cell, Pie, PieChart } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-2)",
] as const;

type DonutChartProps = {
  ariaLabel: string;
  centerCaption?: React.ReactNode;
  centerLabel?: React.ReactNode;
  centerValue?: React.ReactNode;
  className?: string;
  data: readonly DonutSlice[];
};

type DonutSlice = {
  label: string;
  value: number;
};

function DonutChart({
  data,
  centerLabel,
  centerValue,
  centerCaption,
  ariaLabel,
  className,
}: DonutChartProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  const config = React.useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        data.map((slice, index) => [
          slice.label,
          { label: slice.label, color: CHART_PALETTE[index % CHART_PALETTE.length] },
        ]),
      ),
    [data],
  );

  const resolvedValue = centerValue ?? total;

  return (
    <div className={cn("flex flex-wrap items-center gap-7", className)}>
      <div className="relative size-[200px] shrink-0">
        <ChartContainer aria-label={ariaLabel} className="aspect-square size-full" config={config}>
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent hideLabel nameKey="label" />}
              cursor={false}
            />
            <Pie
              cornerRadius={4}
              data={data as DonutSlice[]}
              dataKey="value"
              innerRadius="62%"
              nameKey="label"
              outerRadius="100%"
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((slice, index) => (
                <Cell
                  fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                  key={slice.label}
                  stroke="var(--card)"
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-px text-center">
          {centerLabel === undefined ? null : (
            <span className="text-xs font-semibold text-muted-foreground">{centerLabel}</span>
          )}
          <span className="font-heading text-[2rem] leading-[1.05] font-bold text-ink tabular-nums">
            {resolvedValue}
          </span>
          {centerCaption === undefined ? null : (
            <span className="text-[0.8rem] text-muted-foreground">{centerCaption}</span>
          )}
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 basis-[220px] flex-col gap-0.5">
        {data.map((slice, index) => {
          const percent = total <= 0 ? 0 : Math.round((slice.value / total) * 100);

          return (
            <li
              className="flex max-w-full items-center gap-2.5 rounded-md px-3 py-2.5"
              key={slice.label}
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-[3px]"
                style={{ backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-ink">
                {slice.label}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                {slice.value} ({percent}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { DonutChart };
export type { DonutSlice };
