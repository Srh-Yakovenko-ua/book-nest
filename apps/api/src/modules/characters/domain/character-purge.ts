import { milliseconds } from "date-fns";
import { z } from "zod";

export const CHARACTER_PURGE_QUEUE_NAME = "character-purge";
export const CHARACTER_PURGE_JOB = "character-purge";

export const CHARACTER_PURGE_WINDOW_DAYS = 30;
export const CHARACTER_PURGE_WINDOW_MS = milliseconds({ days: CHARACTER_PURGE_WINDOW_DAYS });

export const CHARACTER_PURGE_RECONCILE_BATCH = 100;

export const CharacterPurgeJobSchema = z.object({
  characterId: z.uuid(),
  userId: z.uuid(),
});

export type CharacterPurgeJob = z.infer<typeof CharacterPurgeJobSchema>;
