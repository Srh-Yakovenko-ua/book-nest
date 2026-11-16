import type {
  SpeciesControllerBrowseParams,
  SpeciesControllerCandidatesParams,
  SpeciesControllerListOwnParams,
  SpeciesControllerSearchParams,
} from "@/shared/api/generated/model";

const SPECIES_ROOT = "/api/species";

export const speciesKeys = {
  all: [SPECIES_ROOT] as const,
  browse: (params: Omit<SpeciesControllerBrowseParams, "pageNumber">) =>
    [SPECIES_ROOT, "browse", params] as const,
  byIds: (params: SpeciesControllerSearchParams) => [SPECIES_ROOT, "by-ids", params] as const,
  candidates: (params: SpeciesControllerCandidatesParams) =>
    [SPECIES_ROOT, "candidates", params] as const,
  deletionPreview: (speciesId: string) => [SPECIES_ROOT, "deletion-preview", speciesId] as const,
  own: (params: SpeciesControllerListOwnParams) => [SPECIES_ROOT, "own", params] as const,
  search: (params: SpeciesControllerSearchParams) => [SPECIES_ROOT, "search", params] as const,
};
