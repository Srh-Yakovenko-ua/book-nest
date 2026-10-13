import type { SpeciesUsage } from "@app/shared";

export { isSpeciesInUse } from "@app/shared";

export const NO_SPECIES_USAGE = {
  bookOverrides: 0,
  characters: 0,
  trashed: 0,
  trashedBookOverrides: 0,
  trashedCharacters: 0,
} as const satisfies SpeciesUsage;
