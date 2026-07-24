import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelineEventsControllerDeleteEvent } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import { invalidateTimelineQueries } from "./timeline-keys";

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
    onSuccess: (_data, { bookId, eventId }) =>
      invalidateTimelineQueries(queryClient, { bookId, eventId }),
  });
}
