import { milliseconds } from "date-fns";
import { z } from "zod";

import type { CharacterPurgeRow } from "../infrastructure/characters.repository.js";

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

export function collectMediaIds(character: CharacterPurgeRow): string[] {
  const ids = [
    character.avatarMediaId,
    ...character.bookAppearances.map((appearance) => appearance.portraitMediaId),
    ...character.forms.map((form) => form.portraitMediaId),
  ];
  return [...new Set(ids.filter((id): id is string => id !== null))];
}
