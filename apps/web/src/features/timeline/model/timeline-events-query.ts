import type {
  Nullable,
  TimelineEventSort,
  TimelineEventType,
  TimelineImportance,
} from "@app/shared";

import type { TimelineEventsControllerListEventsParams } from "@/shared/api/generated/model";

export type TimelineEventsFilterState = {
  eventType: TimelineEventType[];
  importance: TimelineImportance[];
  recap: boolean;
  search: string;
  sort: TimelineEventSort;
  timelineId: Nullable<string>;
  unresolved: boolean;
};

export function createFilterState(timelineId: Nullable<string>): TimelineEventsFilterState {
  return {
    eventType: [],
    importance: [],
    recap: false,
    search: "",
    sort: defaultEventSort(timelineId),
    timelineId,
    unresolved: false,
  };
}

export function defaultEventSort(timelineId: Nullable<string>): TimelineEventSort {
  return timelineId === null ? "book_order" : "timeline_order";
}

export const ALL_LINES_SORT_OPTIONS: readonly TimelineEventSort[] = [
  "book_order",
  "importance",
  "newest",
  "oldest",
];

export const LINE_SORT_OPTIONS: readonly TimelineEventSort[] = [
  "timeline_order",
  "book_order",
  "importance",
  "newest",
  "oldest",
];

export function hasActiveEventFilters(state: TimelineEventsFilterState): boolean {
  return (
    state.search.trim().length > 0 ||
    state.eventType.length > 0 ||
    state.importance.length > 0 ||
    state.unresolved ||
    state.recap
  );
}

export function normalizeSortForMode(
  sort: TimelineEventSort,
  isAllLines: boolean,
): TimelineEventSort {
  const options = sortOptionsForMode(isAllLines);
  if (options.includes(sort)) return sort;
  return isAllLines ? "book_order" : "timeline_order";
}

export function sortOptionsForMode(isAllLines: boolean): readonly TimelineEventSort[] {
  return isAllLines ? ALL_LINES_SORT_OPTIONS : LINE_SORT_OPTIONS;
}

export function toApiParams(
  state: TimelineEventsFilterState,
  pageNumber: number,
): TimelineEventsControllerListEventsParams {
  const search = state.search.trim();

  return {
    pageNumber,
    sort: state.sort,
    ...(state.timelineId === null ? {} : { timelineId: state.timelineId }),
    ...(search.length === 0 ? {} : { search }),
    ...(state.eventType.length === 0 ? {} : { eventType: state.eventType }),
    ...(state.importance.length === 0 ? {} : { importance: state.importance }),
    ...(state.unresolved ? { unresolved: "true" } : {}),
    ...(state.recap ? { recap: "true" } : {}),
  };
}
