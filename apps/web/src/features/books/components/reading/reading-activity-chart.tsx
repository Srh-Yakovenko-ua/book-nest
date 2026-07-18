"use client";

import type { ReadingActivityView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { Bar, CartesianGrid, BarChart as RechartsBarChart, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { formatDate, formatDateShort, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const BAR_REST_FILL = "color-mix(in srgb, var(--chart-1) 52%, var(--card))";
const BAR_ACTIVE_FILL = "var(--chart-1)";
const THIN_LABELS_THRESHOLD = 14;

const chartConfig = {
  pagesRead: { color: "var(--chart-1)", label: "pagesRead" },
} satisfies ChartConfig;

type ReadingActivityChartProps = {
  activity: ReadingActivityView;
  className?: string;
  isRefetching?: boolean;
};

export function ReadingActivityChart({
  activity,
  className,
  isRefetching = false,
}: ReadingActivityChartProps) {
  const t = useTranslations("books.details.reading");
  const locale = useLocale();

  const data = activity.points.map((point) => ({ date: point.date, pagesRead: point.pagesRead }));
  const tickInterval =
    activity.points.length > THIN_LABELS_THRESHOLD ? Math.ceil(activity.points.length / 8) : 0;

  const summaryParts = [
    t("activeDays", { count: activity.summary.activeDaysCount }),
    t("pagesUnit", { count: activity.summary.pagesRead }),
    activity.summary.averagePagesPerActiveDay === null
      ? null
      : t("averagePerActiveDay", {
          value: formatNumber(activity.summary.averagePagesPerActiveDay, locale, {
            maximumFractionDigits: 1,
          }),
        }),
  ].filter((part): part is string => part !== null);

  const summaryText = summaryParts.join(" · ");

  return (
    <div aria-busy={isRefetching} className="flex flex-col gap-2">
      <ChartContainer
        aria-label={summaryText}
        className={cn(
          "aspect-auto w-full transition-opacity",
          isRefetching && "opacity-50",
          className,
        )}
        config={chartConfig}
        role="img"
      >
        <RechartsBarChart data={data} margin={{ bottom: 0, left: 4, right: 8, top: 8 }}>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 4"
            syncWithTicks
            vertical={false}
          />
          <XAxis
            axisLine={{ stroke: "var(--border)" }}
            dataKey="date"
            interval={tickInterval}
            tickFormatter={(value: string) => formatDateShort(value, locale)}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={28} />
          <ChartTooltip
            content={(props) => {
              const { active, label } = props;
              if (active !== true || label === undefined) return null;
              const point = activity.points.find((entry) => entry.date === String(label));
              if (point === undefined) return null;
              return (
                <div className="grid min-w-40 gap-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs shadow-xl">
                  <span className="font-medium text-foreground">
                    {formatDate(point.date, locale)}
                  </span>
                  {point.hasActivity ? (
                    <>
                      <span className="text-muted-foreground">
                        {t("pagesUnit", { count: point.pagesRead })}
                      </span>
                      <span className="text-muted-foreground">
                        {t("updatesCount", { count: point.updatesCount })}
                      </span>
                      {point.startPage === null || point.finalPage === null ? null : (
                        <span className="text-muted-foreground">
                          {t("tooltipRange", { final: point.finalPage, start: point.startPage })}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">{t("tooltipNoUpdates")}</span>
                  )}
                </div>
              );
            }}
            cursor={{ fill: "color-mix(in srgb, var(--muted) 60%, transparent)" }}
          />
          <Bar
            activeBar={{ fill: BAR_ACTIVE_FILL }}
            dataKey="pagesRead"
            fill={BAR_REST_FILL}
            maxBarSize={28}
            radius={[6, 6, 0, 0]}
          />
        </RechartsBarChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground tabular-nums">{summaryText}</p>
    </div>
  );
}
