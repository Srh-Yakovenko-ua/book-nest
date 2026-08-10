import type { ListRelatedView } from "@app/shared";

import { ListRelatedViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { listDetailsControllerRelated } from "@/shared/api/generated/endpoints/lists/lists";

import { listKeys } from "./list-keys";

export function useListRelated(id: string) {
  return useQuery({
    queryFn: async ({ signal }): Promise<ListRelatedView> =>
      ListRelatedViewSchema.parse(await listDetailsControllerRelated(id, { signal })),
    queryKey: listKeys.related(id),
  });
}
