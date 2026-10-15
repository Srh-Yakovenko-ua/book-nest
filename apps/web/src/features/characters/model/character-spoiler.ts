import type { CharacterRevealFieldKey, Nullable } from "@app/shared";

import { CharacterRevealFieldKeySchema } from "@app/shared";

export const ALL_REVEAL_FIELD_KEYS: CharacterRevealFieldKey[] = [
  ...CharacterRevealFieldKeySchema.options,
];

export const REVEAL_FOCUS_TARGET = {
  attribute: "data-reveal-target",
  focusClassName:
    "focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring/50",
} as const;

export type CharacterRevealControl = {
  isRevealed: (field: CharacterRevealFieldKey) => boolean;
  onReveal: (field: CharacterRevealFieldKey) => Promise<boolean>;
  pending: Nullable<CharacterRevealFieldKey>;
};

export function addRevealKey(
  current: readonly CharacterRevealFieldKey[],
  key: CharacterRevealFieldKey,
): CharacterRevealFieldKey[] {
  return current.includes(key) ? [...current] : [...current, key];
}

export function findRevealFocusTarget(
  container: ParentNode,
  key: CharacterRevealFieldKey,
): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[${REVEAL_FOCUS_TARGET.attribute}="${key}"]`);
}

export function isFieldHidden(hiddenFields: readonly string[], field: string): boolean {
  return hiddenFields.includes(field);
}

export function revealFocusTarget(key: CharacterRevealFieldKey) {
  return { [REVEAL_FOCUS_TARGET.attribute]: key, tabIndex: -1 } as const;
}
