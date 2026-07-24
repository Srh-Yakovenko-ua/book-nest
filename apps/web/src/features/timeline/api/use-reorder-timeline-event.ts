import type { ReorderTimelineEventInput, TimelineEventView } from "@app/shared";

import { TimelineEventViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelineEventsControllerReorderEvent } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import { invalidateTimelineQueries } from "./timeline-keys";

type ReorderTimelineEventVariables = {
  bookId: string;
  eventId: string;
  input: ReorderTimelineEventInput;
};

export function useReorderTimelineEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      input,
    }: ReorderTimelineEventVariables): Promise<TimelineEventView> => {
      const response = await timelineEventsControllerReorderEvent(eventId, input);
      return TimelineEventViewSchema.parse(response);
    },
    onSuccess: (event, { bookId }) =>
      invalidateTimelineQueries(queryClient, { bookId, eventId: event.id }),
  });
}
