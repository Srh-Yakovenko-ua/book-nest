import type { OwnSpeciesView, SpeciesUsage } from "@app/shared";

import { isSpeciesInUse } from "@app/shared";

import { assertNever } from "@/lib/assert-never";

export type OwnSpeciesFilters = {
  query: string;
  usage: OwnSpeciesUsageFilter;
};

type OwnSpeciesUsageFilter = (typeof OWN_SPECIES_FILTERS.usages)[number];

export const OWN_SPECIES_FILTERS = {
  none: { query: "", usage: "all" },
  usages: ["all", "used", "unused"],
} as const;

export function countOwnSpeciesByUsage(
  species: readonly OwnSpeciesView[],
): Record<OwnSpeciesUsageFilter, number> {
  const used = species.filter((item) => isSpeciesInUse(item.usage)).length;

  return { all: species.length, unused: species.length - used, used };
}

export function filterOwnSpecies(
  species: readonly OwnSpeciesView[],
  filters: OwnSpeciesFilters,
): OwnSpeciesView[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return species.filter(
    (item) =>
      matchesUsage(item.usage, filters.usage) && item.name.toLocaleLowerCase().includes(query),
  );
}

function matchesUsage(usage: SpeciesUsage, filter: OwnSpeciesUsageFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "unused":
      return !isSpeciesInUse(usage);
    case "used":
      return isSpeciesInUse(usage);
    default:
      return assertNever(filter);
  }
}
