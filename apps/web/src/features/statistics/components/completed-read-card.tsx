"use client";

import type { CompletedReadRef } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { TruncatedText } from "@/components/truncated-text";
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
  const isDateShown = showFinishedAt || read.rating === null;
  const finishedAtLabel = showFinishedAt
    ? formatDayLong(read.finishedAt, locale)
    : formatDayShort(read.finishedAt, locale);

  const recentPreview = (
    <span className="group/recent flex w-full flex-col gap-2">
      <StatisticsBookCover
        className="shadow-soft transition-shadow duration-150 group-hover/recent:shadow-hover"
        coverThumbUrl={read.book.coverThumbUrl}
        placeholder="titled"
        title={read.book.title}
      />
      <TruncatedText
        className="min-h-10 text-sm font-medium break-words text-foreground"
        lines={2}
        text={read.book.title}
      />
      <span className="flex min-h-5 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <time className="whitespace-nowrap" dateTime={read.finishedAt}>
          {finishedAtLabel}
        </time>
        {read.rating === null ? null : <RatingScore className="text-xs" value={read.rating} />}
      </span>
    </span>
  );

  const rankingPreview = (
    <span className="flex w-full flex-col gap-1.5">
      <StatisticsBookCover coverThumbUrl={read.book.coverThumbUrl} title={read.book.title} />
      <span className="line-clamp-2 text-xs font-medium text-foreground">{read.book.title}</span>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.6875rem] text-muted-foreground">
        {isDateShown ? <time dateTime={read.finishedAt}>{finishedAtLabel}</time> : null}
        {read.rating === null ? null : <RatingScore className="text-xs" value={read.rating} />}
      </span>
    </span>
  );

  const preview = variant === "recent" ? recentPreview : rankingPreview;

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
