import type { MoveTimelineEventInput, TimelineEventView } from "@app/shared";

import { TimelineEventViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelineEventsControllerMoveEvent } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import {
  invalidateTimelineAggregateQueries,
  invalidateTimelineEventQueries,
} from "./timeline-keys";

type MoveTimelineEventVariables = {
  bookId: string;
  eventId: string;
  input: MoveTimelineEventInput;
};

export function useMoveTimelineEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      input,
    }: MoveTimelineEventVariables): Promise<TimelineEventView> => {
      const response = await timelineEventsControllerMoveEvent(eventId, input);
      return TimelineEventViewSchema.parse(response);
    },
    onSuccess: (_event, { bookId }) => {
      void invalidateTimelineEventQueries(queryClient, { bookId });
      void invalidateTimelineAggregateQueries(queryClient, { bookId });
    },
  });
}
