import { z } from "zod";

export const TIMELINE_PURGE_QUEUE_NAME = "timeline-purge";
export const TIMELINE_PURGE_JOB = "timeline-purge";

export const TIMELINE_PURGE_RECONCILE_BATCH = 100;

export const TimelinePurgeJobSchema = z.object({
  timelineId: z.uuid(),
  userId: z.uuid(),
});

export type TimelinePurgeJob = z.infer<typeof TimelinePurgeJobSchema>;
