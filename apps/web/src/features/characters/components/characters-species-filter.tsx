"use client";

import type { CharacterFacetsView } from "@app/shared";

import { SPECIES_SEARCH } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { FacetMultiselect } from "@/components/facet-multiselect";
import { speciesSearchTerm, useSpeciesSearch } from "@/features/species";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import type { CatalogSpeciesNames } from "../model/use-catalog-species-names";

import { characterFacetCount } from "../model/character-facet-count";

type CharactersSpeciesFilterProps = {
  counts: CharacterFacetsView["species"] | undefined;
  names: CatalogSpeciesNames;
  onChange: (value: string[]) => void;
  value: string[];
};

export function CharactersSpeciesFilter({
  counts,
  names,
  onChange,
  value,
}: CharactersSpeciesFilterProps) {
  const t = useTranslations("characters.catalog.filters");
  const tActive = useTranslations("characters.activeFilters");
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const debouncedTerm = useDebouncedValue(term, SPECIES_SEARCH.debounceMs);
  const search = useSpeciesSearch({ enabled: open, term: speciesSearchTerm(debouncedTerm) });
  const options = (search.data ?? []).map((species) => ({
    count: characterFacetCount(counts, species.id),
    label: species.name,
    value: species.id,
  }));

  return (
    <FacetMultiselect
      emptyText={t("speciesEmpty")}
      isSearching={search.isFetching}
      label={t("species")}
      onOpenChange={setOpen}
      onSearchChange={setTerm}
      onValueChange={(next) => {
        for (const option of options) {
          if (next.includes(option.value)) names.remember(option.value, option.label);
        }
        onChange(next);
      }}
      options={options}
      placeholder={t("speciesPlaceholder")}
      resolveLabel={(id) =>
        names.resolve(id) ?? (names.isPending ? tActive("pending") : tActive("unknown"))
      }
      searchingText={t("speciesSearching")}
      searchPlaceholder={t("speciesSearch")}
      selectedText={(count) => t("speciesSelected", { count })}
      value={value}
    />
  );
}
