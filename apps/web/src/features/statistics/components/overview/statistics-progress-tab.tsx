"use client";

import type { ReadingStatisticsOverview } from "@app/shared";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { resolveStatisticsProgressBlocks } from "../../model/statistics-progress-blocks";
import { LibraryBalanceSection } from "../progress/library-balance-section";
import { ProgressPendingBlocks } from "../progress/progress-pending-blocks";
import { ReadingGoalCard } from "../progress/reading-goal-card";
import { RecordsSection } from "../progress/records-section";
import { SeriesSection } from "../progress/series-section";

const PROGRESS_GRID = {
  pair: "@3xl:grid-cols-2",
  row: "grid grid-cols-1 gap-4",
} as const;

export function StatisticsProgressTab({
  isLowerBound,
  overview,
}: {
  isLowerBound: boolean;
  overview: ReadingStatisticsOverview;
}) {
  const t = useTranslations("statistics.progressGroups");
  const blocks = resolveStatisticsProgressBlocks(overview);
  const showsPeriodGroup = blocks.shown.series || blocks.shown.records;

  return (
    <>
      <section
        aria-label={t("snapshot")}
        className={cn(PROGRESS_GRID.row, blocks.shown.libraryBalance && PROGRESS_GRID.pair)}
      >
        <ReadingGoalCard goal={overview.goal} variant="full" />
        {blocks.shown.libraryBalance ? (
          <LibraryBalanceSection libraryBalance={overview.libraryBalance} />
        ) : null}
      </section>
      {showsPeriodGroup ? (
        <section
          aria-label={t("period")}
          className={cn(
            PROGRESS_GRID.row,
            blocks.shown.series && blocks.shown.records && PROGRESS_GRID.pair,
          )}
        >
          {blocks.shown.series ? <SeriesSection series={overview.series} /> : null}
          {blocks.shown.records ? (
            <RecordsSection isLowerBound={isLowerBound} records={overview.records} />
          ) : null}
        </section>
      ) : null}
      {blocks.explained.length === 0 ? null : <ProgressPendingBlocks blocks={blocks.explained} />}
    </>
  );
}
