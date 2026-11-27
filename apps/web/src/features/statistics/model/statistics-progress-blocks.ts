import type { ReadingStatisticsOverview } from "@app/shared";

const STATISTICS_PROGRESS_BLOCKS = {
  explainedFromHiddenCount: 2,
  order: ["libraryBalance", "series", "records"],
} as const;

export type StatisticsProgressBlock = (typeof STATISTICS_PROGRESS_BLOCKS.order)[number];

type StatisticsProgressBlocks = {
  explained: StatisticsProgressBlock[];
  shown: Record<StatisticsProgressBlock, boolean>;
};

type StatisticsProgressSource = Pick<
  ReadingStatisticsOverview,
  "libraryBalance" | "records" | "series"
>;

export function resolveStatisticsProgressBlocks({
  libraryBalance,
  records,
  series,
}: StatisticsProgressSource): StatisticsProgressBlocks {
  const shown = {
    libraryBalance: libraryBalance.currentOwnedTotal > 0,
    records: records.items.length > 0,
    series: series.availability !== "unavailable" && series.completedReadsCount > 0,
  } satisfies Record<StatisticsProgressBlock, boolean>;
  const hidden = STATISTICS_PROGRESS_BLOCKS.order.filter((block) => !shown[block]);

  return {
    explained: hidden.length >= STATISTICS_PROGRESS_BLOCKS.explainedFromHiddenCount ? hidden : [],
    shown,
  };
}
