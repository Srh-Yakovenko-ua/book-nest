import type { ListFacetsView } from "@app/shared";

import { ListFacetsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { listDetailsControllerFacets } from "@/shared/api/generated/endpoints/lists/lists";

import { listKeys } from "./list-keys";

export function useListFacets(id: string) {
  return useQuery({
    queryFn: async ({ signal }): Promise<ListFacetsView> =>
      ListFacetsViewSchema.parse(await listDetailsControllerFacets(id, { signal })),
    queryKey: listKeys.facets(id),
  });
}
