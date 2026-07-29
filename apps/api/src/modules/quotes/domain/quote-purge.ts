import { z } from "zod";

export const QUOTE_PURGE_QUEUE_NAME = "quote-purge";
export const QUOTE_PURGE_JOB = "quote-purge";

export const QUOTE_PURGE_RECONCILE_BATCH = 100;

export const QuotePurgeJobSchema = z.object({
  quoteId: z.uuid(),
  userId: z.uuid(),
});

export type QuotePurgeJob = z.infer<typeof QuotePurgeJobSchema>;
