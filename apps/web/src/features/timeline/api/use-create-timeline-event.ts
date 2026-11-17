import type { CreateTimelineEventInput, TimelineEventView } from "@app/shared";

import { TimelineEventViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelineEventsControllerCreateEvent } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import {
  invalidateTimelineAggregateQueries,
  invalidateTimelineEventDetails,
  invalidateTimelineLocations,
  timelineKeys,
} from "./timeline-keys";

type CreateTimelineEventVariables = {
  bookId: string;
  input: CreateTimelineEventInput;
};

export function useCreateTimelineEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      input,
    }: CreateTimelineEventVariables): Promise<TimelineEventView> => {
      const response = await timelineEventsControllerCreateEvent(bookId, input);
      return TimelineEventViewSchema.parse(response);
    },
    onSuccess: (event, { bookId, input }) => {
      void queryClient.invalidateQueries({ queryKey: timelineKeys.events(bookId) });
      void invalidateTimelineEventDetails(queryClient, { eventIds: [event.resolvedByEventId] });
      void invalidateTimelineAggregateQueries(queryClient, { bookId });
      if (input.location !== undefined && input.location !== null) {
        void invalidateTimelineLocations(queryClient, { bookId });
      }
    },
  });
}
