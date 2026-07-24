import type { TimelineListView } from "@app/shared";

import { TimelineListViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { timelinesControllerListTimelines } from "@/shared/api/generated/endpoints/timelines/timelines";

import { timelineKeys } from "./timeline-keys";

export function useBookTimelines(bookId: string) {
  return useQuery({
    queryFn: async (): Promise<TimelineListView> => {
      const response = await timelinesControllerListTimelines(bookId);
      return TimelineListViewSchema.parse(response);
    },
    queryKey: timelineKeys.timelines(bookId),
    retry: false,
  });
}
