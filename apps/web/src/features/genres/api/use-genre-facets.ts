import type { GenreFacetsView } from "@app/shared";

import { GenreFacetsViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { genresControllerFacets } from "@/shared/api/generated/endpoints/genres/genres";

import type { GenresDatasetParams } from "../model/genres-query";

import { genresKeys } from "./genres-keys";

export function useGenreFacets(params: GenresDatasetParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<GenreFacetsView> =>
      GenreFacetsViewSchema.parse(await genresControllerFacets(params, { signal })),
    queryKey: genresKeys.facets(params),
    retry: false,
  });
}
