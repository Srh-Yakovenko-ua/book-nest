import type { Nullable } from "@app/shared";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelineEventsControllerDeleteRelation } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import { invalidateTimelineEventDetails } from "./timeline-keys";

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
    onSuccess: (_data, { eventId, targetEventId }) => {
      void invalidateTimelineEventDetails(queryClient, { eventIds: [eventId, targetEventId] });
    },
  });
}
