import { z } from "zod";

export const LIST_PURGE_QUEUE_NAME = "list-purge";
export const LIST_PURGE_JOB = "list-purge";

export const ListPurgeJobSchema = z.object({
  listId: z.uuid(),
  userId: z.uuid(),
});

export type ListPurgeJob = z.infer<typeof ListPurgeJobSchema>;
