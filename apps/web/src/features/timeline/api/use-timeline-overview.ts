import type { TimelineOverviewView } from "@app/shared";

import { TimelineOverviewViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { timelineEventsControllerOverview } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import { timelineKeys } from "./timeline-keys";

export function useTimelineOverview(bookId: string) {
  return useQuery({
    queryFn: async (): Promise<TimelineOverviewView> => {
      const response = await timelineEventsControllerOverview(bookId);
      return TimelineOverviewViewSchema.parse(response);
    },
    queryKey: timelineKeys.overview(bookId),
    retry: false,
  });
}
