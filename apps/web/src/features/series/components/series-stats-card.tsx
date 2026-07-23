"use client";

import type { SeriesDetailsView, SeriesStatsView } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingScore } from "@/components/ui/rating-score";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type DetailRow = {
  icon?: UiIconName;
  iconClassName?: string;
  key: string;
  label: string;
  value: ReactNode;
};

type MetricTone = "primary" | "success";

type SeriesStatMetricProps = {
  className?: string;
  icon: UiIconName;
  label: string;
  tone?: MetricTone;
  value: ReactNode;
  valueLabel?: string;
};

type SeriesStatsCardProps = {
  stats: SeriesStatsView;
  totalBooks: SeriesDetailsView["totalBooks"];
};

const MAX_DETAIL_ROWS = 2;

const metricToneClass: Record<MetricTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success-soft text-success",
};

export function SeriesStatsCard({ stats, totalBooks }: SeriesStatsCardProps) {
  const t = useTranslations("series.details.stats");
  const locale = useLocale();

  const totalBooksValue = totalBooks === null ? "—" : formatNumber(totalBooks, locale);

  const readPagesValue =
    stats.readPagesCount === null
      ? "—"
      : `${formatNumber(stats.readPagesCount, locale)}${stats.readPagesPartial ? "+" : ""}`;
  const readPagesLabel =
    stats.readPagesCount !== null && stats.readPagesPartial
      ? t("partialPagesLabel", { count: stats.readPagesCount })
      : undefined;

  const detailCandidates: DetailRow[] = [];

  if (stats.averageRating !== null) {
    detailCandidates.push({
      key: "averageRating",
      label: t("averageRating"),
      value: <RatingScore value={stats.averageRating} />,
    });
  }

  if (stats.favoriteBook !== null) {
    detailCandidates.push({
      icon: "heart-fill",
      iconClassName: "text-favorite",
      key: "favoriteBook",
      label: t("favoriteBook"),
      value: <FavoriteBookValue title={stats.favoriteBook.title} />,
    });
  }

  if (stats.lastFinishedAt !== null) {
    detailCandidates.push({
      icon: "clock",
      key: "lastFinishedAt",
      label: t("lastFinishedAt"),
      value: formatDate(stats.lastFinishedAt, locale),
    });
  }

  if (stats.startedAt !== null) {
    detailCandidates.push({
      icon: "calendar",
      key: "startedAt",
      label: t("startedAt"),
      value: formatDate(stats.startedAt, locale),
    });
  }

  if (stats.averagePages !== null) {
    detailCandidates.push({
      icon: "ruler",
      key: "averagePages",
      label: t("averagePages"),
      value: formatNumber(stats.averagePages, locale),
    });
  }

  if (stats.readingDurationDays !== null) {
    detailCandidates.push({
      icon: "clock",
      key: "readingDuration",
      label: t("readingDuration"),
      value: t("days", { count: stats.readingDurationDays }),
    });
  }

  const detailRows = detailCandidates.slice(0, MAX_DETAIL_ROWS);

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2">
          <SeriesStatMetric
            className="border-r border-b border-border pr-3 pb-4"
            icon="book"
            label={t("totalBooks")}
            value={totalBooksValue}
          />
          <SeriesStatMetric
            className="border-b border-border pb-4 pl-3"
            icon="library"
            label={t("inLibrary")}
            value={formatNumber(stats.booksCount, locale)}
          />
          <SeriesStatMetric
            className="border-r border-border pt-4 pr-3"
            icon="check-circle"
            label={t("finished")}
            tone="success"
            value={formatNumber(stats.finishedCount, locale)}
          />
          <SeriesStatMetric
            className="pt-4 pl-3"
            icon="pages"
            label={t("pagesRead")}
            value={readPagesValue}
            valueLabel={readPagesLabel}
          />
        </dl>

        {detailRows.length > 0 ? (
          <>
            <Separator className="my-4" />
            <dl className="flex flex-col gap-3">
              {detailRows.map(({ key, ...row }) => (
                <SeriesStatDetailRow key={key} {...row} />
              ))}
            </dl>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FavoriteBookValue({ title }: { title: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block truncate text-left">{title}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{title}</TooltipContent>
    </Tooltip>
  );
}

function SeriesStatDetailRow({ icon, iconClassName, label, value }: Omit<DetailRow, "key">) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        {icon === undefined ? null : (
          <UiIcon
            aria-hidden
            className={cn("text-muted-foreground", iconClassName)}
            name={icon}
            size={15}
          />
        )}
        <span>{label}</span>
      </dt>
      <dd className="min-w-0 text-right text-sm font-medium text-foreground/90 tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function SeriesStatMetric({
  className,
  icon,
  label,
  tone = "primary",
  value,
  valueLabel,
}: SeriesStatMetricProps) {
  return (
    <div className={cn("flex min-h-[3.5rem] items-start gap-3", className)}>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          metricToneClass[tone],
        )}
      >
        <UiIcon aria-hidden name={icon} size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col-reverse gap-1">
        <dt className="text-[11px] leading-4 text-muted-foreground">{label}</dt>
        <dd
          aria-label={valueLabel}
          className="font-heading text-xl leading-none font-semibold text-foreground tabular-nums"
        >
          {value}
        </dd>
      </div>
    </div>
  );
}
