import type { Nullable } from "@app/shared";
import type { QueryClient } from "@tanstack/react-query";

import type { TimelineEventsFilterState } from "../model/timeline-events-query";

const TIMELINE_ROOT = "/api/timeline";

export const timelineKeys = {
  event: (eventId: string) => [...timelineKeys.eventDetails, eventId] as const,
  eventDetails: [TIMELINE_ROOT, "event"] as const,
  events: (bookId: string) => [TIMELINE_ROOT, "events", bookId] as const,
  eventsList: (bookId: string, filters: TimelineEventsFilterState) =>
    [TIMELINE_ROOT, "events", bookId, filters] as const,
  locations: (bookId: string) => [...timelineKeys.locationsRoot, bookId] as const,
  locationsRoot: [TIMELINE_ROOT, "locations"] as const,
  overview: (bookId: string) => [TIMELINE_ROOT, "overview", bookId] as const,
  root: [TIMELINE_ROOT] as const,
  summary: (bookId: string) => [TIMELINE_ROOT, "summary", bookId] as const,
  timelines: (bookId: string) => [TIMELINE_ROOT, "lines", bookId] as const,
};

type TimelineBookScope = {
  bookId: string;
};

export async function invalidateTimelineAggregateQueries(
  queryClient: QueryClient,
  { bookId }: TimelineBookScope,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: timelineKeys.timelines(bookId) }),
    queryClient.invalidateQueries({ queryKey: timelineKeys.summary(bookId) }),
    queryClient.invalidateQueries({ queryKey: timelineKeys.overview(bookId) }),
  ]);
}

export async function invalidateTimelineEventDetails(
  queryClient: QueryClient,
  { eventIds }: { eventIds: ReadonlyArray<Nullable<string> | undefined> },
): Promise<void> {
  const uniqueEventIds = new Set(eventIds.filter((eventId) => typeof eventId === "string"));
  await Promise.all(
    [...uniqueEventIds].map((eventId) =>
      queryClient.invalidateQueries({ queryKey: timelineKeys.event(eventId) }),
    ),
  );
}

export async function invalidateTimelineEventQueries(
  queryClient: QueryClient,
  { bookId }: TimelineBookScope,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: timelineKeys.events(bookId) }),
    queryClient.invalidateQueries({ queryKey: timelineKeys.eventDetails }),
  ]);
}

export async function invalidateTimelineLineQueries(
  queryClient: QueryClient,
  scope: TimelineBookScope,
): Promise<void> {
  await Promise.all([
    invalidateTimelineAggregateQueries(queryClient, scope),
    invalidateTimelineEventQueries(queryClient, scope),
  ]);
}

export function invalidateTimelineLocations(
  queryClient: QueryClient,
  { bookId }: TimelineBookScope,
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: timelineKeys.locations(bookId) });
}
