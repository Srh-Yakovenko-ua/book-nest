"use client";

import type { ReadingStatisticsRatingBucket } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

import { formatRatingScore, formatShare } from "../../model/statistics-format";

export function RatingDistribution({
  distribution,
}: {
  distribution: readonly ReadingStatisticsRatingBucket[];
}) {
  const t = useTranslations("statistics.ratings");
  const headingId = useId();
  const listId = useId();
  const [isFullScale, setIsFullScale] = useState(false);
  const ratedTotal = distribution.reduce((sum, bucket) => sum + bucket.completedReadCount, 0);
  const scale = [...distribution].sort((left, right) => right.rating - left.rating);
  const presentBuckets = scale.filter((bucket) => bucket.completedReadCount > 0);
  const hasHiddenBuckets = presentBuckets.length < scale.length;
  const visibleBuckets = isFullScale ? scale : presentBuckets;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          <span
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            id={headingId}
          >
            {t("distributionTitle")}
          </span>
          <TooltipHint label={t("distributionScaleHint")}>
            <button
              aria-label={t("distributionScaleHintLabel")}
              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              type="button"
            >
              <UiIcon aria-hidden name="info" size={13} />
            </button>
          </TooltipHint>
        </div>
        {hasHiddenBuckets ? (
          <Button
            aria-controls={listId}
            aria-expanded={isFullScale}
            onClick={() => setIsFullScale((value) => !value)}
            size="xs"
            variant="ghost"
          >
            {isFullScale ? t("distributionShowPresent") : t("distributionShowAll")}
            <UiIcon
              aria-hidden
              data-icon="inline-end"
              name={isFullScale ? "chevron-up" : "chevron-down"}
              size={12}
            />
          </Button>
        ) : null}
      </div>

      {visibleBuckets.length === 0 ? (
        <p className="text-xs text-muted-foreground" id={listId}>
          {t("distributionEmpty")}
        </p>
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-col gap-1" id={listId}>
          {visibleBuckets.map((bucket) => (
            <RatingDistributionRow bucket={bucket} key={bucket.rating} ratedTotal={ratedTotal} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RatingDistributionRow({
  bucket,
  ratedTotal,
}: {
  bucket: ReadingStatisticsRatingBucket;
  ratedTotal: number;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.ratings");
  const count = bucket.completedReadCount;
  const rating = formatRatingScore(bucket.rating, locale);
  const share = ratedTotal <= 0 ? 0 : count / ratedTotal;
  const percent = formatShare(share, locale);

  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className="w-10 shrink-0 text-xs text-muted-foreground tabular-nums">
        {rating}
      </span>
      <span
        aria-label={
          count > 0
            ? t("distributionRowShare", { count, percent, rating })
            : t("distributionRow", { count, rating })
        }
        className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
        role="img"
      >
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${share * 100}%` }}
        />
      </span>
      {count > 0 ? (
        <span
          aria-hidden
          className="min-w-16 shrink-0 text-end text-xs font-medium text-ink tabular-nums"
        >
          {t.rich("distributionCountShare", {
            count: formatNumber(count, locale),
            percent,
            share: (chunks) => <span className="font-normal text-muted-foreground">{chunks}</span>,
          })}
        </span>
      ) : (
        <span
          aria-hidden
          className="min-w-16 shrink-0 text-end text-xs text-muted-foreground tabular-nums"
        >
          {formatNumber(count, locale)}
        </span>
      )}
    </li>
  );
}
