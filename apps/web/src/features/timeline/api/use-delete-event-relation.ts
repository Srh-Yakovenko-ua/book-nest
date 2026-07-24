import type { Nullable } from "@app/shared";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelineEventsControllerDeleteRelation } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import { invalidateTimelineQueries, timelineKeys } from "./timeline-keys";

type DeleteEventRelationVariables = {
  bookId: string;
  eventId: string;
  relationId: string;
  targetEventId?: Nullable<string>;
};

export function useDeleteEventRelation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ relationId }: DeleteEventRelationVariables): Promise<void> => {
      await timelineEventsControllerDeleteRelation(relationId);
    },
    onSuccess: (_data, { bookId, eventId, targetEventId }) => {
      invalidateTimelineQueries(queryClient, { bookId, eventId });
      if (targetEventId !== undefined && targetEventId !== null) {
        void queryClient.invalidateQueries({ queryKey: timelineKeys.event(targetEventId) });
      }
    },
  });
}
