import type { QueryClient } from "@tanstack/react-query";

import type {
  SpeciesControllerCandidatesParams,
  SpeciesControllerListOwnParams,
  SpeciesControllerSearchParams,
} from "@/shared/api/generated/model";

import { characterKeys } from "@/features/characters/api/character-keys";

const SPECIES_ROOT = "species";

export const speciesKeys = {
  all: [SPECIES_ROOT] as const,
  candidates: (params: SpeciesControllerCandidatesParams) =>
    [SPECIES_ROOT, "candidates", params] as const,
  deletionPreview: (speciesId: string) => [SPECIES_ROOT, "deletion-preview", speciesId] as const,
  own: (params: SpeciesControllerListOwnParams) => [SPECIES_ROOT, "own", params] as const,
  search: (params: SpeciesControllerSearchParams) => [SPECIES_ROOT, "search", params] as const,
};

export async function invalidateSpeciesDependents(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: speciesKeys.all }),
    queryClient.invalidateQueries({ queryKey: characterKeys.all }),
  ]);
}
