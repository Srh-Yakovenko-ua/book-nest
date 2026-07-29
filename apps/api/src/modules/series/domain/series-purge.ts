import { z } from "zod";

export const SERIES_PURGE_QUEUE_NAME = "series-purge";
export const SERIES_PURGE_JOB = "series-purge";

export const SERIES_PURGE_RECONCILE_BATCH = 100;

export const SeriesPurgeJobSchema = z.object({
  seriesId: z.uuid(),
  userId: z.uuid(),
});

export type SeriesPurgeJob = z.infer<typeof SeriesPurgeJobSchema>;
