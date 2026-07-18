"use client";

import type { SeriesDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";

import { buildSeriesSlots } from "../model/series-details-derive";

export function SeriesBooksSummary({ details }: { details: SeriesDetailsView }) {
  const t = useTranslations("series.details");

  const missingCount = buildSeriesSlots({
    books: details.books,
    totalBooks: details.totalBooks,
  }).filter((slot) => slot.kind === "missing").length;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-muted-foreground tabular-nums">
      <span className="text-success">
        {t("summary.finished", { count: details.stats.finishedCount })}
      </span>
      <span aria-hidden className="text-border">
        ·
      </span>
      <span>
        {t("summary.remaining", {
          count: details.stats.booksCount - details.stats.finishedCount,
        })}
      </span>
      {missingCount === 0 ? null : (
        <>
          <span aria-hidden className="text-border">
            ·
          </span>
          <span>{t("summary.notAdded", { count: missingCount })}</span>
        </>
      )}
    </p>
  );
}
