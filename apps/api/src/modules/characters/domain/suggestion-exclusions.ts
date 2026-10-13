import type { CharacterScopedAppearance, ReadingContextWindow } from "./reading-context-window.js";

import {
  collectUnreachableCharacterIds,
  isAppearanceWithinReadingWindow,
} from "./reading-context-window.js";

export type SuggestionExclusions = {
  excludedEverywhere: string[];
  excludedFromSameSeries: string[];
};

export const NO_SUGGESTION_EXCLUSIONS: SuggestionExclusions = {
  excludedEverywhere: [],
  excludedFromSameSeries: [],
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
  const charactersInsideWindow = new Set(
    seriesAppearances
      .filter((appearance) => isAppearanceWithinReadingWindow({ appearance, window }))
      .map((appearance) => appearance.characterId),
  );

  return {
    excludedEverywhere: [...unreachableCharacterIds].filter(
      (characterId) => !charactersInsideWindow.has(characterId),
    ),
    excludedFromSameSeries: [...unreachableCharacterIds],
  };
}
