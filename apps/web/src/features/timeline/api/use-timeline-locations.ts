import type { TimelineLocationsView } from "@app/shared";

import { TimelineLocationsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { timelineEventsControllerLocations } from "@/shared/api/generated/endpoints/timeline-events/timeline-events";

import { timelineKeys } from "./timeline-keys";

export function useTimelineLocations(bookId: string, { enabled }: { enabled: boolean }) {
  return useQuery({
    enabled,
    queryFn: async ({ signal }): Promise<TimelineLocationsView> =>
      TimelineLocationsViewSchema.parse(
        await timelineEventsControllerLocations(bookId, { signal }),
      ),
    queryKey: timelineKeys.locations(bookId),
    select: toLocationSuggestions,
  });
}

function toLocationSuggestions({ locations }: TimelineLocationsView) {
  return locations.map(({ count, location }) => ({ count, value: location }));
}
