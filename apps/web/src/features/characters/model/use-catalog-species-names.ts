"use client";

import type { CharacterGlobalSummaryView } from "@app/shared";

import { useState } from "react";

import { useSpeciesLabel } from "@/features/species";

export type CatalogSpeciesNames = {
  remember: (id: string, name: string) => void;
  resolve: (id: string) => string | undefined;
};

export function useCatalogSpeciesNames(
  characters: readonly CharacterGlobalSummaryView[],
): CatalogSpeciesNames {
  const speciesLabel = useSpeciesLabel();
  const [remembered, setRemembered] = useState<Readonly<Record<string, string>>>({});

  return {
    remember: (id, name) =>
      setRemembered((current) => (current[id] === name ? current : { ...current, [id]: name })),
    resolve: (id) => {
      const loaded = characters.find((character) => character.species?.id === id)?.species;
      return remembered[id] ?? speciesLabel(loaded ?? null) ?? undefined;
    },
  };
}
