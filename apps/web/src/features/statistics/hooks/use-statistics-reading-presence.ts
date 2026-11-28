"use client";

import type { ReadingStatisticsOverview } from "@app/shared";

import { useLibraryPresence } from "@/features/books";

import type {
  StatisticsAllTimeOverview,
  StatisticsPresenceSignal,
  StatisticsReadingPresence,
} from "../model/statistics-reading-presence";

import { useReadingStatisticsOverview } from "../api/use-reading-statistics-overview";
import {
  needsAllTimeOverview,
  resolveStatisticsReadingPresence,
  STATISTICS_ALL_TIME_OVERVIEW_PARAMS,
} from "../model/statistics-reading-presence";

export function useStatisticsReadingPresence({
  selected,
  signal,
}: {
  selected: ReadingStatisticsOverview;
  signal: StatisticsPresenceSignal;
}): StatisticsReadingPresence {
  const allTimeQuery = useReadingStatisticsOverview(STATISTICS_ALL_TIME_OVERVIEW_PARAMS, {
    enabled: needsAllTimeOverview({ selected, signal }),
  });
  const library = useLibraryPresence();

  return resolveStatisticsReadingPresence({
    allTime: toAllTimeOverview(allTimeQuery),
    library,
    selected,
    signal,
  });
}

function toAllTimeOverview(query: {
  data: ReadingStatisticsOverview | undefined;
  isError: boolean;
}): StatisticsAllTimeOverview {
  if (query.data !== undefined) return { kind: "ready", overview: query.data };
  if (query.isError) return { kind: "error" };
  return { kind: "pending" };
}
