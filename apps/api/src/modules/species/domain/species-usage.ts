import type { SpeciesUsage } from "@app/shared";

export const NO_SPECIES_USAGE = {
  bookOverrides: 0,
  characters: 0,
  trashed: 0,
} as const satisfies SpeciesUsage;

export function isSpeciesInUse(usage: SpeciesUsage): boolean {
  return usage.characters > 0 || usage.bookOverrides > 0;
}
