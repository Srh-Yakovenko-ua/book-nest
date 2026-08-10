import type { ListOverviewView } from "@app/shared";

import { ListOverviewViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { listDetailsControllerOverview } from "@/shared/api/generated/endpoints/lists/lists";

import { listKeys } from "./list-keys";

export function useListOverview(id: string) {
  return useQuery({
    queryFn: async ({ signal }): Promise<ListOverviewView> =>
      ListOverviewViewSchema.parse(await listDetailsControllerOverview(id, { signal })),
    queryKey: listKeys.overview(id),
  });
}
