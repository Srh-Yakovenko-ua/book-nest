import type { ReorderTimelinesInput, TimelineListView } from "@app/shared";

import { TimelineListViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelinesControllerReorderTimelines } from "@/shared/api/generated/endpoints/timelines/timelines";

import { invalidateTimelineEventQueries, timelineKeys } from "./timeline-keys";

type ReorderTimelinesVariables = {
  bookId: string;
  input: ReorderTimelinesInput;
};

export function useReorderTimelines() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookId, input }: ReorderTimelinesVariables): Promise<TimelineListView> => {
      const response = await timelinesControllerReorderTimelines(bookId, input);
      return TimelineListViewSchema.parse(response);
    },
    onSuccess: (list, { bookId }) => {
      queryClient.setQueryData(timelineKeys.timelines(bookId), list);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: timelineKeys.summary(bookId) }),
        queryClient.invalidateQueries({ queryKey: timelineKeys.overview(bookId) }),
        invalidateTimelineEventQueries(queryClient, { bookId }),
      ]);
    },
  });
}
