import type { Paginator, TimelineEventView } from "@app/shared";

import { PaginatedTimelineEventsSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { timelineEventsControllerListEvents } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import type { TimelineEventsFilterState } from "../model/timeline-events-query";

import { toApiParams } from "../model/timeline-events-query";
import { timelineKeys } from "./timeline-keys";

type TimelineEventsPage = Paginator<TimelineEventView>;

type UseTimelineEventsOptions = {
  enabled?: boolean;
};

export function useTimelineEvents(
  bookId: string,
  filters: TimelineEventsFilterState,
  options: UseTimelineEventsOptions = {},
) {
  return useInfiniteQuery({
    enabled: options.enabled ?? true,
    getNextPageParam: (lastPage: TimelineEventsPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<TimelineEventsPage> => {
      const response = await timelineEventsControllerListEvents(
        bookId,
        toApiParams(filters, pageParam),
      );
      return PaginatedTimelineEventsSchema.parse(response);
    },
    queryKey: timelineKeys.eventsList(bookId, filters),
    retry: false,
  });
}
