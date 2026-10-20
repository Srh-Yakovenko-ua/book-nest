import type {
  CompletedReadsFilter,
  Nullable,
  ReadingStatisticsContextAction,
  ReadingStatisticsDrilldown,
  ReadingStatisticsSubsetFilter,
} from "@app/shared";

import { pickReadingStatisticsSubsetFilter } from "@app/shared";

export type StatisticsContextActionLink = {
  href: string;
  kind: ReadingStatisticsContextAction["kind"];
};

export type StatisticsDrilldownTarget =
  | { date: string; kind: "reading_day" }
  | { filter: ReadingStatisticsSubsetFilter; kind: "completed_reads_subset"; period: SubsetPeriod }
  | { from: string; kind: "completed_reads_interval"; to: string }
  | { kind: "reading_cycle"; readingCycleId: string }
  | { kind: "unsupported"; reason: StatisticsUnsupportedReason };

export type StatisticsUnsupportedReason = "COMPLETED_READS_SUBSET_HAS_NO_EXACT_DESTINATION";

type CompletedReadsSubsetDrilldown = Extract<
  ReadingStatisticsDrilldown,
  { kind: "completed_reads_subset" }
>;

type SubsetPeriod = CompletedReadsSubsetDrilldown["period"];

export function buildStatisticsDrilldownTarget(
  drilldown: ReadingStatisticsDrilldown,
): StatisticsDrilldownTarget {
  switch (drilldown.kind) {
    case "completed_reads_subset":
      return toCompletedReadsTarget(drilldown);
    case "reading_cycle":
      return { kind: "reading_cycle", readingCycleId: drilldown.readingCycleId };
    case "reading_day":
      return { date: drilldown.date, kind: "reading_day" };
  }
}

export function resolveReadingDayTarget(drilldown: ReadingStatisticsDrilldown): Nullable<string> {
  const target = buildStatisticsDrilldownTarget(drilldown);
  return target.kind === "reading_day" ? target.date : null;
}

export function toContextActionLink(
  action: ReadingStatisticsContextAction,
): StatisticsContextActionLink {
  switch (action.kind) {
    case "open_author":
      return { href: `/books?author=${action.authorId}`, kind: action.kind };
    case "open_book":
      return { href: `/books/${action.bookId}`, kind: action.kind };
    case "open_goal":
      return { href: `/goals/${action.goalId}`, kind: action.kind };
    case "open_publisher":
      return { href: `/publishers/${action.publisherId}`, kind: action.kind };
    case "open_series":
      return { href: `/series/${action.seriesId}`, kind: action.kind };
  }
}

export function toContextActionLinks(
  actions: readonly ReadingStatisticsContextAction[],
): StatisticsContextActionLink[] {
  return actions.map(toContextActionLink);
}

function toCompletedReadsTarget({
  filters,
  period,
}: CompletedReadsSubsetDrilldown): StatisticsDrilldownTarget {
  const { finishedFrom, finishedTo, ...narrowing } = filters;
  const isDateRangeOnly = Object.values(narrowing).every((value) => value === undefined);

  if (finishedFrom !== undefined && finishedTo !== undefined && isDateRangeOnly) {
    return { from: finishedFrom, kind: "completed_reads_interval", to: finishedTo };
  }

  const filter = toSingleSubsetFilter(filters);
  return filter === null
    ? { kind: "unsupported", reason: "COMPLETED_READS_SUBSET_HAS_NO_EXACT_DESTINATION" }
    : { filter, kind: "completed_reads_subset", period };
}

function toSingleSubsetFilter(
  filters: CompletedReadsFilter,
): Nullable<ReadingStatisticsSubsetFilter> {
  const setValues = Object.values(filters).filter((value) => value !== undefined);
  return setValues.length === 1 ? pickReadingStatisticsSubsetFilter(filters) : null;
}
