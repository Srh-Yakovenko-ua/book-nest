import type { TagsCatalogFacetsView } from "@app/shared";

import { TagsCatalogFacetsViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { tagsControllerCatalogFacets } from "@/shared/api/generated/endpoints/tags/tags";

import type { TagsFacetsParams } from "../model/tags-query";

import { tagsKeys } from "./tags-keys";

export function useTagsFacets(params: TagsFacetsParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<TagsCatalogFacetsView> =>
      TagsCatalogFacetsViewSchema.parse(await tagsControllerCatalogFacets(params, { signal })),
    queryKey: tagsKeys.facets(params),
    retry: false,
  });
}
