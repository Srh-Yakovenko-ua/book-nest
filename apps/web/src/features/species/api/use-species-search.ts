"use client";

import type { SpeciesOptionView } from "@app/shared";

import { SPECIES_SEARCH, SpeciesSearchResultSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import type { SpeciesControllerSearchParams } from "@/shared/api/generated/model";

import { speciesControllerSearch } from "@/shared/api/generated/endpoints/species/species";

import { useSpeciesLocale } from "../model/use-species-locale";
import { speciesKeys } from "./species-keys";

type SpeciesSearchArgs = {
  enabled: boolean;
  term: string;
};

export function useSpeciesSearch({ enabled, term }: SpeciesSearchArgs) {
  const locale = useSpeciesLocale();
  const params: SpeciesControllerSearchParams = term === "" ? { locale } : { locale, q: term };

  return useQuery({
    enabled,
    queryFn: async ({ signal }): Promise<SpeciesOptionView[]> => {
      const result = SpeciesSearchResultSchema.parse(
        await speciesControllerSearch(params, { signal }),
      );
      return term === "" ? result.items : result.items.slice(0, SPECIES_SEARCH.maxResults);
    },
    queryKey: speciesKeys.search(params),
  });
}
