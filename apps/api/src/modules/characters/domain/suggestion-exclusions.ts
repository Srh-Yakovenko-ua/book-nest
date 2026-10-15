import type { CharacterScopedAppearance, ReadingContextWindow } from "./reading-context-window.js";

import { collectUnreachableCharacterIds } from "./reading-context-window.js";

export type SuggestionExclusions = {
  excludedCharacterIds: string[];
};

export const NO_SUGGESTION_EXCLUSIONS: SuggestionExclusions = {
  excludedCharacterIds: [],
};

export function buildSuggestionExclusions({
  seriesAppearances,
  window,
}: {
  seriesAppearances: CharacterScopedAppearance[];
  window: ReadingContextWindow;
}): SuggestionExclusions {
  const seriesCharacterIds = [
    ...new Set(seriesAppearances.map((appearance) => appearance.characterId)),
  ];
  const unreachableCharacterIds = collectUnreachableCharacterIds({
    appearances: seriesAppearances,
    characterIds: seriesCharacterIds,
    window,
  });
  return { excludedCharacterIds: [...unreachableCharacterIds] };
}
