"use client";

import type { SpeciesOptionView } from "@app/shared";

import { SpeciesSearchResultSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { SpeciesControllerSearchParams } from "@/shared/api/generated/model";

import { speciesControllerSearch } from "@/shared/api/generated/endpoints/species/species";

import { useSpeciesLocale } from "../model/use-species-locale";
import { speciesKeys } from "./species-keys";

type UseSpeciesByIdsOptions = {
  enabled: boolean;
};

export function useSpeciesByIds(ids: readonly string[], { enabled }: UseSpeciesByIdsOptions) {
  const locale = useSpeciesLocale();
  const params: SpeciesControllerSearchParams = { ids: [...new Set(ids)].sort(), locale };

  return useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<SpeciesOptionView[]> =>
      SpeciesSearchResultSchema.parse(await speciesControllerSearch(params, { signal })).items,
    queryKey: speciesKeys.byIds(params),
  });
}
