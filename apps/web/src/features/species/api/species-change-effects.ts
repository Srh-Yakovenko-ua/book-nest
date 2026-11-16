import type { QueryClient } from "@tanstack/react-query";

import type { QueryKeyMatcher } from "@/lib/query-keys";

import { characterKeys } from "@/features/characters/api/character-keys";
import { matchesAnyKeyPrefix } from "@/lib/query-keys";

import { speciesKeys } from "./species-keys";

const SPECIES_KEY_FAMILIES = {
  characters: matchesAnyKeyPrefix(characterKeys.all),
  species: matchesAnyKeyPrefix(speciesKeys.all),
} as const satisfies Record<string, QueryKeyMatcher>;

type SpeciesKeyFamily = keyof typeof SPECIES_KEY_FAMILIES;

const SPECIES_CHANGE_EFFECTS = {
  deleted: ["species", "characters"],
  merged: ["species", "characters"],
  renamed: ["species", "characters"],
} as const satisfies Record<string, readonly SpeciesKeyFamily[]>;

type SpeciesChange = keyof typeof SPECIES_CHANGE_EFFECTS;

function speciesChanged(
  queryClient: QueryClient,
  { change }: { change: SpeciesChange },
): Promise<void> {
  const families: readonly SpeciesKeyFamily[] = SPECIES_CHANGE_EFFECTS[change];
  const matchers: QueryKeyMatcher[] = families.map((family) => SPECIES_KEY_FAMILIES[family]);

  return queryClient.invalidateQueries({
    predicate: (query) => matchers.some((matches) => matches(query)),
  });
}

export const speciesChangeEffects = { speciesChanged };
