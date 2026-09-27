import type { Nullable } from "@app/shared";

import type { TimelineEventsFilterState } from "./timeline-events-query";

export type TimelineEmptyStateKind =
  "book" | "filters" | "line" | "recap" | "search" | "withoutChapter";

export type TimelineFilteredEmptyKind = Exclude<TimelineEmptyStateKind, "book" | "line">;

type TimelineEmptyStateInput = {
  activeTimelineId: Nullable<string>;
  filters: TimelineEventsFilterState;
  selectedLineEventsCount: Nullable<number>;
  totalEvents: number;
};

export function resolveTimelineEmptyState({
  activeTimelineId,
  filters,
  selectedLineEventsCount,
  totalEvents,
}: TimelineEmptyStateInput): TimelineEmptyStateKind {
  if (totalEvents === 0) return "book";

  const hasSearch = filters.search.trim().length > 0;
  const hasEventFacets =
    filters.eventType.length > 0 || filters.importance.length > 0 || filters.unresolved;
  const isRestricted = hasSearch || hasEventFacets || filters.withoutChapter || filters.recap;

  const isSelectedLineEmpty = activeTimelineId !== null && selectedLineEventsCount === 0;
  if (isSelectedLineEmpty && !isRestricted) return "line";
  if (!isRestricted) return activeTimelineId === null ? "book" : "line";

  if (filters.withoutChapter && !hasSearch && !hasEventFacets && !filters.recap) {
    return "withoutChapter";
  }
  if (filters.recap && !hasSearch && !hasEventFacets && !filters.withoutChapter) return "recap";
  if (hasSearch && !hasEventFacets && !filters.withoutChapter && !filters.recap) return "search";
  return "filters";
}
