import type { Nullable, TimelineEventDetailView } from "@app/shared";

import { TimelineEventDetailViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { timelineEventsControllerGetEvent } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import { timelineKeys } from "./timeline-keys";

export function useTimelineEvent(eventId: Nullable<string>) {
  return useQuery({
    enabled: eventId !== null,
    queryFn: async (): Promise<TimelineEventDetailView> => {
      const response = await timelineEventsControllerGetEvent(eventId ?? "");
      return TimelineEventDetailViewSchema.parse(response);
    },
    queryKey: timelineKeys.event(eventId ?? ""),
    retry: false,
  });
}
