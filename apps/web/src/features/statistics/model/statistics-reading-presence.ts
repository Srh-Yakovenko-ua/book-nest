import type { ReadingStatisticsOverview } from "@app/shared";

import type { LibraryPresence } from "@/features/books";
import type { StatisticsControllerGetOverviewParams } from "@/shared/api/generated/model";

export type StatisticsAllTimeOverview =
  { kind: "error" } | { kind: "pending" } | { kind: "ready"; overview: ReadingStatisticsOverview };

export type StatisticsPresenceSignal = "completedReads" | "reading";

export type StatisticsReadingPresence =
  | { hasBooks: boolean; kind: "no_activity" }
  | { kind: "error"; retry: () => void }
  | { kind: "has_activity" }
  | { kind: "pending" }
  | { kind: "period_empty" };

export const STATISTICS_ALL_TIME_OVERVIEW_PARAMS = {
  period: "all_time",
} as const satisfies StatisticsControllerGetOverviewParams;

const PRESENCE_SIGNAL = {
  completedReads: (overview) => overview.kpis.completedReads.value > 0,
  reading: (overview) =>
    overview.kpis.completedReads.value > 0 ||
    (overview.kpis.pagesRead.value ?? 0) > 0 ||
    overview.calendar.activeDays > 0,
} satisfies Record<StatisticsPresenceSignal, (overview: ReadingStatisticsOverview) => boolean>;

export function hasStatisticsPresence({
  overview,
  signal,
}: {
  overview: ReadingStatisticsOverview;
  signal: StatisticsPresenceSignal;
}): boolean {
  return PRESENCE_SIGNAL[signal](overview);
}

export function needsAllTimeOverview({
  selected,
  signal,
}: {
  selected: ReadingStatisticsOverview;
  signal: StatisticsPresenceSignal;
}): boolean {
  return (
    selected.period.kind !== "all_time" && !hasStatisticsPresence({ overview: selected, signal })
  );
}

export function resolveStatisticsReadingPresence({
  allTime,
  library,
  selected,
  signal,
}: {
  allTime: StatisticsAllTimeOverview;
  library: LibraryPresence;
  selected: ReadingStatisticsOverview;
  signal: StatisticsPresenceSignal;
}): StatisticsReadingPresence {
  if (hasStatisticsPresence({ overview: selected, signal })) return { kind: "has_activity" };
  if (library.kind === "pending") return { kind: "pending" };

  if (selected.period.kind !== "all_time") {
    if (allTime.kind === "pending") return { kind: "pending" };
    if (allTime.kind === "error") return { kind: "period_empty" };
    if (hasStatisticsPresence({ overview: allTime.overview, signal })) {
      return { kind: "period_empty" };
    }
  }

  if (library.kind === "error") return { kind: "error", retry: library.retry };
  return { hasBooks: library.total > 0, kind: "no_activity" };
}
