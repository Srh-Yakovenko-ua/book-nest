import type { ReorderTimelineEventInput, TimelineEventView } from "@app/shared";

import { TIMELINE_ERROR_CODES, TimelineEventViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { isApiErrorCode } from "@/lib/api-errors";
import { timelineEventsControllerReorderEvent } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import { invalidateTimelineEventQueries, timelineKeys } from "./timeline-keys";

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
    onError: (error, { bookId }) => {
      if (!isApiErrorCode(error, TIMELINE_ERROR_CODES.reorderConflict)) return;
      void queryClient.invalidateQueries({ queryKey: timelineKeys.events(bookId) });
    },
    onSuccess: (_event, { bookId }) => invalidateTimelineEventQueries(queryClient, { bookId }),
  });
}
