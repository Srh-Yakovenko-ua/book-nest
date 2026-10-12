"use client";

import type { SpeciesBrowsePage } from "@app/shared";

import { SPECIES_SEARCH, SpeciesBrowsePageSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { speciesControllerBrowse } from "@/shared/api/generated/endpoints/species/species";

import { useSpeciesLocale } from "../model/use-species-locale";
import { speciesKeys } from "./species-keys";

type SpeciesBrowseArgs = {
  enabled: boolean;
};

export function useSpeciesBrowse({ enabled }: SpeciesBrowseArgs) {
  const locale = useSpeciesLocale();
  const params = { locale, pageSize: SPECIES_SEARCH.browsePageSize };

  return useInfiniteQuery({
    enabled,
    getNextPageParam: (lastPage: SpeciesBrowsePage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }): Promise<SpeciesBrowsePage> =>
      SpeciesBrowsePageSchema.parse(
        await speciesControllerBrowse({ ...params, pageNumber: pageParam }, { signal }),
      ),
    queryKey: speciesKeys.browse(params),
  });
}
