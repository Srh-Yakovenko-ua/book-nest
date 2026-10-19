"use client";

import type { CompletedReadRef } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { RatingScore } from "@/components/ui/rating-score";

import { buildStatisticsDrilldownTarget } from "../model/statistics-drilldown";
import { formatDayLong, formatDayShort } from "../model/statistics-format";
import { CompletedReadDetails } from "./details/completed-read-details";
import { StatisticsBookCover } from "./details/statistics-book-cover";
import { StatisticsDetailSurface } from "./details/statistics-detail-surface";

type CompletedReadCardVariant = "ranking" | "recent";

export function CompletedReadCard({
  read,
  showFinishedAt = false,
  variant = "ranking",
}: {
  read: CompletedReadRef;
  showFinishedAt?: boolean;
  variant?: CompletedReadCardVariant;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.details.completedRead");
  const target = buildStatisticsDrilldownTarget(read.drilldown);
  const isDateShown = variant === "recent" || showFinishedAt || read.rating === null;
  const finishedAtLabel = showFinishedAt
    ? formatDayLong(read.finishedAt, locale)
    : formatDayShort(read.finishedAt, locale);

  const preview = (
    <span className="flex w-full flex-col gap-1.5">
      <StatisticsBookCover coverThumbUrl={read.book.coverThumbUrl} title={read.book.title} />
      <span className="line-clamp-2 text-xs font-medium text-foreground">{read.book.title}</span>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.6875rem] text-muted-foreground">
        {isDateShown ? <time dateTime={read.finishedAt}>{finishedAtLabel}</time> : null}
        {read.rating === null ? null : <RatingScore className="text-xs" value={read.rating} />}
      </span>
    </span>
  );

  if (target.kind !== "reading_cycle") {
    return <span className="flex w-full flex-col">{preview}</span>;
  }

  return (
    <StatisticsDetailSurface
      detail={() => <CompletedReadDetails read={read} />}
      label={t("open", { title: read.book.title })}
      title={read.book.title}
      triggerClassName="w-full rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {preview}
    </StatisticsDetailSurface>
  );
}
