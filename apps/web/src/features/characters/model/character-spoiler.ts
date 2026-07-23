import type { CharacterRevealFieldKey } from "@app/shared";

import { CharacterRevealFieldKeySchema } from "@app/shared";

export const ALL_REVEAL_FIELD_KEYS: CharacterRevealFieldKey[] = [
  "appearanceNotes",
  "description",
  "displayName",
  "personalImpression",
  "portrait",
  "speciesOverride",
  "status",
];

export function addRevealKey(
  current: readonly CharacterRevealFieldKey[],
  key: CharacterRevealFieldKey,
): CharacterRevealFieldKey[] {
  return current.includes(key) ? [...current] : [...current, key];
}

export function isFieldHidden(hiddenFields: readonly string[], field: string): boolean {
  return hiddenFields.includes(field);
}

export function toRevealKey(field: string): CharacterRevealFieldKey | null {
  const parsed = CharacterRevealFieldKeySchema.safeParse(field);
  return parsed.success ? parsed.data : null;
}
