import type { QueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";

import type { TimelineEventsFilterState } from "../model/timeline-events-query";

const TIMELINE_ROOT = "/api/timeline";

export const timelineKeys = {
  event: (eventId: string) => [TIMELINE_ROOT, "event", eventId] as const,
  events: (bookId: string) => [TIMELINE_ROOT, "events", bookId] as const,
  eventsList: (bookId: string, filters: TimelineEventsFilterState) =>
    [TIMELINE_ROOT, "events", bookId, filters] as const,
  overview: (bookId: string) => [TIMELINE_ROOT, "overview", bookId] as const,
  root: [TIMELINE_ROOT] as const,
  summary: (bookId: string) => [TIMELINE_ROOT, "summary", bookId] as const,
  timelines: (bookId: string) => [TIMELINE_ROOT, "lines", bookId] as const,
};

type InvalidateTimelineOptions = {
  bookId: string;
  eventId?: string;
};

export function invalidateTimelineQueries(
  queryClient: QueryClient,
  { bookId, eventId }: InvalidateTimelineOptions,
): void {
  void queryClient.invalidateQueries({ queryKey: timelineKeys.timelines(bookId) });
  void queryClient.invalidateQueries({ queryKey: timelineKeys.summary(bookId) });
  void queryClient.invalidateQueries({ queryKey: timelineKeys.overview(bookId) });
  void queryClient.invalidateQueries({ queryKey: timelineKeys.events(bookId) });
  void queryClient.invalidateQueries({ queryKey: bookKeys.detail(bookId) });
  if (eventId !== undefined) {
    void queryClient.invalidateQueries({ queryKey: timelineKeys.event(eventId) });
  }
}
