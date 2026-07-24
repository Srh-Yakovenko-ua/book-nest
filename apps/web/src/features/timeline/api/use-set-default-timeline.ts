import type { SetDefaultTimelineInput, TimelineListView } from "@app/shared";

import { TimelineListViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { timelinesControllerSetDefault } from "@/shared/api/generated/endpoints/timelines/timelines";

import { invalidateTimelineQueries } from "./timeline-keys";

type SetDefaultTimelineVariables = {
  bookId: string;
  input?: SetDefaultTimelineInput;
  timelineId: string;
};

export function useSetDefaultTimeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      input,
      timelineId,
    }: SetDefaultTimelineVariables): Promise<TimelineListView> => {
      const response = await timelinesControllerSetDefault(timelineId, input);
      return TimelineListViewSchema.parse(response);
    },
    onSuccess: (_list, { bookId }) => invalidateTimelineQueries(queryClient, { bookId }),
  });
}
