import type { TimelineSummaryView } from "@app/shared";

import { TimelineSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { timelinesControllerSummary } from "@/shared/api/generated/endpoints/timelines/timelines";

import { timelineKeys } from "./timeline-keys";

export function useTimelineSummary(bookId: string) {
  return useQuery({
    queryFn: async (): Promise<TimelineSummaryView> => {
      const response = await timelinesControllerSummary(bookId);
      return TimelineSummaryViewSchema.parse(response);
    },
    queryKey: timelineKeys.summary(bookId),
    retry: false,
  });
}
