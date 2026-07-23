import type { TimelineEventView, UpdateTimelineEventInput } from "@app/shared";

import { TimelineEventViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelineEventsControllerUpdateEvent } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import { invalidateTimelineQueries } from "./timeline-keys";

type UpdateTimelineEventVariables = {
  bookId: string;
  eventId: string;
  input: UpdateTimelineEventInput;
};

export function useUpdateTimelineEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      input,
    }: UpdateTimelineEventVariables): Promise<TimelineEventView> => {
      const response = await timelineEventsControllerUpdateEvent(eventId, input);
      return TimelineEventViewSchema.parse(response);
    },
    onSuccess: (event, { bookId }) =>
      invalidateTimelineQueries(queryClient, { bookId, eventId: event.id }),
  });
}
