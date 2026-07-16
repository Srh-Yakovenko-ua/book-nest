"use client";

import type { ReadingHistorySummaryView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { type UiIconName } from "@/components/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { readingStatuses } from "@/lib/book-status";
import { formatDate, formatNumber } from "@/lib/format";

import { ReadingMetricItem } from "../reading/reading-metric-item";
import { ReadingProgressBar } from "../reading/reading-progress-bar";

type Metric = {
  hint?: string;
  icon: UiIconName;
  key: string;
  value: string;
};

type ReadingHistoryOverviewProps = {
  summary: ReadingHistorySummaryView;
};

export function ReadingHistoryOverview({ summary }: ReadingHistoryOverviewProps) {
  const t = useTranslations("books.details.reading");
  const tHistory = useTranslations("books.details.readingHistory");
  const tStatus = useTranslations("books.readingStatus.options");
  const locale = useLocale();

  const statusBase = readingStatuses.find((entry) => entry.value === summary.status);

  const period = summary.readingPeriod;
  const periodParts: string[] = [];
  if (period.startDate !== null) {
    const range = [formatDate(period.startDate, locale)];
    if (period.endDate !== null) range.push(formatDate(period.endDate, locale));
    periodParts.push(range.join(" – "));
  }
  if (period.calendarDays !== null) {
    periodParts.push(t("daysUnit", { count: period.calendarDays }));
  }

  const metrics: Metric[] = [];
  if (summary.activeDaysCount > 0) {
    metrics.push({
      icon: "calendar",
      key: "activeDays",
      value: t("activeDays", { count: summary.activeDaysCount }),
    });
  }
  if (summary.updatesCount > 0) {
    metrics.push({
      icon: "edit",
      key: "updates",
      value: t("updatesCount", { count: summary.updatesCount }),
    });
  }
  if (summary.averagePagesPerActiveDay !== null) {
    metrics.push({
      icon: "chart",
      key: "average",
      value: t("averagePerActiveDay", {
        value: formatNumber(summary.averagePagesPerActiveDay, locale, { maximumFractionDigits: 1 }),
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

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 shadow-detail-block sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {statusBase === undefined ? null : (
          <StatusBadge entry={{ ...statusBase, label: tStatus(summary.status) }} />
        )}
        {periodParts.length === 0 ? null : (
          <div className="flex items-baseline gap-1.5 text-xs text-muted-foreground tabular-nums">
            <span>{tHistory("periodLabel")}:</span>
            <span className="text-foreground/90">{periodParts.join(" · ")}</span>
          </div>
        )}
      </div>

      <ReadingProgressBar
        currentPage={summary.currentPage}
        muted={summary.status === "dnf"}
        pagesCount={summary.pagesCount}
        percent={summary.progressPercent}
      />

      {metrics.length === 0 ? null : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <ReadingMetricItem
              hint={metric.hint}
              icon={metric.icon}
              key={metric.key}
              value={metric.value}
            />
          ))}
        </div>
      )}
    </section>
  );
}
