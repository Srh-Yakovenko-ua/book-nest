"use client";

import type { CharacterGlobalSummaryView } from "@app/shared";

import { useState } from "react";

import { useSpeciesByIds, useSpeciesLabel } from "@/features/species";

export type CatalogSpeciesNames = {
  isPending: boolean;
  remember: (id: string, name: string) => void;
  resolve: (id: string) => string | undefined;
};

type UseCatalogSpeciesNamesOptions = {
  characters: readonly CharacterGlobalSummaryView[];
  speciesIds: readonly string[];
};

export function useCatalogSpeciesNames({
  characters,
  speciesIds,
}: UseCatalogSpeciesNamesOptions): CatalogSpeciesNames {
  const speciesLabel = useSpeciesLabel();
  const [remembered, setRemembered] = useState<Readonly<Record<string, string>>>({});
  const hasSpeciesFilter = speciesIds.length > 0;
  const lookup = useSpeciesByIds(speciesIds, { enabled: hasSpeciesFilter });

  return {
    isPending: hasSpeciesFilter && (lookup.isPending || lookup.isPlaceholderData),
    remember: (id, name) =>
      setRemembered((current) => (current[id] === name ? current : { ...current, [id]: name })),
    resolve: (id) => {
      const loaded = characters.find((character) => character.species?.id === id)?.species;
      return (
        remembered[id] ??
        speciesLabel(loaded ?? null) ??
        lookup.data?.find((species) => species.id === id)?.name
      );
    },
  };
}
