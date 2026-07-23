import type { CreateTimelineInput, TimelineView } from "@app/shared";

import { TimelineViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelinesControllerCreateTimeline } from "@/shared/api/generated/endpoints/timelines/timelines";

import { invalidateTimelineQueries } from "./timeline-keys";

type CreateTimelineVariables = {
  bookId: string;
  input: CreateTimelineInput;
};

export function useCreateTimeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookId, input }: CreateTimelineVariables): Promise<TimelineView> => {
      const response = await timelinesControllerCreateTimeline(bookId, input);
      return TimelineViewSchema.parse(response);
    },
    onSuccess: (_timeline, { bookId }) => invalidateTimelineQueries(queryClient, { bookId }),
  });
}
