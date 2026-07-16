"use client";

import type { ReadingHistorySummaryView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { type UiIconName } from "@/components/icons";
import { formatDate, formatNumber } from "@/lib/format";

import { ReadingMetricItem } from "../reading/reading-metric-item";

type Metric = {
  hint?: string;
  icon: UiIconName;
  key: string;
  value: string;
};

type ReadingProgressStatsProps = {
  summary: ReadingHistorySummaryView;
};

export function ReadingProgressStats({ summary }: ReadingProgressStatsProps) {
  const t = useTranslations("books.details.reading");
  const locale = useLocale();

  const metrics: Metric[] = [];

  if (summary.activeDaysCount > 0) {
    metrics.push({
      icon: "calendar",
      key: "activeDays",
      value: t("activeDays", { count: summary.activeDaysCount }),
    });
  }

  if (summary.averagePagesPerActiveDay !== null) {
    metrics.push({
      icon: "chart",
      key: "average",
      value: t("averagePerActiveDay", {
        value: formatNumber(summary.averagePagesPerActiveDay, locale, {
          maximumFractionDigits: 1,
        }),
      }),
    });
  }

  if (summary.bestDay !== null) {
    metrics.push({
      hint: formatDate(summary.bestDay.date, locale),
      icon: "trophy",
      key: "bestDay",
      value: t("bestDay", { pages: summary.bestDay.pagesRead }),
    });
  }

  if (metrics.length === 0) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {metrics.map((metric) => (
        <ReadingMetricItem
          hint={metric.hint}
          icon={metric.icon}
          key={metric.key}
          value={metric.value}
        />
      ))}
    </div>
  );
}
