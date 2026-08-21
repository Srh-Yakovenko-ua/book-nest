"use client";

import { useQueryStates } from "nuqs";

import type { ReadingQueueControllerGetQueueParams } from "@/shared/api/generated/model";

import type { ReadingQueueQueryState } from "./reading-queue-query";

import {
  countActiveReadingQueueFilters,
  hasActiveReadingQueueSearch,
  READING_QUEUE_FILTERS_RESET,
  readingQueueQueryParsers,
  toReadingQueueParams,
} from "./reading-queue-query";

export type UseReadingQueueQueryResult = {
  activeFilterCount: number;
  clearAll: () => void;
  clearFilters: () => void;
  clearSearch: () => void;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  isFiltered: boolean;
  listParams: ReadingQueueControllerGetQueueParams;
  setSearch: (value: string) => void;
  setState: ReturnType<typeof useQueryStates<typeof readingQueueQueryParsers>>[1];
  state: ReadingQueueQueryState;
};

export function useReadingQueueQuery(): UseReadingQueueQueryResult {
  const [state, setState] = useQueryStates(readingQueueQueryParsers);
  const activeFilterCount = countActiveReadingQueueFilters(state);
  const hasActiveSearch = hasActiveReadingQueueSearch(state);

  return {
    activeFilterCount,
    clearAll: () => void setState({ q: null, ...READING_QUEUE_FILTERS_RESET }),
    clearFilters: () => void setState(READING_QUEUE_FILTERS_RESET),
    clearSearch: () => void setState({ q: null }),
    hasActiveFilters: activeFilterCount > 0,
    hasActiveSearch,
    isFiltered: activeFilterCount > 0 || hasActiveSearch,
    listParams: toReadingQueueParams(state),
    setSearch: (value) => void setState({ q: value }),
    setState,
    state,
  };
}
