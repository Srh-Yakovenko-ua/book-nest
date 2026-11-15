import { useMutation, useQueryClient } from "@tanstack/react-query";

import { matchesAnyKeyPrefix, retireQueries } from "@/lib/query-keys";
import { timelineEventsControllerDeleteEvent } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import {
  invalidateTimelineAggregateQueries,
  invalidateTimelineLocations,
  timelineKeys,
} from "./timeline-keys";

type DeleteTimelineEventVariables = {
  bookId: string;
  eventId: string;
};

export function useDeleteTimelineEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId }: DeleteTimelineEventVariables): Promise<void> => {
      await timelineEventsControllerDeleteEvent(eventId);
    },
    onSuccess: (_data, { bookId, eventId }) => {
      const deletedEventViews = matchesAnyKeyPrefix(timelineKeys.event(eventId));
      retireQueries(queryClient, deletedEventViews);
      void queryClient.invalidateQueries({ queryKey: timelineKeys.events(bookId) });
      void queryClient.invalidateQueries({
        predicate: (query) => !deletedEventViews(query),
        queryKey: timelineKeys.eventDetails,
      });
      void invalidateTimelineAggregateQueries(queryClient, { bookId });
      void invalidateTimelineLocations(queryClient, { bookId });
    },
  });
}
