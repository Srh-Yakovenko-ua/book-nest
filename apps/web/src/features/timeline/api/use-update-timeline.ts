import type { TimelineView, UpdateTimelineInput } from "@app/shared";

import { TimelineViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelinesControllerUpdateTimeline } from "@/shared/api/generated/endpoints/timelines/timelines";

import { invalidateTimelineQueries } from "./timeline-keys";

type UpdateTimelineVariables = {
  bookId: string;
  input: UpdateTimelineInput;
  timelineId: string;
};

export function useUpdateTimeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, timelineId }: UpdateTimelineVariables): Promise<TimelineView> => {
      const response = await timelinesControllerUpdateTimeline(timelineId, input);
      return TimelineViewSchema.parse(response);
    },
    onSuccess: (_timeline, { bookId }) => invalidateTimelineQueries(queryClient, { bookId }),
  });
}
