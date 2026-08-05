import { z } from "zod";

export const NOTE_PURGE_QUEUE_NAME = "note-purge";
export const NOTE_PURGE_JOB = "note-purge";

export const NotePurgeJobSchema = z.object({
  noteId: z.uuid(),
  userId: z.uuid(),
});

export type NotePurgeJob = z.infer<typeof NotePurgeJobSchema>;
