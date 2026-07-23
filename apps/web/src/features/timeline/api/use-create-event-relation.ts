import type { CreatedEventRelationView, CreateEventRelationInput } from "@app/shared";

import { CreatedEventRelationViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelineEventsControllerCreateRelation } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import { invalidateTimelineQueries, timelineKeys } from "./timeline-keys";

type CreateEventRelationVariables = {
  bookId: string;
  eventId: string;
  input: CreateEventRelationInput;
};

export function useCreateEventRelation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      input,
    }: CreateEventRelationVariables): Promise<CreatedEventRelationView> => {
      const response = await timelineEventsControllerCreateRelation(eventId, input);
      return CreatedEventRelationViewSchema.parse(response);
    },
    onSuccess: (relation, { bookId, eventId }) => {
      invalidateTimelineQueries(queryClient, { bookId, eventId });
      void queryClient.invalidateQueries({ queryKey: timelineKeys.event(relation.targetEventId) });
    },
  });
}
