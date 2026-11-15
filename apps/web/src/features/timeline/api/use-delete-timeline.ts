import type { DeleteTimelineQuery } from "@app/shared";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelinesControllerDeleteTimeline } from "@/shared/api/generated/endpoints/timelines/timelines";

import { invalidateTimelineLineQueries, invalidateTimelineLocations } from "./timeline-keys";

type DeleteTimelineVariables = {
  bookId: string;
  query?: DeleteTimelineQuery;
  timelineId: string;
};

export function useDeleteTimeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ query, timelineId }: DeleteTimelineVariables): Promise<void> => {
      await timelinesControllerDeleteTimeline(timelineId, query);
    },
    onSuccess: (_data, { bookId, query }) => {
      void invalidateTimelineLineQueries(queryClient, { bookId });
      if (query?.strategy === "delete") void invalidateTimelineLocations(queryClient, { bookId });
    },
  });
}
